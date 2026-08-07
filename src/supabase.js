import {
  HISTORY_DAILY_LIMIT,
  HISTORY_RECENT_LIMIT,
  HISTORY_TOP_KEYWORD_LIMIT,
  HISTORY_TOP_QUERY_LIMIT,
  MAX_HISTORY_ENTRIES
} from "./history-base.js";

const DEFAULT_TABLE = "search_events";
const DEFAULT_QUERY_STATS_TABLE = "search_query_stats";
const DEFAULT_KEYWORD_STATS_TABLE = "keyword_stats";
const DEFAULT_FEEDBACK_TABLE = "offer_feedback";
const DEFAULT_EMAIL_LEADS_TABLE = "email_leads";
const DEFAULT_SAVED_SEARCHES_TABLE = "saved_searches";
const DEFAULT_WHATSAPP_MESSAGES_TABLE = "whatsapp_messages";
const DEFAULT_VEHICLE_PRICE_OBSERVATIONS_TABLE = "vehicle_price_observations";
const DEFAULT_SHOP_SUGGESTIONS_TABLE = "shop_suggestions";

function trimTrailingSlash(value = "") {
  return value.replace(/\/+$/, "");
}

function normalizePublicRestTableName(value, fallback) {
  const tableName = String(value || fallback).trim();
  return tableName.startsWith("public.") ? tableName.slice("public.".length) : tableName;
}

function getSupabaseConfig(env = process.env) {
  const url = trimTrailingSlash(env.SUPABASE_URL || "");
  const apiKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";
  const table = normalizePublicRestTableName(env.SUPABASE_SEARCH_EVENTS_TABLE, DEFAULT_TABLE);
  const queryStatsTable = normalizePublicRestTableName(env.SUPABASE_QUERY_STATS_TABLE, DEFAULT_QUERY_STATS_TABLE);
  const keywordStatsTable = normalizePublicRestTableName(env.SUPABASE_KEYWORD_STATS_TABLE, DEFAULT_KEYWORD_STATS_TABLE);
  const feedbackTable = normalizePublicRestTableName(env.SUPABASE_FEEDBACK_TABLE, DEFAULT_FEEDBACK_TABLE);
  const emailLeadsTable = normalizePublicRestTableName(env.SUPABASE_EMAIL_LEADS_TABLE, DEFAULT_EMAIL_LEADS_TABLE);
  const savedSearchesTable = normalizePublicRestTableName(env.SUPABASE_SAVED_SEARCHES_TABLE, DEFAULT_SAVED_SEARCHES_TABLE);
  const whatsappMessagesTable = normalizePublicRestTableName(env.SUPABASE_WHATSAPP_MESSAGES_TABLE, DEFAULT_WHATSAPP_MESSAGES_TABLE);
  const vehiclePriceObservationsTable = normalizePublicRestTableName(env.SUPABASE_VEHICLE_PRICE_OBSERVATIONS_TABLE, DEFAULT_VEHICLE_PRICE_OBSERVATIONS_TABLE);
  const shopSuggestionsTable = normalizePublicRestTableName(env.SUPABASE_SHOP_SUGGESTIONS_TABLE, DEFAULT_SHOP_SUGGESTIONS_TABLE);

  if (!url || !apiKey) {
    return null;
  }

  return { url, apiKey, table, queryStatsTable, keywordStatsTable, feedbackTable, emailLeadsTable, savedSearchesTable, whatsappMessagesTable, vehiclePriceObservationsTable, shopSuggestionsTable };
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

export async function insertShopSuggestionToSupabase(suggestion, env = process.env) {
  const config = getSupabaseConfig(env);
  if (!config) return false;
  await requestSupabase(config.shopSuggestionsTable, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(suggestion)
  }, env);
  return true;
}

export async function listShopSuggestionsFromSupabase(env = process.env) {
  const config = getSupabaseConfig(env);
  if (!config) throw new Error("Supabase is not configured.");
  return requestSupabase(`${config.shopSuggestionsTable}?select=*&order=created_at.desc`, {}, env);
}

export async function updateShopSuggestionStatusInSupabase(id, status, env = process.env) {
  const config = getSupabaseConfig(env);
  if (!config) throw new Error("Supabase is not configured.");
  await requestSupabase(`${config.shopSuggestionsTable}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status, reviewed_at: new Date().toISOString() })
  }, env);
  return true;
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

  const createdAt = entry.createdAt || new Date().toISOString();
  const feedbackRow = {
    query: entry.query || "",
    feedback: entry.feedback,
    reason: entry.reason || entry.offer?.reason || "",
    offer: entry.offer || null,
    offer_title: entry.offer?.title || "",
    offer_site: entry.offer?.site || "",
    offer_url: entry.offer?.url || "",
    created_at: createdAt
  };

  try {
    await requestSupabase(config.feedbackTable, {
      method: "POST",
      headers: {
        Prefer: "return=minimal"
      },
      body: JSON.stringify(feedbackRow)
    }, env);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("offer_feedback") && !message.includes("schema cache")) {
      throw error;
    }

    await requestSupabase("rpc/log_search_event", {
      method: "POST",
      headers: {
        Prefer: "return=minimal"
      },
      body: JSON.stringify(mapEntryToRpcPayload({
        query: `feedback:${entry.query || ""}`,
        condition: entry.feedback,
        provider: "feedback",
        siteKeys: entry.offer?.site ? [entry.offer.site] : [],
        searchedAt: createdAt,
        successfulMarketplaces: 0,
        marketplaces: 0,
        totalListings: 0,
        creditsUsed: 0,
        bestOffer: {
          feedback: entry.feedback,
          query: entry.query || "",
          offer: entry.offer || null,
          storageFallback: "search_events"
        }
      }))
    }, env);
  }

  return true;
}

export async function insertEmailLeadToSupabase(entry, env = process.env) {
  const config = getSupabaseConfig(env);
  if (!config) {
    return false;
  }

  const now = entry.updatedAt || new Date().toISOString();
  const row = {
    email: String(entry.email || "").trim().toLowerCase(),
    source: entry.source || "search_results_popup",
    query: entry.query || "",
    page_path: entry.pagePath || "",
    updated_at: now
  };

  await requestSupabase(`${config.emailLeadsTable}?on_conflict=email`, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(row)
  }, env);

  return true;
}

export async function insertSavedSearchToSupabase(entry, env = process.env) {
  const config = getSupabaseConfig(env);
  if (!config) {
    return false;
  }

  const now = entry.updatedAt || new Date().toISOString();
  const row = {
    email: String(entry.email || "").trim().toLowerCase(),
    query: entry.query || "",
    source: entry.source || "search_results_save",
    page_path: entry.pagePath || "",
    notifications_enabled: entry.notificationsEnabled !== false,
    created_at: entry.createdAt || now,
    updated_at: now
  };

  await requestSupabase(`${config.savedSearchesTable}?on_conflict=email,query`, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(row)
  }, env);

  return true;
}

export async function insertVehiclePriceObservations(listings = [], env = process.env) {
  const config = getSupabaseConfig(env);
  if (!config) return false;
  const observedAt = new Date().toISOString();
  const observedDay = observedAt.slice(0, 10);
  const rows = listings
    .filter((listing) => listing?.url && Number.isFinite(Number(listing.price ?? listing.priceRon ?? listing.numericPrice)))
    .map((listing) => ({
      listing_url: String(listing.url),
      source: String(listing.site || ""),
      title: String(listing.title || ""),
      price_ron: Math.round(Number(listing.priceRon ?? listing.numericPrice ?? listing.price)),
      observed_at: observedAt,
      observed_day: observedDay
    }));
  if (!rows.length) return false;
  await requestSupabase(`${config.vehiclePriceObservationsTable}?on_conflict=listing_url,observed_day`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows)
  }, env);
  return true;
}

export async function readVehiclePriceHistoryFromSupabase(listingUrl, env = process.env) {
  const config = getSupabaseConfig(env);
  if (!config || !listingUrl) return null;
  const query = new URLSearchParams({
    select: "price_ron,observed_at,observed_day",
    listing_url: `eq.${listingUrl}`,
    order: "observed_at.asc",
    limit: "180"
  });
  const rows = await requestSupabase(`${config.vehiclePriceObservationsTable}?${query.toString()}`, { method: "GET" }, env);
  if (!Array.isArray(rows) || !rows.length) return null;
  const observations = rows.map((row) => ({ priceRon: Number(row.price_ron), observedAt: row.observed_at || row.observed_day })).filter((row) => Number.isFinite(row.priceRon));
  if (!observations.length) return null;
  const initial = observations[0];
  const latest = observations[observations.length - 1];
  const firstMs = new Date(initial.observedAt).getTime();
  return {
    observations,
    firstObservedAt: initial.observedAt,
    lastObservedAt: latest.observedAt,
    daysOnMarket: Number.isFinite(firstMs) ? Math.max(0, Math.floor((Date.now() - firstMs) / 86400000)) : null,
    initialPriceRon: initial.priceRon,
    latestPriceRon: latest.priceRon,
    priceChangeRon: latest.priceRon - initial.priceRon,
    priceChangePct: initial.priceRon ? Math.round(((latest.priceRon - initial.priceRon) / initial.priceRon) * 1000) / 10 : null
  };
}

export async function insertWhatsAppInboundToSupabase(entry, env = process.env) {
  const config = getSupabaseConfig(env);
  if (!config) {
    return false;
  }

  const timestamp = entry.timestamp || new Date().toISOString();
  const from = String(entry.from || "").trim();
  const text = String(entry.text || "").trim();
  const messageId = String(entry.messageId || entry.message_id || `${from}:${timestamp}:${text}`).trim();
  const row = {
    message_id: messageId,
    direction: "inbound",
    channel: entry.channel || "whatsapp",
    from_number: from,
    to_number: String(entry.to || entry.to_number || "").trim(),
    text,
    received_at: timestamp,
    raw: entry.raw || null,
    created_at: entry.createdAt || new Date().toISOString()
  };

  await requestSupabase(`${config.whatsappMessagesTable}?on_conflict=message_id`, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(row)
  }, env);

  return true;
}

export async function insertWhatsAppOutboundToSupabase(entry, env = process.env) {
  const config = getSupabaseConfig(env);
  if (!config) return false;

  const timestamp = entry.timestamp || new Date().toISOString();
  const to = String(entry.to || entry.to_number || "").trim();
  const text = String(entry.text || "").trim();
  const messageId = String(entry.messageId || entry.message_id || `outbound:${to}:${timestamp}`).trim();
  const row = {
    message_id: messageId,
    direction: "outbound",
    channel: entry.channel || "whatsapp",
    from_number: String(entry.from || entry.from_number || "libergent-agent").trim(),
    to_number: to,
    text,
    received_at: timestamp,
    raw: entry.raw || null,
    created_at: entry.createdAt || new Date().toISOString()
  };

  await requestSupabase(`${config.whatsappMessagesTable}?on_conflict=message_id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row)
  }, env);
  return true;
}

export async function readWhatsAppMessagesFromSupabase({ limit = 500, userId = "", sellerPhone = "", direction = "" } = {}, env = process.env) {
  const config = getSupabaseConfig(env);
  if (!config) return [];
  const query = new URLSearchParams({
    select: "message_id,direction,channel,from_number,to_number,text,received_at,raw,created_at",
    order: "received_at.asc",
    limit: String(Math.max(1, Math.min(limit, 1000)))
  });
  if (userId) query.set("raw->>userId", `eq.${userId}`);
  if (sellerPhone) query.set("to_number", `eq.${sellerPhone}`);
  if (direction) query.set("direction", `eq.${direction}`);
  const rows = await requestSupabase(`${config.whatsappMessagesTable}?${query.toString()}`, { method: "GET" }, env);
  return Array.isArray(rows) ? rows : [];
}

export async function findWhatsAppConversationOwner(sellerPhone, env = process.env) {
  const rows = await readWhatsAppMessagesFromSupabase({ limit: 1000, sellerPhone, direction: "outbound" }, env);
  const matchingOutbound = rows.filter((row) =>
    row.direction === "outbound" &&
    String(row.to_number || "").trim() === String(sellerPhone || "").trim() &&
    row.raw?.userId
  );
  const ownerIds = new Set(matchingOutbound.map((row) => String(row.raw.userId)));
  if (ownerIds.size !== 1) return null;
  return matchingOutbound[matchingOutbound.length - 1]?.raw || null;
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

export async function readTopQueriesFromSupabase({ limit = HISTORY_TOP_QUERY_LIMIT } = {}, env = process.env) {
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

export async function readTopKeywordsFromSupabase({ limit = HISTORY_TOP_KEYWORD_LIMIT } = {}, env = process.env) {
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
  const config = getSupabaseConfig(env);
  if (!config) {
    throw new Error("Supabase is not configured.");
  }

  const [recentSearches, topQueries, topKeywords, totalSearches, uniqueQueries, uniqueKeywords] = await Promise.all([
    readSearchEventsFromSupabase({}, env),
    readTopQueriesFromSupabase({}, env),
    readTopKeywordsFromSupabase({}, env),
    requestSupabaseCount(`${config.table}?select=id`, env),
    requestSupabaseCount(`${config.queryStatsTable}?select=query`, env),
    requestSupabaseCount(`${config.keywordStatsTable}?select=keyword`, env)
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
      .slice(-HISTORY_DAILY_LIMIT)
      .map(([date, count]) => ({ date, count })),
    recentSearches: recentSearches.slice(0, HISTORY_RECENT_LIMIT)
  };
}
