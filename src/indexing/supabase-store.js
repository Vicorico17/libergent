function trimTrailingSlash(value = "") {
  return value.replace(/\/+$/, "");
}

function getConfig(env = process.env) {
  const url = trimTrailingSlash(env.SUPABASE_URL || "");
  const apiKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !apiKey) {
    return null;
  }

  return {
    url,
    apiKey,
    canonicalTable: env.SUPABASE_CANONICAL_LISTINGS_TABLE || "canonical_listings",
    indexTable: env.SUPABASE_SEARCH_INDEX_TABLE || "search_index_documents"
  };
}

function getHeaders(apiKey, extra = {}) {
  const headers = {
    apikey: apiKey,
    "Content-Type": "application/json",
    ...extra
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
    throw new Error("Supabase indexing is not configured.");
  }

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: getHeaders(config.apiKey, init.headers || {})
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

function mapRowToCanonicalListing(row) {
  return {
    id: row.listing_id || row.id,
    title: row.title,
    description: row.description,
    priceAmount: row.price_amount,
    priceCurrency: row.price_currency,
    condition: row.condition,
    location: row.location,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
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

export function createSupabaseIndexingSource(env = process.env) {
  const config = getConfig(env);
  if (!config) {
    throw new Error("Supabase indexing is not configured.");
  }

  return {
    async listCanonicalListings({ since = null } = {}) {
      const filters = [
        "select=listing_id,id,title,description,price_amount,price_currency,condition,location,created_at,updated_at",
        "order=updated_at.asc",
        "limit=5000"
      ];

      if (since) {
        filters.push(`updated_at=gt.${encodeURIComponent(since)}`);
      }

      const path = `${config.canonicalTable}?${filters.join("&")}`;
      const rows = await request(path, { method: "GET" }, env);
      return (rows || []).map(mapRowToCanonicalListing);
    }
  };
}

export function createSupabaseIndexingStore(env = process.env) {
  const config = getConfig(env);
  if (!config) {
    throw new Error("Supabase indexing is not configured.");
  }

  return {
    async getLastIndexedAt() {
      const rows = await request(
        `${config.indexTable}?select=updated_at&order=updated_at.desc&limit=1`,
        { method: "GET" },
        env
      );

      return rows?.[0]?.updated_at || null;
    },

    async upsertDocuments(documents) {
      const payload = documents.map((doc) => ({
        listing_id: doc.listingId,
        source_key: "canonical",
        source_name: "Canonical",
        canonical_url: "",
        title: doc.title,
        description: doc.description,
        searchable_text: doc.searchableText,
        listing_condition: doc.condition,
        location: doc.location || "",
        category: "",
        current_status: "active",
        normalized_price_minor: Number.isFinite(doc.priceAmount) ? Math.round(doc.priceAmount * 100) : null,
        normalized_currency_code: doc.priceCurrency,
        observed_at: doc.sourceUpdatedAt || doc.indexedAt,
        updated_at: doc.indexedAt
      }));

      await request(`${config.indexTable}?on_conflict=listing_id`, {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        body: JSON.stringify(payload)
      }, env);
    }
  };
}
