import { searchAcrossSites } from "./app.js";
import { buildBudgetPayload } from "./budget.js";
import { getDefaultSiteKeys, getSite, SITES } from "./sites.js";

function applyEnv(env = {}) {
  if (!globalThis.process) {
    globalThis.process = { env: {} };
  } else if (!globalThis.process.env) {
    globalThis.process.env = {};
  }

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
  return {
    updatedAt: new Date().toISOString(),
    totals: {
      searches: 0,
      uniqueQueries: 0,
      uniqueKeywords: 0
    },
    topQueries: [],
    topKeywords: [],
    dailyTrend: [],
    recentSearches: []
  };
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

    if (!query) {
      return json({ error: "Missing q parameter" }, 400);
    }

    try {
      const siteKeys = site === "all"
        ? Object.keys(SITES)
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

      return json(payload, 200);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 500);
    }
  }

  if (url.pathname === "/api/budget") {
    return json(buildBudgetPayload(), 200);
  }

  if (url.pathname === "/api/history") {
    return json(buildEmptyHistoryPayload(), 200);
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
