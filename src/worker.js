import { searchAcrossSites, searchAcrossSitesScored } from "./app.js";
import { buildHistoryEntry, buildHistoryPayloadFromEntries } from "./history-base.js";
import { insertOfferFeedbackToSupabase, insertSearchEventToSupabase, isSupabaseConfigured, readSupabaseHistoryPayload } from "./supabase.js";
import { getDefaultSiteKeys, getSite, getSiteKeysForAllSearch } from "./sites.js";
import { createSearchTelemetry } from "./search-telemetry.js";

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

async function parseJsonRequest(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function handleApi(request, env) {
  applyEnv(env);

  const url = new URL(request.url);

  if (url.pathname === "/api/search") {
    const query = url.searchParams.get("q")?.trim();
    const condition = url.searchParams.get("condition") || "any";
    const provider = url.searchParams.get("provider") || "auto";
    const site = url.searchParams.get("site") || "default";
    const limitParam = url.searchParams.get("limit");
    const pagesParam = url.searchParams.get("pages");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const maxPages = pagesParam ? Number.parseInt(pagesParam, 10) : undefined;
    const telemetry = createSearchTelemetry({
      route: "/api/search",
      query,
      condition,
      provider,
      site
    });

    if (!query) {
      return json({ error: "Missing q parameter" }, 400);
    }

    try {
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
      telemetry.logSuccess({
        siteKeys,
        marketplaces: payload.summary?.marketplaces ?? 0,
        successfulMarketplaces: payload.summary?.successfulMarketplaces ?? 0
      });
      return json(payload, 200);
    } catch (error) {
      telemetry.logError(error);
      return json({ error: error instanceof Error ? error.message : String(error) }, 500);
    }
  }

  if (url.pathname === "/api/search/scored") {
    const query = url.searchParams.get("q")?.trim();
    const condition = url.searchParams.get("condition") || "any";
    const provider = url.searchParams.get("provider") || "auto";
    const site = url.searchParams.get("site") || "default";
    const limitParam = url.searchParams.get("limit");
    const pagesParam = url.searchParams.get("pages");
    const rankLimitParam = url.searchParams.get("rankLimit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const maxPages = pagesParam ? Number.parseInt(pagesParam, 10) : undefined;
    const rankingLimit = rankLimitParam ? Number.parseInt(rankLimitParam, 10) : undefined;
    const telemetry = createSearchTelemetry({
      route: "/api/search/scored",
      query,
      condition,
      provider,
      site
    });

    if (!query) {
      return json({ error: "Missing q parameter" }, 400);
    }

    try {
      const siteKeys = site === "all"
        ? getSiteKeysForAllSearch(query)
        : site === "default"
          ? getDefaultSiteKeys()
          : [getSite(site).key];

      const payload = await searchAcrossSitesScored({
        query,
        condition,
        provider,
        limit,
        maxPages,
        siteKeys,
        rankingLimit
      });

      await persistSearchEvent(buildHistoryEntry({ query, condition, provider, siteKeys, payload }), env);
      telemetry.logSuccess({
        siteKeys,
        marketplaces: payload.summary?.marketplaces ?? 0,
        successfulMarketplaces: payload.summary?.successfulMarketplaces ?? 0,
        rankedResults: payload.rankedResults?.length ?? 0
      });
      return json(payload, 200);
    } catch (error) {
      telemetry.logError(error);
      return json({ error: error instanceof Error ? error.message : String(error) }, 500);
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

  if (url.pathname === "/api/feedback") {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const body = await parseJsonRequest(request);
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
