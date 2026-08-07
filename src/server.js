import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";
import { loadEnv } from "./env.js";
import { runMarketplaceHealthChecks } from "./health.js";
import { extractImageSearchIntent, validateImageSearchRequest } from "./image-search.js";
import { searchAcrossSites } from "./app.js";
import { aggregateMarketplaceResults } from "./aggregate.js";
import { buildHistoryPayload, logSearchEvent } from "./history.js";
import { PREMIUM_SITE_KEYS, getDefaultSiteKeys, getPremiumSiteKeys, getSite, getSiteKeysForAllSearch } from "./sites.js";
import { normalizeLeadPayload } from "./leads.js";
import { normalizeSavedSearchPayload } from "./saved-searches.js";
import { MAX_ACTIVE_ALERTS, normalizeAlertProfile } from "./alerts.js";
import { createAlertProfileInSupabase, deleteAlertProfileInSupabase, insertEmailLeadToSupabase, insertOfferFeedbackToSupabase, insertSavedSearchToSupabase, insertShopSuggestionToSupabase, isSupabaseConfigured, listAlertEventsFromSupabase, listAlertProfilesFromSupabase, listShopSuggestionsFromSupabase, markAlertEventReadInSupabase, readPremiumEntitlement, updateAlertProfileInSupabase, updateShopSuggestionStatusInSupabase } from "./supabase.js";
import { normalizeShopSuggestion, normalizeShopSuggestionStatus } from "./shop-suggestions.js";
import { getMarketplaceImageProxyTarget } from "./image-proxy.js";
import { buildAbortSignal } from "./abort.js";
import { resolveViewerLocation } from "./location-intelligence.js";
import {
  IMAGE_PROXY_TIMEOUT_MS,
  MAX_API_SEARCH_LIMIT,
  MAX_API_SEARCH_PAGES,
  MAX_IMAGE_PROXY_BYTES,
  MAX_JSON_BODY_BYTES,
  parseBoundedPositiveInteger
} from "./api-params.js";

const PORT = Number.parseInt(process.env.PORT || "8787", 10);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = process.cwd();
const ASSETS_DIR = path.join(ROOT, "ui", "out");
const LEAD_API_PATHS = new Set(["/api/leads", "/api/lead", "/api/email-leads", "/api/email_leads", "/api/waitlist"]);

loadEnv(ROOT);

function normalizeApiPathname(pathname = "") {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function getAdminTokenFromRequest(req, url) {
  const authorization = String(req.headers.authorization || "");
  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }

  return String(req.headers["x-libergent-admin-token"] || url.searchParams.get("token") || "").trim();
}

function isAuthorizedAdminRequest(req, url) {
  const expectedToken = process.env.LIBERGENT_ADMIN_TOKEN || "";
  return Boolean(expectedToken) && getAdminTokenFromRequest(req, url) === expectedToken;
}

async function authenticatePremiumAlertUser(req) {
  const authorization = String(req.headers.authorization || "");
  const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return { error: "Authentication required.", status: 401 };
  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const apiKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !apiKey) return { error: "Supabase authentication is not configured.", status: 503 };
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: apiKey, authorization: `Bearer ${token}` } });
    const user = await response.json().catch(() => null);
    if (!response.ok || !user?.id) return { error: "Invalid or expired session.", status: 401 };
    const entitlement = await readPremiumEntitlement(user.id, user.email || "");
    if (!entitlement.active) return { error: "Alertele automate sunt disponibile în Premium.", code: "premium_required", status: 403 };
    return { user, entitlement };
  } catch {
    return { error: "Authentication service unavailable.", status: 503 };
  }
}

async function proxyImage(res, imageUrl) {
  const targetUrl = getMarketplaceImageProxyTarget(imageUrl);
  if (!targetUrl) {
    sendJson(res, 400, { error: "Image host is not allowed" });
    return;
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

  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.startsWith("image/")) {
    sendJson(res, 502, { error: `Image fetch failed (${response.status})` });
    return;
  }

  const body = await readResponseBufferWithLimit(response, MAX_IMAGE_PROXY_BYTES);
  res.writeHead(200, {
    "content-type": contentType,
    "cache-control": "public, max-age=86400",
    "access-control-allow-origin": "*"
  });
  res.end(body);
}

async function readResponseBufferWithLimit(response, maxBytes) {
  const contentLength = Number.parseInt(response.headers.get("content-length") || "", 10);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error("Image response is too large.");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxBytes) {
      throw new Error("Image response is too large.");
    }
    return Buffer.from(arrayBuffer);
  }

  const chunks = [];
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
        // Upstream body is already being discarded.
      }
      throw new Error("Image response is too large.");
    }
    chunks.push(value);
  }

  const output = Buffer.alloc(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath);
  const typeMap = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8"
  };

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": typeMap[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

function readJsonBody(req, maxBytes = MAX_JSON_BODY_BYTES) {
  return new Promise((resolve) => {
    let body = "";
    let bytes = 0;
    let tooLarge = false;

    req.on("data", (chunk) => {
      bytes += chunk.byteLength;
      if (bytes > maxBytes) {
        tooLarge = true;
        return;
      }
      body += chunk;
    });
    req.on("end", () => {
      if (tooLarge) {
        resolve({ error: "Request body is too large." });
        return;
      }

      try {
        resolve({ data: body ? JSON.parse(body) : null });
      } catch {
        resolve({ error: "Request body is not valid JSON." });
      }
    });
    req.on("error", () => resolve({ error: "Request body could not be read." }));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || `localhost:${PORT}`}`);
  const apiPath = normalizeApiPathname(url.pathname);

  if (apiPath === "/api/image") {
    try {
      await proxyImage(res, url.searchParams.get("url") || "");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, message.includes("too large") ? 413 : 500, { error: message });
    }
    return;
  }

  if (apiPath === "/api/search" || apiPath === "/api/search/free") {
    const query = url.searchParams.get("q")?.trim();
    const condition = url.searchParams.get("condition") || "any";
    const provider = url.searchParams.get("provider") || "auto";
    const site = url.searchParams.get("site") || "default";
    const limitParam = url.searchParams.get("limit");
    const pagesParam = url.searchParams.get("pages");

    if (!query) {
      sendJson(res, 400, { error: "Missing q parameter" });
      return;
    }

    try {
      const viewerLocation = resolveViewerLocation({
        headers: req.headers,
        overrideCity: url.searchParams.get("near") || "",
        fallbackCity: process.env.LIBERGENT_DEMO_CITY || ""
      });
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
      const payload = await searchAcrossSites({ query, condition, provider, limit, maxPages, siteKeys, viewerLocation });
      await logSearchEvent({ query, condition, provider, siteKeys, payload });
      sendJson(res, 200, payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const statusCode = message.startsWith("Expected ") ||
        message.startsWith("Unsupported site") ||
        message.startsWith("Unsupported provider")
        ? 400
        : 500;
      sendJson(res, statusCode, { error: message });
    }
    return;
  }

  if (apiPath === "/api/search/premium") {
    const query = url.searchParams.get("q")?.trim();
    const condition = url.searchParams.get("condition") || "any";
    const provider = url.searchParams.get("provider") || "auto";
    const site = url.searchParams.get("site") || "default";
    const limitParam = url.searchParams.get("limit");
    const pagesParam = url.searchParams.get("pages");

    if (!query) {
      sendJson(res, 400, { error: "Missing q parameter" });
      return;
    }

    try {
      const viewerLocation = resolveViewerLocation({
        headers: req.headers,
        overrideCity: url.searchParams.get("near") || "",
        fallbackCity: process.env.LIBERGENT_DEMO_CITY || ""
      });
      if (site !== "all" && site !== "default") {
        sendJson(res, 400, { error: "Premium search currently supports site=all or site=default." });
        return;
      }
      const limit = parseBoundedPositiveInteger(limitParam, { name: "limit", max: MAX_API_SEARCH_LIMIT });
      const maxPages = parseBoundedPositiveInteger(pagesParam, { name: "pages", max: MAX_API_SEARCH_PAGES });
      const premiumSiteKeys = getPremiumSiteKeys(query);
      const freeSiteKeys = (site === "all" ? getSiteKeysForAllSearch(query) : getDefaultSiteKeys())
        .filter((siteKey) => !PREMIUM_SITE_KEYS.includes(siteKey));
      const [freePayload, premiumPayload] = await Promise.all([
        searchAcrossSites({ query, condition, provider: provider === "auto" ? "direct" : provider, limit, maxPages, siteKeys: freeSiteKeys }),
        searchAcrossSites({ query, condition, provider: provider === "auto" ? "direct" : provider, limit, maxPages: 1, siteKeys: premiumSiteKeys })
      ]);
      const payload = aggregateMarketplaceResults([...freePayload.results, ...premiumPayload.results], {
        condition,
        creditBudget: freePayload.summary?.creditBudget || 0,
        creditsUsed: freePayload.summary?.creditsUsed || 0,
        viewerLocation
      });
      payload.searchTier = "premium";
      payload.summary.premiumMarketplaces = premiumSiteKeys.length;
      payload.summary.browserSessionsUsed = 0;
      payload.summary.browserFallbackMarketplaces = [];
      await logSearchEvent({ query, condition, provider: "premium-direct", siteKeys: [...freeSiteKeys, ...premiumSiteKeys], payload });
      sendJson(res, 200, payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, message.startsWith("Expected ") || message.startsWith("Unsupported ") ? 400 : 500, { error: message });
    }
    return;
  }

  if (apiPath === "/api/alerts" || apiPath.startsWith("/api/alerts/")) {
    const premium = await authenticatePremiumAlertUser(req);
    if (!premium.user) {
      sendJson(res, premium.status, { error: premium.error, ...(premium.code ? { code: premium.code } : {}) });
      return;
    }
    const userId = premium.user.id;
    const eventMatch = apiPath.match(/^\/api\/alerts\/events(?:\/([^/]+))?$/);
    if (eventMatch) {
      if (req.method === "GET" && !eventMatch[1]) sendJson(res, 200, { ok: true, events: await listAlertEventsFromSupabase(userId) });
      else if (req.method === "PATCH" && eventMatch[1]) { await markAlertEventReadInSupabase({ id: decodeURIComponent(eventMatch[1]), userId }); sendJson(res, 200, { ok: true }); }
      else sendJson(res, 405, { error: "Method not allowed" });
      return;
    }
    const profileMatch = apiPath.match(/^\/api\/alerts\/([^/]+)$/);
    if (req.method === "GET" && apiPath === "/api/alerts") {
      const [alerts, events] = await Promise.all([listAlertProfilesFromSupabase(userId), listAlertEventsFromSupabase(userId)]);
      sendJson(res, 200, { ok: true, entitlement: premium.entitlement, alerts, events });
      return;
    }
    if (req.method === "POST" && apiPath === "/api/alerts") {
      const parsedBody = await readJsonBody(req);
      if (parsedBody.error) { sendJson(res, 400, { error: parsedBody.error }); return; }
      try {
        const existing = await listAlertProfilesFromSupabase(userId);
        if (existing.filter((alert) => alert.status === "active").length >= MAX_ACTIVE_ALERTS) { sendJson(res, 409, { error: `Planul Premium permite maximum ${MAX_ACTIVE_ALERTS} alerte active.` }); return; }
        const profile = normalizeAlertProfile(parsedBody.data || {});
        const alert = await createAlertProfileInSupabase({ ...profile, userId, email: premium.user.email || "" });
        sendJson(res, 201, { ok: true, alert });
      } catch (error) {
        sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
      }
      return;
    }
    if (profileMatch && req.method === "PATCH") {
      const parsedBody = await readJsonBody(req);
      if (parsedBody.error) { sendJson(res, 400, { error: parsedBody.error }); return; }
      const body = parsedBody.data || {};
      const changes = {};
      if (["active", "paused"].includes(body.status)) changes.status = body.status;
      if (["daily", "immediate"].includes(body.frequency)) changes.frequency = body.frequency;
      if (body.events && typeof body.events === "object") changes.events = body.events;
      if (!Object.keys(changes).length) {
        sendJson(res, 400, { error: "No supported alert changes supplied." });
        return;
      }
      const alert = await updateAlertProfileInSupabase({ id: decodeURIComponent(profileMatch[1]), userId, changes });
      sendJson(res, alert ? 200 : 404, alert ? { ok: true, alert } : { error: "Alert not found." });
      return;
    }
    if (profileMatch && req.method === "DELETE") {
      await deleteAlertProfileInSupabase({ id: decodeURIComponent(profileMatch[1]), userId });
      sendJson(res, 200, { ok: true });
      return;
    }
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  if (apiPath === "/api/saved-searches" || apiPath === "/api/saved_searches") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const parsedBody = await readJsonBody(req);
    if (parsedBody.error) {
      sendJson(res, parsedBody.error.includes("large") ? 413 : 400, { error: parsedBody.error });
      return;
    }

    let savedSearch;
    try {
      savedSearch = normalizeSavedSearchPayload(parsedBody.data || {});
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
      return;
    }

    if (!isSupabaseConfigured()) {
      sendJson(res, 200, { ok: false, error: "Supabase is not configured." });
      return;
    }

    try {
      await insertSavedSearchToSupabase(savedSearch);
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  if (apiPath === "/api/health/sources") {
    if (!isAuthorizedAdminRequest(req, url)) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }

    if (url.searchParams.get("live") !== "1") {
      sendJson(res, 400, { error: "Add live=1 to run marketplace health checks." });
      return;
    }

    try {
      const query = url.searchParams.get("q") || undefined;
      const provider = url.searchParams.get("provider") || "auto";
      sendJson(res, 200, await runMarketplaceHealthChecks({ query, provider }));
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  if (apiPath === "/api/image-search") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    try {
      validateImageSearchRequest({
        contentType: req.headers["content-type"] || "",
        contentLength: Number.parseInt(req.headers["content-length"] || "0", 10)
      });
      await extractImageSearchIntent();
      sendJson(res, 200, { ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const statusCode = message.includes("not configured") ? 501 : message.includes("large") ? 413 : 400;
      sendJson(res, statusCode, { ok: false, error: message });
    }
    return;
  }

  if (apiPath === "/api/history") {
    sendJson(res, 200, await buildHistoryPayload());
    return;
  }

  if (LEAD_API_PATHS.has(apiPath)) {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const parsedBody = await readJsonBody(req);
    if (parsedBody.error) {
      sendJson(res, parsedBody.error.includes("large") ? 413 : 400, { error: parsedBody.error });
      return;
    }

    let lead;
    try {
      lead = normalizeLeadPayload(parsedBody.data || {});
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
      return;
    }

    if (!isSupabaseConfigured()) {
      sendJson(res, 200, { ok: false, error: "Supabase is not configured." });
      return;
    }

    try {
      await insertEmailLeadToSupabase(lead);
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  if (apiPath === "/api/shop-suggestions") {
    if (req.method !== "POST") { sendJson(res, 405, { error: "Method not allowed" }); return; }
    const parsedBody = await readJsonBody(req);
    try {
      const suggestion = normalizeShopSuggestion(parsedBody.data || {});
      await insertShopSuggestionToSupabase(suggestion);
      sendJson(res, 201, { ok: true, status: "pending" });
    } catch (error) { sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) }); }
    return;
  }

  if (apiPath === "/api/admin/shop-suggestions") {
    if (!isAuthorizedAdminRequest(req, url)) { sendJson(res, 401, { error: "Unauthorized" }); return; }
    try {
      if (req.method === "GET") sendJson(res, 200, { suggestions: await listShopSuggestionsFromSupabase() });
      else if (req.method === "PATCH") {
        const parsedBody = await readJsonBody(req);
        await updateShopSuggestionStatusInSupabase(String(parsedBody.data?.id || ""), normalizeShopSuggestionStatus(parsedBody.data?.status));
        sendJson(res, 200, { ok: true });
      } else sendJson(res, 405, { error: "Method not allowed" });
    } catch (error) { sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) }); }
    return;
  }

  if (apiPath === "/api/feedback") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const parsedBody = await readJsonBody(req);
    if (parsedBody.error) {
      sendJson(res, parsedBody.error.includes("large") ? 413 : 400, { error: parsedBody.error });
      return;
    }

    const body = parsedBody.data;
    const feedback = body?.feedback;
    if (feedback !== "like" && feedback !== "dislike") {
      sendJson(res, 400, { error: "Expected feedback to be like or dislike" });
      return;
    }

    if (!isSupabaseConfigured()) {
      sendJson(res, 200, { ok: false, error: "Supabase is not configured." });
      return;
    }

    try {
      await insertOfferFeedbackToSupabase({
        query: body.query,
        feedback,
        reason: body.reason,
        offer: body.offer
      });
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  const staticPath = url.pathname.endsWith("/")
    ? path.join(ASSETS_DIR, url.pathname, "index.html")
    : path.join(ASSETS_DIR, url.pathname);
  const routePath = path.join(ASSETS_DIR, url.pathname, "index.html");
  const filePath = fs.existsSync(staticPath) ? staticPath : routePath;

  sendFile(res, filePath);
});

server.listen(PORT, HOST, () => {
  console.log(`libergent server running at http://${HOST}:${PORT}`);
});
