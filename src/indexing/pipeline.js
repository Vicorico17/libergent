function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, ".").replace(/[^\d.-]/g, "");
    const parsed = Number.parseFloat(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeCondition(value) {
  const text = normalizeText(value).toLowerCase();
  if (!text) {
    return "unknown";
  }

  if (/(nou|new|sigilat)/i.test(text)) {
    return "new";
  }

  if (/(folosit|second|used)/i.test(text)) {
    return "used";
  }

  return "unknown";
}

export function mapListingToIndexDocument(listing) {
  if (!listing || !listing.id) {
    throw new Error("Listing is missing required id.");
  }

  const title = normalizeText(listing.title);
  if (!title) {
    throw new Error(`Listing ${listing.id} is missing title.`);
  }

  const description = normalizeText(listing.description);
  const location = normalizeText(listing.location);
  const condition = normalizeCondition(listing.condition);
  const priceAmount = toNumber(listing.priceAmount ?? listing.price);
  const priceCurrency = normalizeText(listing.priceCurrency || listing.currency).toUpperCase() || null;

  return {
    listingId: String(listing.id),
    title,
    description,
    searchableText: [title, description, location, condition].filter(Boolean).join(" "),
    condition,
    location: location || null,
    priceAmount,
    priceCurrency,
    sourceUpdatedAt: listing.updatedAt || listing.createdAt || null,
    indexedAt: new Date().toISOString()
  };
}

export async function buildSearchIndex({
  source,
  store,
  logger = console,
  mode = "incremental"
}) {
  if (!source || typeof source.listCanonicalListings !== "function") {
    throw new Error("Indexing source is invalid.");
  }

  if (!store || typeof store.upsertDocuments !== "function") {
    throw new Error("Indexing store is invalid.");
  }

  const since = mode === "full" || typeof store.getLastIndexedAt !== "function"
    ? null
    : await store.getLastIndexedAt();

  const listings = await source.listCanonicalListings({ since });
  const documents = [];
  const failures = [];

  for (const listing of listings) {
    try {
      documents.push(mapListingToIndexDocument(listing));
    } catch (error) {
      failures.push({ listingId: listing?.id || null, error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (documents.length) {
    await store.upsertDocuments(documents);
  }

  logger.info?.("Search index build complete", {
    mode,
    since,
    readCount: listings.length,
    indexedCount: documents.length,
    failureCount: failures.length
  });

  for (const failure of failures) {
    logger.error?.("Indexing transform failure", failure);
  }

  return {
    mode,
    since,
    readCount: listings.length,
    indexedCount: documents.length,
    failureCount: failures.length,
    failures
  };
}
