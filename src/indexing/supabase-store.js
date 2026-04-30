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
        `${config.indexTable}?select=indexed_at&order=indexed_at.desc&limit=1`,
        { method: "GET" },
        env
      );

      return rows?.[0]?.indexed_at || null;
    },

    async upsertDocuments(documents) {
      const payload = documents.map((doc) => ({
        listing_id: doc.listingId,
        title: doc.title,
        description: doc.description,
        searchable_text: doc.searchableText,
        condition: doc.condition,
        location: doc.location,
        price_amount: doc.priceAmount,
        price_currency: doc.priceCurrency,
        source_updated_at: doc.sourceUpdatedAt,
        indexed_at: doc.indexedAt
      }));

      await request(config.indexTable, {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        body: JSON.stringify(payload)
      }, env);
    }
  };
}
