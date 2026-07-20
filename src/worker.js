import { searchAcrossSites } from "./app.js";
import { aggregateMarketplaceResults } from "./aggregate.js";
import { buildConversationHistory, getConversationById } from "./conversations.js";
import { buildHistoryEntry, buildHistoryPayloadFromEntries } from "./history-base.js";
import { runMarketplaceHealthChecks } from "./health.js";
import { extractImageSearchIntent, validateImageSearchRequest } from "./image-search.js";
import { normalizeLeadPayload } from "./leads.js";
import { normalizeSavedSearchPayload } from "./saved-searches.js";
import { findWhatsAppConversationOwner, insertEmailLeadToSupabase, insertOfferFeedbackToSupabase, insertSavedSearchToSupabase, insertSearchEventToSupabase, insertWhatsAppInboundToSupabase, insertWhatsAppOutboundToSupabase, isSupabaseConfigured, readSupabaseHistoryPayload, readWhatsAppMessagesFromSupabase } from "./supabase.js";
import { PREMIUM_BROWSER_SITE_KEYS, PREMIUM_SITE_KEYS, SITES, getDefaultSiteKeys, getSite, getSiteKeysForAllSearch } from "./sites.js";
import { getMarketplaceImageProxyTarget } from "./image-proxy.js";
import { buildAbortSignal } from "./abort.js";
import { extractPhonesFromListing, extractRomanianMobilePhones, normalizeRomanianMobilePhone } from "./phone-numbers.js";
import { benchmarkMarketplaceWithBrowser, revealOlxPhonesWithBrowser, searchMarketplacesWithBrowser } from "./providers/cloudflare-browser.js";
import {
  IMAGE_PROXY_TIMEOUT_MS,
  MAX_API_SEARCH_LIMIT,
  MAX_API_SEARCH_PAGES,
  MAX_IMAGE_PROXY_BYTES,
  MAX_JSON_BODY_BYTES,
  parseBoundedPositiveInteger
} from "./api-params.js";

const LEAD_API_PATHS = new Set(["/api/leads", "/api/lead", "/api/email-leads", "/api/email_leads", "/api/waitlist"]);
const PREMIUM_SEARCH_CACHE_SECONDS = 300;
const MARKETPLACE_CONTACT_CACHE_SECONDS = 900;
const PREMIUM_FREE_BROWSER_FALLBACK_SITE_KEYS = ["okazii.ro"];
const DEFAULT_PREMIUM_BROWSER_FALLBACK_LIMIT = PREMIUM_BROWSER_SITE_KEYS.length + PREMIUM_FREE_BROWSER_FALLBACK_SITE_KEYS.length;
const PREMIUM_BROWSER_FALLBACK_PRIORITY = [
  ...PREMIUM_FREE_BROWSER_FALLBACK_SITE_KEYS,
  ...PREMIUM_BROWSER_SITE_KEYS
];

function normalizeApiPathname(pathname = "") {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function applyEnv(env = {}) {
  if (!globalThis.process) {
    globalThis.process = { env: {} };
  } else if (!globalThis.process.env) {
    globalThis.process.env = {};
  }

  globalThis.process.env.LIBERGENT_RUNTIME = "cloudflare-worker";

  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") {
      globalThis.process.env[key] = value;
    }
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function getPremiumBrowserFallbackLimit(env = {}) {
  const configured = Number.parseInt(String(env.PREMIUM_BROWSER_FALLBACK_LIMIT || ""), 10);
  if (!Number.isFinite(configured)) return DEFAULT_PREMIUM_BROWSER_FALLBACK_LIMIT;
  return Math.max(0, Math.min(configured, PREMIUM_BROWSER_FALLBACK_PRIORITY.length));
}

function needsBrowserFallback(result) {
  if (!result?.ok) return true;
  const parsedCount = result.parsedItemCount ?? result.rawItemCount ?? result.itemCount ?? result.items?.length ?? 0;
  return parsedCount === 0;
}

function preferBrowserFallback(directResult, browserResult) {
  if (!browserResult) return directResult;

  const browserItemCount = browserResult.parsedItemCount ?? browserResult.rawItemCount ?? browserResult.itemCount ?? browserResult.items?.length ?? 0;
  if (browserResult.ok && browserItemCount > 0) return browserResult;
  if (directResult?.ok) return directResult;
  return browserResult;
}

function buildPremiumCacheRequest(request, params) {
  const cacheUrl = new URL("/api/search/premium-cache/v5", request.url);
  cacheUrl.searchParams.set("q", params.query.trim().toLocaleLowerCase("ro-RO"));
  cacheUrl.searchParams.set("condition", params.condition);
  cacheUrl.searchParams.set("provider", params.provider);
  cacheUrl.searchParams.set("site", params.site);
  cacheUrl.searchParams.set("limit", String(params.limit ?? ""));
  cacheUrl.searchParams.set("pages", String(params.maxPages ?? ""));
  return new Request(cacheUrl, { method: "GET" });
}

async function readPremiumSearchCache(cacheRequest) {
  const cache = globalThis.caches?.default;
  if (!cache) return null;
  const response = await cache.match(cacheRequest);
  if (!response) return null;
  const payload = await response.json().catch(() => null);
  if (!payload) return null;
  payload.summary = { ...payload.summary, cacheHit: true, browserSessionsUsed: 0 };
  return json(payload, 200);
}

function writePremiumSearchCache(cacheRequest, payload, context) {
  const cache = globalThis.caches?.default;
  if (!cache) return;
  const response = new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${PREMIUM_SEARCH_CACHE_SECONDS}`
    }
  });
  const operation = cache.put(cacheRequest, response).catch(() => {});
  if (context?.waitUntil) context.waitUntil(operation);
}

function buildMarketplaceContactCacheRequest(request, targetUrl) {
  const cacheUrl = new URL("/api/marketplace/contact-cache/v1", request.url);
  cacheUrl.searchParams.set("url", `${targetUrl.origin}${targetUrl.pathname}`);
  return new Request(cacheUrl, { method: "GET" });
}

async function readMarketplaceContactCache(cacheRequest) {
  const cache = globalThis.caches?.default;
  if (!cache) return null;
  const response = await cache.match(cacheRequest);
  if (!response) return null;
  const payload = await response.json().catch(() => null);
  if (!payload) return null;
  payload.debug = { ...payload.debug, cacheHit: true };
  return json(payload, 200);
}

function writeMarketplaceContactCache(cacheRequest, payload, context) {
  const cache = globalThis.caches?.default;
  if (!cache) return;
  const response = new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${MARKETPLACE_CONTACT_CACHE_SECONDS}`
    }
  });
  const operation = cache.put(cacheRequest, response).catch(() => {});
  if (context?.waitUntil) context.waitUntil(operation);
}

function getBearerTokenFromRequest(request) {
  const authorization = request.headers.get("authorization") || "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }
  return "";
}

function getAdminTokenFromRequest(request, url) {
  return getBearerTokenFromRequest(request) || String(request.headers.get("x-libergent-admin-token") || url.searchParams.get("token") || "").trim();
}

function isAuthorizedAdminRequest(request, url, env = {}) {
  const expectedToken = env.LIBERGENT_ADMIN_TOKEN || "";
  return Boolean(expectedToken) && getAdminTokenFromRequest(request, url) === expectedToken;
}

async function authenticateSupabaseUser(request, env = {}) {
  const accessToken = getBearerTokenFromRequest(request);
  if (!accessToken) return { error: "Authentication required.", status: 401 };

  const supabaseUrl = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  const apiKey = String(env.SUPABASE_ANON_KEY || env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!supabaseUrl || !apiKey) return { error: "Supabase authentication is not configured.", status: 503 };

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: apiKey, authorization: `Bearer ${accessToken}` }
    });
    const user = await response.json().catch(() => null);
    if (!response.ok || !user?.id) return { error: "Invalid or expired session.", status: 401 };
    return { user };
  } catch {
    return { error: "Authentication service unavailable.", status: 503 };
  }
}

function normalizeConversationListing(value = {}) {
  return {
    url: String(value.url || "").slice(0, 2000),
    title: String(value.title || "").slice(0, 300),
    marketplace: String(value.marketplace || value.source || "").slice(0, 80),
    imageUrl: String(value.imageUrl || value.image || "").slice(0, 2000),
    price: String(value.price || value.priceLabel || "").slice(0, 100),
    query: String(value.query || "").slice(0, 200)
  };
}

function getSearchRequestParams(url) {
  const query = url.searchParams.get("q")?.trim();
  if (!query) {
    throw new Error("Missing q parameter");
  }

  return {
    query,
    condition: url.searchParams.get("condition") || "any",
    provider: url.searchParams.get("provider") || "auto",
    site: url.searchParams.get("site") || "default",
    limit: parseBoundedPositiveInteger(url.searchParams.get("limit"), {
      name: "limit",
      max: MAX_API_SEARCH_LIMIT
    }),
    maxPages: parseBoundedPositiveInteger(url.searchParams.get("pages"), {
      name: "pages",
      max: MAX_API_SEARCH_PAGES
    })
  };
}

function getFreeSearchSiteKeys(site, query) {
  return site === "all"
    ? getSiteKeysForAllSearch(query)
    : site === "default"
      ? getDefaultSiteKeys()
      : [getSite(site).key];
}

async function searchPremiumBrowserSites(env, { query, limit, siteKeys }) {
  if (!siteKeys.length) return [];
  const browserLimit = Math.min(limit ?? 20, 30);
  try {
    const results = await searchMarketplacesWithBrowser(
      env.BROWSER,
      siteKeys.map((siteKey) => ({ site: getSite(siteKey), query, limit: browserLimit })),
      { includeBodyText: true, concurrency: 2 }
    );
    return results.map((result) => {
      if (!result?.challengeDetected) return result;
      return { ok: false, site: result.site, query, provider: "cloudflare-browser", error: "Browser challenge detected." };
    });
  } catch (error) {
    return siteKeys.map((siteKey) => ({
      ok: false,
      site: siteKey,
      query,
      provider: "cloudflare-browser",
      error: error instanceof Error ? error.message : String(error)
    }));
  }
}

async function proxyImage(url) {
  const targetUrl = getMarketplaceImageProxyTarget(url);
  if (!targetUrl) {
    return json({ error: "Image host is not allowed" }, 400);
  }

  const response = await fetch(targetUrl, {
    signal: buildAbortSignal({ timeoutMs: IMAGE_PROXY_TIMEOUT_MS }),
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; libergent/0.1; +https://localhost)",
      accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      referer: "https://www.olx.ro/"
    },
    redirect: "follow"
  });

  if (!response.ok) {
    return json({ error: `Image fetch failed (${response.status})` }, 502);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    return json({ error: "Upstream response is not an image" }, 502);
  }

  const contentLength = Number.parseInt(response.headers.get("content-length") || "", 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_PROXY_BYTES) {
    return json({ error: "Image response is too large." }, 413);
  }

  return new Response(limitResponseBody(response.body, MAX_IMAGE_PROXY_BYTES), {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=86400",
      "access-control-allow-origin": "*"
    }
  });
}

function limitResponseBody(body, maxBytes) {
  if (!body) {
    return body;
  }

  let totalBytes = 0;
  return body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      totalBytes += chunk.byteLength || 0;
      if (totalBytes > maxBytes) {
        throw new Error("Image response is too large.");
      }
      controller.enqueue(chunk);
    }
  }));
}

function buildEmptyHistoryPayload() {
  return buildHistoryPayloadFromEntries([]);
}

async function persistSearchEvent(entry, env) {
  if (!isSupabaseConfigured(env)) {
    return;
  }

  try {
    await insertSearchEventToSupabase(entry, env);
  } catch (error) {
    console.warn("Failed to persist search event to Supabase:", error instanceof Error ? error.message : String(error));
  }
}

async function readRequestTextWithLimit(request, maxBytes) {
  const contentLength = Number.parseInt(request.headers.get("content-length") || "", 10);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error("Request body is too large.");
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return "";
  }

  const decoder = new TextDecoder();
  let text = "";
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // Request body is already being discarded.
      }
      throw new Error("Request body is too large.");
    }
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

async function parseJsonRequest(request) {
  try {
    const text = await readRequestTextWithLimit(request, MAX_JSON_BODY_BYTES);
    return { data: text ? JSON.parse(text) : null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Request body is not valid JSON." };
  }
}

function normalizeInboundWhatsAppPayload(body = {}) {
  const from = String(body.from || body.senderE164 || body.senderId || "").trim();
  const text = String(body.text || body.message || body.content || "").trim();
  const timestamp = String(body.timestamp || body.receivedAt || new Date().toISOString()).trim();
  const to = String(body.to || body.to_number || "").trim();
  const messageId = String(body.messageId || body.message_id || "").trim();
  if (!/^\+\d{8,15}$/.test(from)) {
    throw new Error("Expected from to be an E.164 phone number.");
  }
  if (!text || text.length > 8000) {
    throw new Error("Expected a non-empty text value under 8000 characters.");
  }
  return {
    from,
    to,
    text,
    timestamp,
    messageId,
    channel: "whatsapp",
    raw: body.raw || body
  };
}

function getOlxOfferIdFromHtml(html = "") {
  const normalizedHtml = String(html)
    .replace(/\\+\"/g, '"')
    .replace(/\\u0022/gi, '"');

  const patterns = [
    /["'](?:ad|offer)["'][\s\S]{0,300}?["'](?:id|offerId|offer_id)["']\s*:\s*["']?(\d+)/i,
    /(?:data-ad-id|data-offer-id)\s*=\s*["'](\d+)["']/i,
    /["'](?:id|offerId|offer_id)["']\s*:\s*["']?(\d+)["']?\s*,\s*["']title["']/i
  ];

  for (const pattern of patterns) {
    const match = normalizedHtml.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function getResponseCookieHeader(response) {
  const setCookies = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  return setCookies
    .map((value) => String(value).split(";", 1)[0].trim())
    .filter(Boolean)
    .join("; ");
}

async function fetchOlxOfferPhones(targetUrl, html, cookieHeader = "") {
  const offerId = getOlxOfferIdFromHtml(html);
  if (!offerId) {
    return { phones: [], debug: { offerId: "", attempts: [] } };
  }

  const attempts = [];
  for (const endpoint of ["phones", "limited-phones"]) {
    const response = await fetch(new URL(`/api/v1/offers/${offerId}/${endpoint}/`, targetUrl.origin).toString(), {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; LiberGent/1.0; +https://libergent.com)",
        accept: "application/json, text/plain, */*",
        "accept-language": "ro-RO,ro;q=0.9,en;q=0.8",
        "x-requested-with": "XMLHttpRequest",
        referer: targetUrl.toString(),
        ...(cookieHeader ? { cookie: cookieHeader } : {})
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      let detail = "";
      try {
        const parsed = JSON.parse(errorBody);
        detail = String(parsed.error?.detail || parsed.error?.message || parsed.error || parsed.message || "").slice(0, 240);
      } catch {
        detail = errorBody.replace(/\s+/g, " ").trim().slice(0, 240);
      }
      attempts.push({ endpoint, status: response.status, phones: 0, detail });
      continue;
    }

    const payload = await response.json().catch(() => null);
    const phones = extractOlxPhonesFromPayload(payload);
    attempts.push({ endpoint, status: response.status, phones: phones.length });
    if (phones.length) return { phones, debug: { offerId, cookieReceived: Boolean(cookieHeader), attempts } };
  }

  return { phones: [], debug: { offerId, cookieReceived: Boolean(cookieHeader), attempts } };
}

function extractOlxPhonesFromPayload(payload) {
  const values = [];

  function visit(value, key = "") {
    if (typeof value === "string") {
      if (/phone|number|tel/i.test(key)) values.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => visit(entry, key));
      return;
    }
    if (value && typeof value === "object") {
      Object.entries(value).forEach(([childKey, childValue]) => visit(childValue, childKey));
    }
  }

  visit(payload);
  return [...new Set(values.flatMap(extractRomanianMobilePhones))];
}

async function resolveListingPhones(targetUrl, html, cookieHeader = "", env = {}) {
  if (targetUrl.hostname === "www.olx.ro" || targetUrl.hostname.endsWith(".olx.ro")) {
    const olxPhones = await fetchOlxOfferPhones(targetUrl, html, cookieHeader);
    if (olxPhones.phones.length) {
      return olxPhones;
    }
    const htmlPhones = extractPhonesFromListing({ html });
    if (htmlPhones.length) {
      return { phones: htmlPhones, debug: { ...olxPhones.debug, htmlPhones: htmlPhones.length } };
    }

    try {
      const browserResult = await revealOlxPhonesWithBrowser(env.BROWSER, targetUrl.toString());
      return {
        phones: browserResult.phones,
        debug: { ...olxPhones.debug, htmlPhones: 0, browser: browserResult.debug }
      };
    } catch (error) {
      return {
        phones: [],
        debug: {
          ...olxPhones.debug,
          htmlPhones: 0,
          browser: { configured: Boolean(env.BROWSER), error: error instanceof Error ? error.message : String(error) }
        }
      };
    }
  }
  return { phones: extractPhonesFromListing({ html }), debug: { provider: "html" } };
}

function classifyContactLookup(result = {}) {
  if (Array.isArray(result.phones) && result.phones.length) {
    return "phone_found";
  }
  const browserSignals = result.debug?.browser?.pageSignals || [];
  if (browserSignals.includes("verification")) {
    return "verification_required";
  }
  if (browserSignals.includes("login")) {
    return "login_required";
  }
  if (result.debug?.browser?.error) {
    return "browser_error";
  }
  return "phone_not_available";
}

async function handleApi(request, env, context) {
  applyEnv(env);

  const url = new URL(request.url);
  const apiPath = normalizeApiPathname(url.pathname);

  if (apiPath === "/api/openclaw/inbound") {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const expectedToken = String(env.OPENCLAW_INBOUND_TOKEN || "");
    if (!expectedToken || getBearerTokenFromRequest(request) !== expectedToken) {
      return json({ error: "Unauthorized" }, 401);
    }

    const parsedBody = await parseJsonRequest(request);
    if (parsedBody.error) {
      return json({ error: parsedBody.error }, parsedBody.error.includes("large") ? 413 : 400);
    }

    let inbound;
    try {
      inbound = normalizeInboundWhatsAppPayload(parsedBody.data || {});
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400);
    }

    if (!isSupabaseConfigured(env)) {
      return json({ ok: false, error: "Supabase is not configured." }, 200);
    }

    try {
      const owner = await findWhatsAppConversationOwner(inbound.from, env).catch(() => null);
      if (owner?.userId) {
        inbound.raw = {
          ...(inbound.raw || {}),
          userId: owner.userId,
          listing: owner.listing || null
        };
      }
      await insertWhatsAppInboundToSupabase(inbound, env);
      return json({ ok: true }, 200);
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
    }
  }

  if (apiPath === "/api/image") {
    return proxyImage(url.searchParams.get("url") || "");
  }

  if (apiPath === "/api/search" || apiPath === "/api/search/free") {
    try {
      const { query, condition, provider, site, limit, maxPages } = getSearchRequestParams(url);
      const siteKeys = getFreeSearchSiteKeys(site, query);
      const freeProvider = provider === "auto" ? "direct" : provider;

      const payload = await searchAcrossSites({
        query,
        condition,
        provider: freeProvider,
        limit,
        maxPages,
        siteKeys
      });

      await persistSearchEvent(buildHistoryEntry({ query, condition, provider: freeProvider, siteKeys, payload }), env);
      return json({ ...payload, searchTier: "free" }, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const statusCode = message === "Missing q parameter" || message.startsWith("Expected ") ||
        message.startsWith("Unsupported site") ||
        message.startsWith("Unsupported provider")
        ? 400
        : 500;
      return json({ error: message }, statusCode);
    }
  }

  if (apiPath === "/api/search/premium") {
    if (!env.BROWSER) {
      return json({ error: "Cloudflare Browser Run is not configured." }, 503);
    }

    try {
      const params = getSearchRequestParams(url);
      const { query, condition, provider, site, limit, maxPages } = params;
      if (site !== "all" && site !== "default") {
        return json({ error: "Premium search currently supports site=all or site=default." }, 400);
      }

      const cacheRequest = buildPremiumCacheRequest(request, params);
      const cachedResponse = await readPremiumSearchCache(cacheRequest);
      if (cachedResponse) return cachedResponse;

      const freeSiteKeys = getFreeSearchSiteKeys(site, query).filter((siteKey) => !PREMIUM_SITE_KEYS.includes(siteKey));
      const [freePayload, directPremiumPayload] = await Promise.all([
        searchAcrossSites({ query, condition, provider: "direct", limit, maxPages, siteKeys: freeSiteKeys }),
        searchAcrossSites({ query, condition, provider: "direct", limit, maxPages: 1, siteKeys: PREMIUM_SITE_KEYS })
      ]);
      const directResults = [...freePayload.results, ...directPremiumPayload.results];
      const directBySite = new Map(directResults.map((result) => [result.site, result]));
      const browserFallbackLimit = getPremiumBrowserFallbackLimit(env);
      const browserSiteKeys = PREMIUM_BROWSER_FALLBACK_PRIORITY
        .filter((siteKey) => needsBrowserFallback(directBySite.get(siteKey)))
        .slice(0, browserFallbackLimit);
      const browserResults = await searchPremiumBrowserSites(env, { query, limit, siteKeys: browserSiteKeys });
      const browserBySite = new Map(browserResults.map((result) => [result.site, result]));
      const freeResults = freePayload.results.map((result) => preferBrowserFallback(result, browserBySite.get(result.site)));
      const premiumResults = PREMIUM_SITE_KEYS.map((siteKey) => preferBrowserFallback(directBySite.get(siteKey), browserBySite.get(siteKey)));
      const payload = aggregateMarketplaceResults(
        [...freeResults, ...premiumResults],
        {
          condition,
          creditBudget: freePayload.summary?.creditBudget || 0,
          creditsUsed: freePayload.summary?.creditsUsed || 0
        }
      );
      payload.searchTier = "premium";
      payload.summary.premiumMarketplaces = PREMIUM_SITE_KEYS.length;
      payload.summary.browserEligibleMarketplaces = PREMIUM_BROWSER_FALLBACK_PRIORITY.length;
      payload.summary.browserFallbackLimit = browserFallbackLimit;
      payload.summary.browserFallbackMarketplaces = browserSiteKeys;
      payload.summary.browserMarketplaces = browserResults.length;
      payload.summary.successfulBrowserMarketplaces = browserResults.filter((result) => result?.ok).length;
      payload.summary.browserSessionsUsed = browserResults.reduce((sum, result) => sum + (result?.browserSessionsUsed || 0), 0);
      payload.summary.cacheHit = false;

      const siteKeys = [...freeSiteKeys, ...PREMIUM_SITE_KEYS];
      await persistSearchEvent(buildHistoryEntry({ query, condition, provider: "premium-browser", siteKeys, payload }), env);
      writePremiumSearchCache(cacheRequest, payload, context);
      return json(payload, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const statusCode = message === "Missing q parameter" || message.startsWith("Expected ") ||
        message.startsWith("Unsupported site") ||
        message.startsWith("Unsupported provider")
        ? 400
        : 500;
      return json({ error: message }, statusCode);
    }
  }

  if (apiPath === "/api/saved-searches" || apiPath === "/api/saved_searches") {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const parsedBody = await parseJsonRequest(request);
    if (parsedBody.error) {
      return json({ error: parsedBody.error }, parsedBody.error.includes("large") ? 413 : 400);
    }

    let savedSearch;
    try {
      savedSearch = normalizeSavedSearchPayload(parsedBody.data || {});
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400);
    }

    if (!isSupabaseConfigured(env)) {
      return json({ ok: false, error: "Supabase is not configured." }, 200);
    }

    try {
      await insertSavedSearchToSupabase(savedSearch, env);
      return json({ ok: true }, 200);
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
    }
  }

  if (apiPath === "/api/health/sources") {
    if (!isAuthorizedAdminRequest(request, url, env)) {
      return json({ error: "Unauthorized" }, 401);
    }

    if (url.searchParams.get("live") !== "1") {
      return json({ error: "Add live=1 to run marketplace health checks." }, 400);
    }

    try {
      const query = url.searchParams.get("q") || undefined;
      const provider = url.searchParams.get("provider") || "auto";
      return json(await runMarketplaceHealthChecks({ query, provider }), 200);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 500);
    }
  }

  if (apiPath === "/api/admin/browser-benchmark") {
    if (!isAuthorizedAdminRequest(request, url, env)) {
      return json({ error: "Unauthorized" }, 401);
    }
    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, 405);
    }
    if (!env.BROWSER) {
      return json({ error: "Cloudflare Browser Run is not configured." }, 503);
    }

    try {
      const site = getSite(url.searchParams.get("site") || "");
      const query = String(url.searchParams.get("q") || "iphone").trim().slice(0, 120);
      const limit = parseBoundedPositiveInteger(url.searchParams.get("limit"), {
        name: "limit",
        max: 30
      }) ?? 20;
      return json({
        ok: true,
        result: await benchmarkMarketplaceWithBrowser(env.BROWSER, { site, query, limit })
      }, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = message.startsWith("Unsupported site") || message.startsWith("Expected ") ? 400 : 500;
      return json({ ok: false, error: message }, status);
    }
  }

  if (apiPath === "/api/image-search") {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    try {
      validateImageSearchRequest({
        contentType: request.headers.get("content-type") || "",
        contentLength: Number.parseInt(request.headers.get("content-length") || "0", 10)
      });
      await extractImageSearchIntent();
      return json({ ok: true }, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const statusCode = message.includes("not configured") ? 501 : message.includes("large") ? 413 : 400;
      return json({ ok: false, error: message }, statusCode);
    }
  }

  if (apiPath === "/api/history") {
    if (!isSupabaseConfigured(env)) {
      return json({
        ...buildEmptyHistoryPayload(),
        error: "Supabase is not configured for this Worker. Add SUPABASE_URL and SUPABASE_SECRET_KEY as Cloudflare Worker secrets."
      }, 200);
    }

    try {
      return json(await readSupabaseHistoryPayload(env), 200);
    } catch (error) {
      return json({
        ...buildEmptyHistoryPayload(),
        error: error instanceof Error ? error.message : String(error)
      }, 200);
    }
  }

  if (LEAD_API_PATHS.has(apiPath)) {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const parsedBody = await parseJsonRequest(request);
    if (parsedBody.error) {
      return json({ error: parsedBody.error }, parsedBody.error.includes("large") ? 413 : 400);
    }

    let lead;
    try {
      lead = normalizeLeadPayload(parsedBody.data || {});
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400);
    }

    if (!isSupabaseConfigured(env)) {
      return json({ ok: false, error: "Supabase is not configured." }, 200);
    }

    try {
      await insertEmailLeadToSupabase(lead, env);
      return json({ ok: true }, 200);
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
    }
  }

  if (apiPath === "/api/conversations" || apiPath.startsWith("/api/conversations/")) {
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
    const auth = await authenticateSupabaseUser(request, env);
    if (!auth.user) return json({ error: auth.error }, auth.status);
    if (!isSupabaseConfigured(env)) return json({ error: "Supabase is not configured." }, 503);

    try {
      const rows = await readWhatsAppMessagesFromSupabase({ limit: 1000, userId: auth.user.id }, env);
      const conversationId = decodeURIComponent(apiPath.slice("/api/conversations/".length));
      if (apiPath !== "/api/conversations") {
        const conversation = getConversationById(rows, conversationId, { userId: auth.user.id });
        return conversation ? json({ ok: true, conversation }, 200) : json({ error: "Conversation not found." }, 404);
      }
      const conversations = buildConversationHistory(rows, { userId: auth.user.id });
      return json({ ok: true, conversations }, 200);
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
    }
  }

  if (apiPath === "/api/whatsapp/send") {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const auth = await authenticateSupabaseUser(request, env);
    if (!auth.user) return json({ ok: false, error: auth.error }, auth.status);

    if (!env.OPENCLAW_BRIDGE_URL || !env.OPENCLAW_BRIDGE_TOKEN) {
      return json({ ok: false, error: "WhatsApp bridge is not configured." }, 503);
    }

    const parsedBody = await parseJsonRequest(request);
    if (parsedBody.error) {
      return json({ error: parsedBody.error }, parsedBody.error.includes("large") ? 413 : 400);
    }

    const body = parsedBody.data || {};
    const target = normalizeRomanianMobilePhone(body.target);
    const message = String(body.message || "").trim().slice(0, 2000);
    const listing = normalizeConversationListing(body.listing || {});
    if (!target) {
      return json({ ok: false, error: "Enter a valid Romanian mobile seller phone number." }, 400);
    }
    if (!message) {
      return json({ ok: false, error: "Message cannot be empty." }, 400);
    }

    try {
      const bridgeUrl = String(env.OPENCLAW_BRIDGE_URL).replace(/\/+$/, "");
      const response = await fetch(`${bridgeUrl}/whatsapp/send`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${env.OPENCLAW_BRIDGE_TOKEN}`
        },
        body: JSON.stringify({ target, message })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        return json({ ok: false, error: payload.error || `WhatsApp bridge failed (${response.status}).` }, 502);
      }
      const messageId = String(payload.messageId || payload.result?.messageId || `outbound:${target}:${Date.now()}`);
      const timestamp = new Date().toISOString();
      let historySaved = false;
      let historyError = "";
      try {
        historySaved = await insertWhatsAppOutboundToSupabase({
          messageId,
          to: target,
          text: message,
          timestamp,
          raw: { userId: auth.user.id, listing, bridge: payload }
        }, env);
      } catch (error) {
        historyError = error instanceof Error ? error.message : String(error);
      }
      const [conversation] = buildConversationHistory([{
        message_id: messageId,
        direction: "outbound",
        from_number: "libergent-agent",
        to_number: target,
        text: message,
        received_at: timestamp,
        raw: { userId: auth.user.id, listing }
      }], { userId: auth.user.id });
      return json({
        ok: true,
        target,
        messageId,
        conversationId: conversation?.id || null,
        historySaved,
        historyError: historyError || null
      }, 200);
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 502);
    }
  }

  if (apiPath === "/api/marketplace/contact") {
    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, 405);
    }

    const listingUrl = String(url.searchParams.get("url") || "").trim();
    let targetUrl;
    try {
      targetUrl = new URL(listingUrl);
    } catch {
      return json({ ok: false, error: "Invalid listing URL." }, 400);
    }

    const allowedHosts = new Set(Object.keys(SITES));
    const allowed = [...allowedHosts].some((host) =>
      targetUrl.hostname === host || targetUrl.hostname.endsWith(`.${host}`)
    );
    if (targetUrl.protocol !== "https:" || !allowed) {
      return json({ ok: false, error: "Listing host is not supported." }, 400);
    }

    const contactCacheRequest = buildMarketplaceContactCacheRequest(request, targetUrl);
    const cachedContactResponse = await readMarketplaceContactCache(contactCacheRequest);
    if (cachedContactResponse) return cachedContactResponse;

    try {
      const response = await fetch(targetUrl.toString(), {
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; LiberGent/1.0; +https://libergent.com)",
          accept: "text/html,application/xhtml+xml"
        },
        redirect: "follow",
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) {
        return json({ ok: false, phones: [], error: `Listing fetch failed (${response.status}).` }, 502);
      }
      const cookieHeader = getResponseCookieHeader(response);
      const html = await response.text();
      const result = await resolveListingPhones(targetUrl, html, cookieHeader, env);
      const payload = {
        ok: true,
        marketplace: targetUrl.hostname.replace(/^www\./, ""),
        contactStatus: classifyContactLookup(result),
        phones: result.phones,
        debug: { ...result.debug, cacheHit: false }
      };
      writeMarketplaceContactCache(contactCacheRequest, payload, context);
      return json(payload, 200);
    } catch (error) {
      return json({ ok: false, phones: [], error: error instanceof Error ? error.message : String(error) }, 502);
    }
  }

  if (apiPath === "/api/feedback") {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const parsedBody = await parseJsonRequest(request);
    if (parsedBody.error) {
      return json({ error: parsedBody.error }, parsedBody.error.includes("large") ? 413 : 400);
    }

    const body = parsedBody.data;
    const feedback = body?.feedback;
    if (feedback !== "like" && feedback !== "dislike") {
      return json({ error: "Expected feedback to be like or dislike" }, 400);
    }

    if (!isSupabaseConfigured(env)) {
      return json({ ok: false, error: "Supabase is not configured." }, 200);
    }

    try {
      await insertOfferFeedbackToSupabase({
        query: body.query,
        feedback,
        offer: body.offer
      }, env);
      return json({ ok: true }, 200);
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
    }
  }

  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, context);
    }

    return env.ASSETS.fetch(request);
  }
};
