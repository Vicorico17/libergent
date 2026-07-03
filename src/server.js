import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";
import { loadEnv } from "./env.js";
import { runMarketplaceHealthChecks } from "./health.js";
import { extractImageSearchIntent, validateImageSearchRequest } from "./image-search.js";
import { searchAcrossSites } from "./app.js";
import { buildHistoryPayload, logSearchEvent } from "./history.js";
import { getDefaultSiteKeys, getSite, getSiteKeysForAllSearch } from "./sites.js";
import { normalizeLeadPayload } from "./leads.js";
import { normalizeSavedSearchPayload } from "./saved-searches.js";
import { insertEmailLeadToSupabase, insertOfferFeedbackToSupabase, insertSavedSearchToSupabase, isSupabaseConfigured } from "./supabase.js";
import { getMarketplaceImageProxyTarget } from "./image-proxy.js";
import { buildAbortSignal } from "./abort.js";
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

  if (apiPath === "/api/search") {
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
      const payload = await searchAcrossSites({ query, condition, provider, limit, maxPages, siteKeys });
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
