import { MAX_HISTORY_ENTRIES } from "./history-base.js";

const DEFAULT_TABLE = "search_events";
const DEFAULT_QUERY_STATS_TABLE = "search_query_stats";
const DEFAULT_KEYWORD_STATS_TABLE = "keyword_stats";
const DEFAULT_FEEDBACK_TABLE = "offer_feedback";

function trimTrailingSlash(value = "") {
  return value.replace(/\/+$/, "");
}

function getSupabaseConfig(env = process.env) {
  const url = trimTrailingSlash(env.SUPABASE_URL || "");
  const apiKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";
  const table = env.SUPABASE_SEARCH_EVENTS_TABLE || DEFAULT_TABLE;
  const queryStatsTable = env.SUPABASE_QUERY_STATS_TABLE || DEFAULT_QUERY_STATS_TABLE;
  const keywordStatsTable = env.SUPABASE_KEYWORD_STATS_TABLE || DEFAULT_KEYWORD_STATS_TABLE;
  const feedbackTable = env.SUPABASE_FEEDBACK_TABLE || DEFAULT_FEEDBACK_TABLE;

  if (!url || !apiKey) {
    return null;
  }

  return { url, apiKey, table, queryStatsTable, keywordStatsTable, feedbackTable };
}

function getRequestHeaders(apiKey) {
  const headers = {
    apikey: apiKey,
    "Content-Type": "application/json"
  };

  if (!apiKey.startsWith("sb_")) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

function mapEntryToRpcPayload(entry) {
  return {
    query_value: entry.query,
    condition_value: entry.condition,
    provider_value: entry.provider,
    site_keys_value: entry.siteKeys || [],
    searched_at_value: entry.searchedAt,
    successful_marketplaces_value: entry.successfulMarketplaces,
    marketplaces_value: entry.marketplaces,
    total_listings_value: entry.totalListings,
    credits_used_value: entry.creditsUsed,
    best_offer_value: entry.bestOffer
  };
}

function mapRowToEntry(row) {
  return {
    query: row.query || "",
    condition: row.condition || "any",
    provider: row.provider || "auto",
    siteKeys: Array.isArray(row.site_keys) ? row.site_keys : [],
    searchedAt: row.searched_at || row.created_at || new Date().toISOString(),
    successfulMarketplaces: row.successful_marketplaces ?? 0,
    marketplaces: row.marketplaces ?? 0,
    totalListings: row.total_listings ?? 0,
    creditsUsed: row.credits_used ?? 0,
    bestOffer: row.best_offer || null
  };
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function requestSupabase(path, init = {}, env = process.env) {
  const config = getSupabaseConfig(env);
  if (!config) {
    throw new Error("Supabase is not configured.");
  }

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...getRequestHeaders(config.apiKey),
      ...(init.headers || {})
    }
  });

  if (!response.ok) {
    const payload = await parseResponse(response);
    const detail = typeof payload === "string"
      ? payload
      : payload?.message || payload?.error_description || payload?.hint || JSON.stringify(payload);
    throw new Error(`Supabase request failed (${response.status}): ${detail}`);
  }

  return parseResponse(response);
}

async function requestSupabaseCount(path, env = process.env) {
  const config = getSupabaseConfig(env);
  if (!config) {
    throw new Error("Supabase is not configured.");
  }

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    method: "HEAD",
    headers: {
      ...getRequestHeaders(config.apiKey),
      Prefer: "count=exact",
      Range: "0-0"
    }
  });

  if (!response.ok) {
    const payload = await parseResponse(response);
    const detail = typeof payload === "string"
      ? payload
      : payload?.message || payload?.error_description || payload?.hint || JSON.stringify(payload);
    throw new Error(`Supabase request failed (${response.status}): ${detail}`);
  }

  const contentRange = response.headers.get("content-range") || "";
  const total = Number.parseInt(contentRange.split("/")[1] || "0", 10);
  return Number.isFinite(total) ? total : 0;
}

export function isSupabaseConfigured(env = process.env) {
  return Boolean(getSupabaseConfig(env));
}

export async function insertSearchEventToSupabase(entry, env = process.env) {
  const config = getSupabaseConfig(env);
  if (!config) {
    return false;
  }

  await requestSupabase("rpc/log_search_event", {
    method: "POST",
    headers: {
      Prefer: "return=minimal"
    },
    body: JSON.stringify(mapEntryToRpcPayload(entry))
  }, env);

  return true;
}

export async function insertOfferFeedbackToSupabase(entry, env = process.env) {
  const config = getSupabaseConfig(env);
  if (!config) {
    return false;
  }

  await requestSupabase(config.feedbackTable, {
    method: "POST",
    headers: {
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      query: entry.query || "",
      feedback: entry.feedback,
      offer: entry.offer || null,
      offer_title: entry.offer?.title || "",
      offer_site: entry.offer?.site || "",
      offer_url: entry.offer?.url || "",
      created_at: entry.createdAt || new Date().toISOString()
    })
  }, env);

  return true;
}

export async function readSearchEventsFromSupabase({ limit = MAX_HISTORY_ENTRIES } = {}, env = process.env) {
  const config = getSupabaseConfig(env);
  if (!config) {
    return [];
  }

  const upperBound = Math.max(0, limit - 1);
  const query = new URLSearchParams({
    select: "query,condition,provider,site_keys,searched_at,successful_marketplaces,marketplaces,total_listings,credits_used,best_offer,created_at",
    order: "searched_at.desc",
    limit: String(limit)
  });

  const rows = await requestSupabase(`${config.table}?${query.toString()}`, {
    method: "GET",
    headers: {
      Range: `0-${upperBound}`
    }
  }, env);

  return Array.isArray(rows) ? rows.map(mapRowToEntry) : [];
}

function mapCountRow(row, key) {
  return {
    value: String(row[key] || ""),
    count: Number(row.search_count || 0)
  };
}

export async function readTopQueriesFromSupabase({ limit = 12 } = {}, env = process.env) {
  const config = getSupabaseConfig(env);
  if (!config) {
    return [];
  }

  const query = new URLSearchParams({
    select: "query,search_count,last_searched_at",
    order: "search_count.desc,last_searched_at.desc",
    limit: String(limit)
  });

  const rows = await requestSupabase(`${config.queryStatsTable}?${query.toString()}`, {
    method: "GET"
  }, env);

  return Array.isArray(rows) ? rows.map((row) => mapCountRow(row, "query")) : [];
}

export async function readTopKeywordsFromSupabase({ limit = 20 } = {}, env = process.env) {
  const config = getSupabaseConfig(env);
  if (!config) {
    return [];
  }

  const query = new URLSearchParams({
    select: "keyword,search_count,last_searched_at",
    order: "search_count.desc,last_searched_at.desc",
    limit: String(limit)
  });

  const rows = await requestSupabase(`${config.keywordStatsTable}?${query.toString()}`, {
    method: "GET"
  }, env);

  return Array.isArray(rows) ? rows.map((row) => mapCountRow(row, "keyword")) : [];
}

export async function readSupabaseHistoryPayload(env = process.env) {
  const [recentSearches, topQueries, topKeywords, totalSearches, uniqueQueries, uniqueKeywords] = await Promise.all([
    readSearchEventsFromSupabase({}, env),
    readTopQueriesFromSupabase({}, env),
    readTopKeywordsFromSupabase({}, env),
    requestSupabaseCount(`${DEFAULT_TABLE}?select=id`, env),
    requestSupabaseCount(`${DEFAULT_QUERY_STATS_TABLE}?select=query`, env),
    requestSupabaseCount(`${DEFAULT_KEYWORD_STATS_TABLE}?select=keyword`, env)
  ]);

  const dailyCounts = new Map();

  for (const entry of recentSearches) {
    const day = String(entry.searchedAt || "").slice(0, 10);
    if (day) {
      dailyCounts.set(day, (dailyCounts.get(day) || 0) + 1);
    }
  }

  return {
    updatedAt: new Date().toISOString(),
    totals: {
      searches: totalSearches,
      uniqueQueries,
      uniqueKeywords
    },
    topQueries,
    topKeywords,
    dailyTrend: [...dailyCounts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([date, count]) => ({ date, count })),
    recentSearches: recentSearches.slice(0, 30)
  };
}
