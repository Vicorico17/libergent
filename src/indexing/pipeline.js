function normalizeText(value) {
  return String(value || "").trim();
}

function toMinorFromDisplayPrice(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }

  const raw = String(value).replace(/\s/g, "");
  if (!raw) {
    return null;
  }

  const normalized = raw
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function toSearchText(parts) {
  return parts
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function buildSearchIndexDocument({ listing, itemSnapshot, priceSnapshot, sourceKey = "", sourceName = "" }) {
  const title = normalizeText(itemSnapshot?.title || listing?.title || "");
  const description = normalizeText(itemSnapshot?.description || "");
  const condition = normalizeText(itemSnapshot?.listing_condition || "unknown") || "unknown";
  const location = normalizeText(listing?.seller?.location || "");
  const category = normalizeText(itemSnapshot?.category || "");
  const currencyCode = String(priceSnapshot?.normalized_currency_code || priceSnapshot?.currency_code || "").toUpperCase() || null;
  const priceMinor = Number.isFinite(priceSnapshot?.normalized_amount_minor)
    ? priceSnapshot.normalized_amount_minor
    : Number.isFinite(priceSnapshot?.amount_minor)
      ? priceSnapshot.amount_minor
      : toMinorFromDisplayPrice(listing?.price_display);

  const searchableText = toSearchText([
    title,
    description,
    location,
    category,
    condition,
    sourceName,
    sourceKey
  ]);

  return {
    listing_id: listing.id,
    source_key: sourceKey,
    source_name: sourceName,
    canonical_url: listing.canonical_url,
    title,
    description,
    listing_condition: condition,
    location,
    category,
    current_status: listing.current_status || "unknown",
    normalized_price_minor: Number.isFinite(priceMinor) ? priceMinor : null,
    normalized_currency_code: currencyCode,
    observed_at: itemSnapshot?.observed_at || priceSnapshot?.observed_at || listing.updated_at || new Date().toISOString(),
    searchable_text: searchableText,
    updated_at: new Date().toISOString()
  };
}

export async function runListingsToSearchIndexing({
  store,
  mode = "incremental",
  since = null,
  limit = 500,
  logger = console
}) {
  if (!store) {
    throw new Error("store is required");
  }
  if (!["full", "incremental"].includes(mode)) {
    throw new Error(`Unsupported mode \"${mode}\"`);
  }

  const listings = await store.fetchCanonicalListings({ mode, since, limit });
  const documents = listings.map((row) =>
    buildSearchIndexDocument({
      listing: row.listing,
      itemSnapshot: row.itemSnapshot,
      priceSnapshot: row.priceSnapshot,
      sourceKey: row.source?.source_key || "",
      sourceName: row.source?.source_name || ""
    })
  );

  const result = await store.upsertSearchIndexDocuments(documents);

  logger.info({
    event: "search_indexing_completed",
    mode,
    listings_seen: listings.length,
    documents_upserted: result.upsertedCount,
    failures: result.failureCount
  });

  if (result.failureCount > 0) {
    throw new Error(`Indexing completed with failures (${result.failureCount})`);
  }

  return {
    mode,
    listingsSeen: listings.length,
    upsertedCount: result.upsertedCount,
    failureCount: result.failureCount
  };
}

export class InMemorySearchIndexStore {
  constructor(seed = []) {
    this.seed = [...seed];
    this.index = new Map();
  }

  async fetchCanonicalListings({ mode, since, limit }) {
    const sinceTs = since ? Date.parse(since) : null;

    return this.seed
      .filter((row) => {
        if (mode === "full") {
          return true;
        }
        if (!sinceTs) {
          return true;
        }

        const updatedAt = Date.parse(row?.listing?.updated_at || "");
        return Number.isFinite(updatedAt) && updatedAt >= sinceTs;
      })
      .slice(0, Math.max(1, limit));
  }

  async upsertSearchIndexDocuments(documents) {
    for (const document of documents) {
      this.index.set(document.listing_id, document);
    }

    return {
      upsertedCount: documents.length,
      failureCount: 0
    };
  }
}
