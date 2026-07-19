import { searchAcrossSites } from "./app.js";
import { buildHistoryEntry, buildHistoryPayloadFromEntries } from "./history-base.js";
import { runMarketplaceHealthChecks } from "./health.js";
import { extractImageSearchIntent, validateImageSearchRequest } from "./image-search.js";
import { normalizeLeadPayload } from "./leads.js";
import { normalizeSavedSearchPayload } from "./saved-searches.js";
import { insertEmailLeadToSupabase, insertOfferFeedbackToSupabase, insertSavedSearchToSupabase, insertSearchEventToSupabase, insertWhatsAppInboundToSupabase, isSupabaseConfigured, readSupabaseHistoryPayload } from "./supabase.js";
import { SITES, getDefaultSiteKeys, getSite, getSiteKeysForAllSearch } from "./sites.js";
import { getMarketplaceImageProxyTarget } from "./image-proxy.js";
import { buildAbortSignal } from "./abort.js";
import { extractPhonesFromListing, extractRomanianMobilePhones, normalizeRomanianMobilePhone } from "./phone-numbers.js";
import { revealOlxPhonesWithBrowser } from "./providers/cloudflare-browser.js";
import {
  IMAGE_PROXY_TIMEOUT_MS,
  MAX_API_SEARCH_LIMIT,
  MAX_API_SEARCH_PAGES,
  MAX_IMAGE_PROXY_BYTES,
  MAX_JSON_BODY_BYTES,
  parseBoundedPositiveInteger
} from "./api-params.js";

const LEAD_API_PATHS = new Set(["/api/leads", "/api/lead", "/api/email-leads", "/api/email_leads", "/api/waitlist"]);

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

async function handleApi(request, env) {
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
      await insertWhatsAppInboundToSupabase(inbound, env);
      return json({ ok: true }, 200);
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
    }
  }

  if (apiPath === "/api/image") {
    return proxyImage(url.searchParams.get("url") || "");
  }

  if (apiPath === "/api/search") {
    const query = url.searchParams.get("q")?.trim();
    const condition = url.searchParams.get("condition") || "any";
    const provider = url.searchParams.get("provider") || "auto";
    const site = url.searchParams.get("site") || "default";
    const limitParam = url.searchParams.get("limit");
    const pagesParam = url.searchParams.get("pages");

    if (!query) {
      return json({ error: "Missing q parameter" }, 400);
    }

    try {
      const limit = parseBoundedPositiveInteger(limitParam, {
        name: "limit",
        max: MAX_API_SEARCH_LIMIT
      });
      const maxPages = parseBoundedPositiveInteger(pagesParam, {
        name: "pages",
        max: MAX_API_SEARCH_PAGES
      });
      const siteKeys = site === "all"
        ? getSiteKeysForAllSearch(query)
        : site === "default"
          ? getDefaultSiteKeys()
          : [getSite(site).key];

      const payload = await searchAcrossSites({
        query,
        condition,
        provider,
        limit,
        maxPages,
        siteKeys
      });

      await persistSearchEvent(buildHistoryEntry({ query, condition, provider, siteKeys, payload }), env);
      return json(payload, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const statusCode = message.startsWith("Expected ") ||
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

  if (apiPath === "/api/whatsapp/send") {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

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
      return json({ ok: true, target, messageId: payload.messageId || payload.result?.messageId || null }, 200);
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
      return json({ ok: true, phones: result.phones, debug: result.debug }, 200);
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
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};
