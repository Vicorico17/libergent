function trimTrailingSlash(value = "") {
  return value.replace(/\/+$/, "");
}

function getConfig(env = process.env) {
  const url = trimTrailingSlash(env.SUPABASE_URL || "");
  const apiKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !apiKey) {
    return null;
  }

  return { url, apiKey };
}

function getHeaders(apiKey) {
  const headers = {
    apikey: apiKey,
    "Content-Type": "application/json"
  };

  if (!apiKey.startsWith("sb_")) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
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

async function request(path, init = {}, env = process.env) {
  const config = getConfig(env);
  if (!config) {
    throw new Error("Supabase is not configured.");
  }

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...getHeaders(config.apiKey),
      ...(init.headers || {})
    }
  });

  if (!response.ok) {
    const payload = await parseResponse(response);
    const detail = typeof payload === "string"
      ? payload
      : payload?.message || payload?.hint || payload?.error_description || JSON.stringify(payload);
    throw new Error(`Supabase request failed (${response.status}): ${detail}`);
  }

  return parseResponse(response);
}

function buildInFilter(ids) {
  return `(${ids.join(",")})`;
}

function pickLatestByListing(rows) {
  const byListing = new Map();

  for (const row of rows || []) {
    if (!row?.listing_id) {
      continue;
    }

    if (!byListing.has(row.listing_id)) {
      byListing.set(row.listing_id, row);
    }
  }

  return byListing;
}

export function isSupabaseSearchIndexConfigured(env = process.env) {
  return Boolean(getConfig(env));
}

export class SupabaseSearchIndexStore {
  constructor({ env = process.env } = {}) {
    this.env = env;
  }

  async fetchCanonicalListings({ mode, since, limit }) {
    const listingQuery = new URLSearchParams({
      select: "id,source_id,canonical_url,title,current_status,updated_at,seller:marketplace_sellers(location)",
      order: "updated_at.desc",
      limit: String(limit)
    });

    listingQuery.set("current_status", "neq.delisted");

    if (mode === "incremental" && since) {
      listingQuery.set("updated_at", `gte.${since}`);
    }

    const listings = await request(`marketplace_listings?${listingQuery.toString()}`, { method: "GET" }, this.env);
    if (!Array.isArray(listings) || listings.length === 0) {
      return [];
    }

    const sourceIds = [...new Set(listings.map((row) => row.source_id).filter(Boolean))];
    const listingIds = listings.map((row) => row.id).filter(Boolean);

    const [sources, itemSnapshots, priceSnapshots] = await Promise.all([
      sourceIds.length
        ? request(
          `marketplace_sources?${new URLSearchParams({ select: "id,source_key,source_name", id: `in.${buildInFilter(sourceIds)}` }).toString()}`,
          { method: "GET" },
          this.env
        )
        : [],
      listingIds.length
        ? request(
          `listing_item_snapshots?${new URLSearchParams({
            select: "listing_id,observed_at,title,description,listing_condition,category",
            listing_id: `in.${buildInFilter(listingIds)}`,
            order: "listing_id.asc,observed_at.desc"
          }).toString()}`,
          { method: "GET" },
          this.env
        )
        : [],
      listingIds.length
        ? request(
          `listing_price_snapshots?${new URLSearchParams({
            select: "listing_id,observed_at,amount_minor,currency_code,normalized_amount_minor,normalized_currency_code",
            listing_id: `in.${buildInFilter(listingIds)}`,
            order: "listing_id.asc,observed_at.desc"
          }).toString()}`,
          { method: "GET" },
          this.env
        )
        : []
    ]);

    const sourceById = new Map((sources || []).map((row) => [row.id, row]));
    const latestItemByListing = pickLatestByListing(itemSnapshots);
    const latestPriceByListing = pickLatestByListing(priceSnapshots);

    return listings.map((listing) => ({
      listing,
      source: sourceById.get(listing.source_id) || null,
      itemSnapshot: latestItemByListing.get(listing.id) || null,
      priceSnapshot: latestPriceByListing.get(listing.id) || null
    }));
  }

  async upsertSearchIndexDocuments(documents) {
    if (!documents.length) {
      return { upsertedCount: 0, failureCount: 0 };
    }

    await request("search_index_documents?on_conflict=listing_id", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(documents)
    }, this.env);

    return {
      upsertedCount: documents.length,
      failureCount: 0
    };
  }
}
