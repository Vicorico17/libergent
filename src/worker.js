import { searchAcrossSites } from "./app.js";
import { buildHistoryEntry, buildHistoryPayloadFromEntries } from "./history-base.js";
import { normalizeLeadPayload } from "./leads.js";
import { insertEmailLeadToSupabase, insertOfferFeedbackToSupabase, insertSearchEventToSupabase, isSupabaseConfigured, readSupabaseHistoryPayload } from "./supabase.js";
import { getDefaultSiteKeys, getSite, getSiteKeysForAllSearch } from "./sites.js";
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

const LEAD_API_PATHS = new Set(["/api/leads", "/api/lead", "/api/email-leads", "/api/email_leads", "/api/waitlist"]);

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

async function handleApi(request, env) {
  applyEnv(env);

  const url = new URL(request.url);

  if (url.pathname === "/api/image") {
    return proxyImage(url.searchParams.get("url") || "");
  }

  if (url.pathname === "/api/search") {
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
      const statusCode = message.startsWith("Expected ") || message.startsWith("Unsupported site") ? 400 : 500;
      return json({ error: message }, statusCode);
    }
  }

  if (url.pathname === "/api/history") {
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

  if (LEAD_API_PATHS.has(url.pathname)) {
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

  if (url.pathname === "/api/feedback") {
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
