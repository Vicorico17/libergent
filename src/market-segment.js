const RETAIL_SOURCE_TYPES = new Set(["price_aggregator", "retailer"]);

function normalized(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Classify the transaction market, not just the website.
 *
 * retail    = business/new inventory or a price benchmark
 * secondary = person-to-person/used inventory
 * mixed     = marketplace source with no reliable seller classification
 */
export function classifyMarketSegment(item = {}) {
  const sourceType = normalized(item.sourceType || "classifieds");
  const sellerType = normalized(item.sellerType);

  if (RETAIL_SOURCE_TYPES.has(sourceType)) return "retail";

  if (sourceType === "retailer_marketplace") {
    if (/persoana|privat|individual|private|user/.test(sellerType)) return "secondary";
    if (/magazin|profesionist|business|retailer|commerci|company|firma|store/.test(sellerType)) return "retail";
    return "mixed";
  }

  if (sourceType === "classifieds" || sourceType === "marketplace" || sourceType === "automotive") {
    return "secondary";
  }

  return sellerType && /persoana|privat|individual|private|user/.test(sellerType)
    ? "secondary"
    : "mixed";
}

export function isRetailMarket(item) {
  return classifyMarketSegment(item) === "retail";
}

export function isSecondaryMarket(item) {
  return classifyMarketSegment(item) === "secondary";
}
