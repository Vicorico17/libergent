import { searchAcrossSites } from "./app.js";
import { aggregateMarketplaceResults } from "./aggregate.js";
import { buildConversationHistory, getConversationById } from "./conversations.js";
import { buildHistoryEntry, buildHistoryPayloadFromEntries } from "./history-base.js";
import { runMarketplaceHealthChecks } from "./health.js";
import { extractImageSearchIntent, validateImageSearchRequest } from "./image-search.js";
import { normalizeLeadPayload } from "./leads.js";
import { normalizeSavedSearchPayload } from "./saved-searches.js";
import { buildAlertEvents, MAX_ACTIVE_ALERTS, normalizeAlertProfile } from "./alerts.js";
import { completeAlertProfileCheck, createAlertProfileInSupabase, deleteAlertProfileInSupabase, findWhatsAppConversationOwner, insertAlertEventsInSupabase, insertEmailLeadToSupabase, insertOfferFeedbackToSupabase, insertSavedSearchToSupabase, insertSearchEventToSupabase, insertShopSuggestionToSupabase, insertVehiclePriceObservations, insertWhatsAppInboundToSupabase, insertWhatsAppOutboundToSupabase, isSupabaseConfigured, listAlertEventsFromSupabase, listAlertListingStatesFromSupabase, listAlertProfilesFromSupabase, listDueAlertProfilesFromSupabase, listShopSuggestionsFromSupabase, markAlertEventReadInSupabase, readPremiumEntitlement, readSupabaseHistoryPayload, readVehiclePriceHistoryFromSupabase, readWhatsAppMessagesFromSupabase, recordNotificationDeliveryInSupabase, updateAlertProfileInSupabase, updateShopSuggestionStatusInSupabase, upsertAlertListingStatesInSupabase } from "./supabase.js";
import { normalizeShopSuggestion, normalizeShopSuggestionStatus } from "./shop-suggestions.js";
import { PREMIUM_BROWSER_SITE_KEYS, PREMIUM_SITE_KEYS, SITES, getDefaultSiteKeys, getPremiumSiteKeys, getSite, getSiteKeysForAllSearch } from "./sites.js";
import { getMarketplaceImageProxyTarget } from "./image-proxy.js";
import { buildAbortSignal } from "./abort.js";
import { extractPhonesFromListing, extractRomanianMobilePhones, normalizeRomanianMobilePhone } from "./phone-numbers.js";
import { benchmarkMarketplaceWithBrowser, revealOlxPhonesWithBrowser, searchMarketplacesWithBrowser } from "./providers/cloudflare-browser.js";
import { parseListingDetailsHtml } from "./listing-details.js";
import { resolveViewerLocation, viewerLocationCacheKey } from "./location-intelligence.js";
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
const MARKETPLACE_DETAILS_CACHE_SECONDS = 1800;
const MAX_MARKETPLACE_DETAILS_HTML_BYTES = 6 * 1024 * 1024;
const PREMIUM_FREE_BROWSER_FALLBACK_SITE_KEYS = ["okazii.ro"];
const DEFAULT_PREMIUM_BROWSER_FALLBACK_LIMIT = PREMIUM_BROWSER_SITE_KEYS.length + PREMIUM_FREE_BROWSER_FALLBACK_SITE_KEYS.length;
const DEFAULT_PREMIUM_BROWSER_CONCURRENCY = 3;
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

function getPremiumBrowserConcurrency(env = {}) {
  const configured = Number.parseInt(String(env.PREMIUM_BROWSER_CONCURRENCY || ""), 10);
  if (!Number.isFinite(configured)) return DEFAULT_PREMIUM_BROWSER_CONCURRENCY;
  return Math.max(1, Math.min(configured, 4));
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

function buildPremiumCacheRequest(request, params, viewerLocation = null) {
  const cacheUrl = new URL("/api/search/premium-cache/v5", request.url);
  cacheUrl.searchParams.set("q", params.query.trim().toLocaleLowerCase("ro-RO"));
  cacheUrl.searchParams.set("condition", params.condition);
  cacheUrl.searchParams.set("provider", params.provider);
  cacheUrl.searchParams.set("site", params.site);
  cacheUrl.searchParams.set("limit", String(params.limit ?? ""));
  cacheUrl.searchParams.set("pages", String(params.maxPages ?? ""));
  cacheUrl.searchParams.set("near", viewerLocationCacheKey(viewerLocation));
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

function buildMarketplaceDetailsCacheRequest(request, targetUrl) {
  const cacheUrl = new URL("/api/marketplace/details-cache/v1", request.url);
  cacheUrl.searchParams.set("url", `${targetUrl.origin}${targetUrl.pathname}${targetUrl.search}`);
  return new Request(cacheUrl, { method: "GET" });
}

async function readMarketplaceDetailsCache(cacheRequest) {
  const cache = globalThis.caches?.default;
  if (!cache) return null;
  const response = await cache.match(cacheRequest);
  if (!response) return null;
  const payload = await response.json().catch(() => null);
  if (!payload) return null;
  payload.cacheHit = true;
  return json(payload, 200);
}

function writeMarketplaceDetailsCache(cacheRequest, payload, context) {
  const cache = globalThis.caches?.default;
  if (!cache) return;
  const response = new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${MARKETPLACE_DETAILS_CACHE_SECONDS}`
    }
  });
  const operation = cache.put(cacheRequest, response).catch(() => {});
  if (context?.waitUntil) context.waitUntil(operation);
}

function parseSupportedMarketplaceUrl(listingUrl) {
  let targetUrl;
  try {
    targetUrl = new URL(String(listingUrl || "").trim());
  } catch {
    throw new Error("Invalid listing URL.");
  }

  const allowed = Object.keys(SITES).some((host) =>
    targetUrl.hostname === host || targetUrl.hostname.endsWith(`.${host}`)
  );
  if (targetUrl.protocol !== "https:" || !allowed) {
    throw new Error("Listing host is not supported.");
  }
  return targetUrl;
}

async function fetchSupportedMarketplacePage(targetUrl, { headers, timeoutMs }) {
  const signal = AbortSignal.timeout(timeoutMs);
  let currentUrl = targetUrl;

  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const response = await fetch(currentUrl.toString(), {
      headers,
      redirect: "manual",
      signal
    });
    if (response.status < 300 || response.status >= 400) {
      return { response, finalUrl: currentUrl };
    }

    const location = response.headers.get("location");
    if (!location) return { response, finalUrl: currentUrl };
    currentUrl = parseSupportedMarketplaceUrl(new URL(location, currentUrl).toString());
  }

  throw new Error("Listing redirected too many times.");
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
      { includeBodyText: true, concurrency: getPremiumBrowserConcurrency(env) }
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

async function persistVehiclePriceHistory(results, env) {
  if (!isSupabaseConfigured(env)) return;
  const listings = results.flatMap((result) => result?.items || [])
    .filter((item) => ["autovit.ro", "bestauto.ro"].includes(item?.site));
  if (!listings.length) return;
  try {
    await insertVehiclePriceObservations(listings, env);
  } catch (error) {
    console.warn("Failed to persist vehicle price observations:", error instanceof Error ? error.message : String(error));
  }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

async function deliverAlertEmail(profile, event, env) {
  if (!env.ALERT_EMAIL_WEBHOOK_URL) return { status: "skipped", error: "ALERT_EMAIL_WEBHOOK_URL is not configured." };
  const payload = event.payload || {};
  const subject = event.event_type === "price_drop" ? `Preț redus: ${payload.title}` : `Alertă LiberGent: ${payload.title}`;
  const listingUrl = event.listing_url;
  const response = await fetch(env.ALERT_EMAIL_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(env.ALERT_EMAIL_WEBHOOK_TOKEN ? { authorization: `Bearer ${env.ALERT_EMAIL_WEBHOOK_TOKEN}` } : {})
    },
    body: JSON.stringify({
      to: profile.email,
      subject,
      text: `${payload.reason || "Am găsit o schimbare relevantă."}\n${payload.title || ""}\n${payload.priceRon ? `${payload.priceRon} RON` : ""}\n${listingUrl}`,
      html: `<h1>${escapeHtml(payload.title || "Alertă LiberGent")}</h1><p>${escapeHtml(payload.reason || "Am găsit o schimbare relevantă.")}</p><p><strong>${escapeHtml(payload.priceRon ? `${payload.priceRon} RON` : "")}</strong></p><p><a href="${escapeHtml(listingUrl)}">Vezi oferta</a></p><p>Poți pune alerta pe pauză din contul LiberGent.</p>`,
      metadata: { alertId: profile.id, eventId: event.id, eventType: event.event_type }
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return { status: "failed", error: result.error || `Email webhook failed (${response.status}).` };
  return { status: "sent", providerMessageId: result.id || result.messageId || "" };
}

async function deliverAlertDigest(profile, events, env) {
  if (!env.ALERT_EMAIL_WEBHOOK_URL) return { status: "skipped", error: "ALERT_EMAIL_WEBHOOK_URL is not configured." };
  const items = events.map((event) => event.payload || {});
  const response = await fetch(env.ALERT_EMAIL_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json", ...(env.ALERT_EMAIL_WEBHOOK_TOKEN ? { authorization: `Bearer ${env.ALERT_EMAIL_WEBHOOK_TOKEN}` } : {}) },
    body: JSON.stringify({
      to: profile.email,
      subject: `${events.length} schimbări în alerta „${profile.query}”`,
      text: items.map((item, index) => `${index + 1}. ${item.title || "Ofertă"} — ${item.reason || "schimbare relevantă"}`).join("\n"),
      html: `<h1>${escapeHtml(profile.query)}</h1><p>${events.length} schimbări relevante:</p><ol>${events.map((event) => `<li><a href="${escapeHtml(event.listing_url)}">${escapeHtml(event.payload?.title || "Ofertă")}</a> — ${escapeHtml(event.payload?.reason || "schimbare relevantă")}</li>`).join("")}</ol><p>Poți gestiona alerta din contul LiberGent.</p>`,
      metadata: { alertId: profile.id, eventIds: events.map((event) => event.id), digest: true }
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return { status: "failed", error: result.error || `Email webhook failed (${response.status}).` };
  return { status: "sent", providerMessageId: result.id || result.messageId || "" };
}

async function runAlertProfile(profile, env) {
  const entitlement = await readPremiumEntitlement(profile.user_id, profile.email, env);
  if (!entitlement.active) {
    await updateAlertProfileInSupabase({ id: profile.id, userId: profile.user_id, changes: { status: "paused", last_error: "Premium entitlement is inactive." } }, env);
    return { id: profile.id, status: "paused", events: 0 };
  }

  try {
    const payload = await searchAcrossSites({ query: profile.query, provider: "direct", limit: 80, maxPages: 1, siteKeys: ["autovit.ro", "bestauto.ro"] });
    const listings = (payload.results || []).flatMap((result) => result?.items || []);
    const states = await listAlertListingStatesFromSupabase(profile.id, env);
    const stateMap = new Map(states.map((state) => [state.listing_url, state]));
    const normalizedProfile = { ...profile, criteria: profile.criteria || {}, events: profile.events || {} };
    const evaluated = buildAlertEvents(normalizedProfile, listings, stateMap);
    const eventsToInsert = profile.last_checked_at ? evaluated.events : [];
    const insertedEvents = await insertAlertEventsInSupabase(profile, eventsToInsert, env);
    await upsertAlertListingStatesInSupabase(profile.id, evaluated.matching, env);

    if (insertedEvents.length && profile.frequency === "daily") {
      const delivery = await deliverAlertDigest(profile, insertedEvents, env).catch((error) => ({ status: "failed", error: error instanceof Error ? error.message : String(error) }));
      for (const event of insertedEvents) await recordNotificationDeliveryInSupabase({ eventId: event.id, userId: profile.user_id, channel: "email", ...delivery }, env);
    } else {
      for (const event of insertedEvents) {
        const delivery = await deliverAlertEmail(profile, event, env).catch((error) => ({ status: "failed", error: error instanceof Error ? error.message : String(error) }));
        await recordNotificationDeliveryInSupabase({ eventId: event.id, userId: profile.user_id, channel: "email", ...delivery }, env);
      }
    }

    await completeAlertProfileCheck(profile.id, profile.frequency, "", env);
    return { id: profile.id, status: "checked", listings: evaluated.matching.length, events: insertedEvents.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await completeAlertProfileCheck(profile.id, profile.frequency, message, env);
    return { id: profile.id, status: "failed", error: message, events: 0 };
  }
}

async function runDuePremiumAlerts(env) {
  if (!isSupabaseConfigured(env)) return { checked: 0, results: [] };
  const profiles = await listDueAlertProfilesFromSupabase({ limit: 20 }, env);
  const results = [];
  for (const profile of profiles) results.push(await runAlertProfile(profile, env));
  return { checked: profiles.length, results };
}

async function authenticatePremiumUser(request, env, premiumMessage = "Premium este disponibil doar pentru conturile Premium.") {
  const auth = await authenticateSupabaseUser(request, env);
  if (!auth.user) return { response: json({ error: auth.error }, auth.status) };
  const entitlement = await readPremiumEntitlement(auth.user.id, auth.user.email || "", env).catch(() => ({ active: false, plan: "free" }));
  if (!entitlement.active) return { response: json({ error: premiumMessage, code: "premium_required" }, 403) };
  return { user: auth.user, entitlement };
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
      const viewerLocation = resolveViewerLocation({
        cf: request.cf,
        headers: request.headers,
        overrideCity: url.searchParams.get("near") || ""
      });
      const siteKeys = getFreeSearchSiteKeys(site, query);
      const freeProvider = provider === "auto" ? "direct" : provider;

      const payload = await searchAcrossSites({
        query,
        condition,
        provider: freeProvider,
        limit,
        maxPages,
        siteKeys,
        viewerLocation
      });

      await persistSearchEvent(buildHistoryEntry({ query, condition, provider: freeProvider, siteKeys, payload }), env);
      await persistVehiclePriceHistory(payload.results || [], env);
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
    const premium = await authenticatePremiumUser(request, env);
    if (premium.response) return premium.response;

    if (!env.BROWSER) {
      return json({ error: "Cloudflare Browser Run is not configured." }, 503);
    }

    try {
      const params = getSearchRequestParams(url);
      const { query, condition, provider, site, limit, maxPages } = params;
      const viewerLocation = resolveViewerLocation({
        cf: request.cf,
        headers: request.headers,
        overrideCity: url.searchParams.get("near") || ""
      });
      if (site !== "all" && site !== "default") {
        return json({ error: "Premium search currently supports site=all or site=default." }, 400);
      }

      const cacheRequest = buildPremiumCacheRequest(request, params, viewerLocation);
      const cachedResponse = await readPremiumSearchCache(cacheRequest);
      if (cachedResponse) return cachedResponse;

      const premiumSiteKeys = getPremiumSiteKeys(query);
      const freeSiteKeys = getFreeSearchSiteKeys(site, query).filter((siteKey) => !PREMIUM_SITE_KEYS.includes(siteKey));
      const [freePayload, directPremiumPayload] = await Promise.all([
        searchAcrossSites({ query, condition, provider: "direct", limit, maxPages, siteKeys: freeSiteKeys }),
        searchAcrossSites({ query, condition, provider: "direct", limit, maxPages: 1, siteKeys: premiumSiteKeys })
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
      const premiumResults = premiumSiteKeys.map((siteKey) => preferBrowserFallback(directBySite.get(siteKey), browserBySite.get(siteKey)));
      const payload = aggregateMarketplaceResults(
        [...freeResults, ...premiumResults],
        {
          condition,
          creditBudget: freePayload.summary?.creditBudget || 0,
          creditsUsed: freePayload.summary?.creditsUsed || 0,
          viewerLocation
        }
      );
      payload.searchTier = "premium";
      payload.summary.premiumMarketplaces = premiumSiteKeys.length;
      payload.summary.browserEligibleMarketplaces = PREMIUM_BROWSER_FALLBACK_PRIORITY.length;
      payload.summary.browserFallbackLimit = browserFallbackLimit;
      payload.summary.browserConcurrency = getPremiumBrowserConcurrency(env);
      payload.summary.browserFallbackMarketplaces = browserSiteKeys;
      payload.summary.browserMarketplaces = browserResults.length;
      payload.summary.successfulBrowserMarketplaces = browserResults.filter((result) => result?.ok).length;
      payload.summary.browserSessionsUsed = browserResults.reduce((sum, result) => sum + (result?.browserSessionsUsed || 0), 0);
      payload.summary.cacheHit = false;

      const siteKeys = [...freeSiteKeys, ...premiumSiteKeys];
      await persistSearchEvent(buildHistoryEntry({ query, condition, provider: "premium-browser", siteKeys, payload }), env);
      await persistVehiclePriceHistory([...freeResults, ...premiumResults], env);
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

  if (apiPath === "/api/alerts" || apiPath.startsWith("/api/alerts/")) {
    const premium = await authenticatePremiumUser(request, env, "Alertele automate sunt disponibile în Premium.");
    if (premium.response) return premium.response;
    const userId = premium.user.id;
    const eventMatch = apiPath.match(/^\/api\/alerts\/events(?:\/([^/]+))?$/);
    if (eventMatch) {
      if (request.method === "GET" && !eventMatch[1]) return json({ ok: true, events: await listAlertEventsFromSupabase(userId, env) }, 200);
      if (request.method === "PATCH" && eventMatch[1]) {
        await markAlertEventReadInSupabase({ id: decodeURIComponent(eventMatch[1]), userId }, env);
        return json({ ok: true }, 200);
      }
      return json({ error: "Method not allowed" }, 405);
    }

    const profileMatch = apiPath.match(/^\/api\/alerts\/([^/]+)$/);
    if (request.method === "GET" && apiPath === "/api/alerts") {
      const [alerts, events] = await Promise.all([listAlertProfilesFromSupabase(userId, env), listAlertEventsFromSupabase(userId, env)]);
      return json({ ok: true, entitlement: premium.entitlement, alerts, events }, 200);
    }
    if (request.method === "POST" && apiPath === "/api/alerts") {
      const parsedBody = await parseJsonRequest(request);
      if (parsedBody.error) return json({ error: parsedBody.error }, 400);
      try {
        const existing = await listAlertProfilesFromSupabase(userId, env);
        if (existing.filter((alert) => alert.status === "active").length >= MAX_ACTIVE_ALERTS) return json({ error: `Planul Premium permite maximum ${MAX_ACTIVE_ALERTS} alerte active.` }, 409);
        const profile = normalizeAlertProfile(parsedBody.data || {});
        const created = await createAlertProfileInSupabase({ ...profile, userId, email: premium.user.email || "" }, env);
        return json({ ok: true, alert: created }, 201);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) }, 400);
      }
    }
    if (profileMatch && request.method === "PATCH") {
      const parsedBody = await parseJsonRequest(request);
      if (parsedBody.error) return json({ error: parsedBody.error }, 400);
      const body = parsedBody.data || {};
      const changes = {};
      if (["active", "paused"].includes(body.status)) changes.status = body.status;
      if (["daily", "immediate"].includes(body.frequency)) changes.frequency = body.frequency;
      if (body.events && typeof body.events === "object") changes.events = body.events;
      if (!Object.keys(changes).length) return json({ error: "No supported alert changes supplied." }, 400);
      const updated = await updateAlertProfileInSupabase({ id: decodeURIComponent(profileMatch[1]), userId, changes }, env);
      return updated ? json({ ok: true, alert: updated }, 200) : json({ error: "Alert not found." }, 404);
    }
    if (profileMatch && request.method === "DELETE") {
      await deleteAlertProfileInSupabase({ id: decodeURIComponent(profileMatch[1]), userId }, env);
      return json({ ok: true }, 200);
    }
    return json({ error: "Method not allowed" }, 405);
  }

  if (apiPath === "/api/admin/alerts/run") {
    if (!isAuthorizedAdminRequest(request, url, env)) return json({ error: "Unauthorized" }, 401);
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    return json({ ok: true, ...(await runDuePremiumAlerts(env)) }, 200);
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

  if (apiPath === "/api/shop-suggestions") {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const parsedBody = await parseJsonRequest(request);
    try {
      await insertShopSuggestionToSupabase(normalizeShopSuggestion(parsedBody.data || {}), env);
      return json({ ok: true, status: "pending" }, 201);
    } catch (error) { return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400); }
  }

  if (apiPath === "/api/admin/shop-suggestions") {
    if (!isAuthorizedAdminRequest(request, url, env)) return json({ error: "Unauthorized" }, 401);
    try {
      if (request.method === "GET") return json({ suggestions: await listShopSuggestionsFromSupabase(env) }, 200);
      if (request.method === "PATCH") {
        const parsedBody = await parseJsonRequest(request);
        await updateShopSuggestionStatusInSupabase(String(parsedBody.data?.id || ""), normalizeShopSuggestionStatus(parsedBody.data?.status), env);
        return json({ ok: true }, 200);
      }
      return json({ error: "Method not allowed" }, 405);
    } catch (error) { return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400); }
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

  if (apiPath === "/api/vehicle/price-history") {
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
    try {
      const targetUrl = parseSupportedMarketplaceUrl(url.searchParams.get("url"));
      const history = await readVehiclePriceHistoryFromSupabase(targetUrl.toString(), env);
      return json({ ok: true, history }, 200);
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400);
    }
  }

  if (apiPath === "/api/marketplace/details") {
    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, 405);
    }

    let targetUrl;
    try {
      targetUrl = parseSupportedMarketplaceUrl(url.searchParams.get("url"));
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400);
    }

    const detailsCacheRequest = buildMarketplaceDetailsCacheRequest(request, targetUrl);
    const cachedDetailsResponse = await readMarketplaceDetailsCache(detailsCacheRequest);
    if (cachedDetailsResponse) return cachedDetailsResponse;

    try {
      const { response, finalUrl } = await fetchSupportedMarketplacePage(targetUrl, {
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; LiberGent/1.0; +https://libergent.com)",
          accept: "text/html,application/xhtml+xml",
          "accept-language": "ro-RO,ro;q=0.9,en;q=0.7"
        },
        timeoutMs: 12000
      });
      if (!response.ok) {
        return json({ ok: false, error: `Listing fetch failed (${response.status}).` }, 502);
      }
      const contentLength = Number.parseInt(response.headers.get("content-length") || "0", 10);
      if (contentLength > MAX_MARKETPLACE_DETAILS_HTML_BYTES) {
        return json({ ok: false, error: "Listing response is too large." }, 502);
      }
      const html = await response.text();
      if (html.length > MAX_MARKETPLACE_DETAILS_HTML_BYTES) {
        return json({ ok: false, error: "Listing response is too large." }, 502);
      }
      const payload = {
        ok: true,
        marketplace: finalUrl.hostname.replace(/^www\./, ""),
        url: finalUrl.toString(),
        details: parseListingDetailsHtml(html, { url: finalUrl.toString() }),
        cacheHit: false
      };
      writeMarketplaceDetailsCache(detailsCacheRequest, payload, context);
      return json(payload, 200);
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 502);
    }
  }

  if (apiPath === "/api/marketplace/contact") {
    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, 405);
    }

    let targetUrl;
    try {
      targetUrl = parseSupportedMarketplaceUrl(url.searchParams.get("url"));
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400);
    }

    const contactCacheRequest = buildMarketplaceContactCacheRequest(request, targetUrl);
    const cachedContactResponse = await readMarketplaceContactCache(contactCacheRequest);
    if (cachedContactResponse) return cachedContactResponse;

    try {
      const { response } = await fetchSupportedMarketplacePage(targetUrl, {
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; LiberGent/1.0; +https://libergent.com)",
          accept: "text/html,application/xhtml+xml"
        },
        timeoutMs: 10000
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
        reason: body.reason,
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
  },
  async scheduled(_controller, env, context) {
    applyEnv(env);
    context.waitUntil(runDuePremiumAlerts(env));
  }
};
