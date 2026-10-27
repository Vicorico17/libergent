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

/**
 * Source ownership and product condition are separate: a shop can sell used stock.
 * @param {{sourceType?: string|null, sellerType?: string|null, marketType?: string|null, condition?: string, title?: string}} item
 * @returns {"new" | "used" | "mixed"}
 */
export function classifyOfferKind(item = {}) {
  const text = normalized(`${item.condition || ""} ${item.title || ""}`);
  if (/\b(refurbished|reconditionat\w*|resigilat\w*|renewed|used|utilizat\w*|folosit\w*|second[ -]?hand|ca nou|like new|open[ -]?box|pre[ -]?owned)\b/.test(text)) return "used";
  const market = item.marketType || classifyMarketSegment(item);
  return market === "retail" ? "new" : market === "secondary" ? "used" : "mixed";
}

/**
 * Conservative identity evidence for a cross-market saving. Query-level keys
 * are shared by all hits and cannot prove two listings describe the same variant.
 * @param {{title?: string} | null | undefined} left
 * @param {{title?: string} | null | undefined} right
 */
export function canCompareRetailOffers(left, right) {
  if (!left?.title || !right?.title) return false;
  const identity = (title) => {
    const text = normalized(title).replace(/(s\d{2})\+/g, "$1 plus");
    const phone = text.match(/\biphone\s*(\d{1,2})(?:\s*(pro\s*max|pro|plus|mini|max|e))?\b/)
      || text.match(/\b(?:samsung\s+(?:galaxy\s+)?|galaxy\s+)(s\d{2}|a\d{2})(?:\s*(ultra|plus|fe))?\b/);
    if (phone) {
      const capacity = text.match(/\b(64|128|256|512|1024)\s*gb\b|\b(1|2)\s*tb\b/);
      if (!capacity) return null;
      return `phone:${text.includes("iphone") ? "apple" : "samsung"}:${phone[1]}:${(phone[2] || "").replace(/\s/g, "")}:${capacity[1] || Number(capacity[2]) * 1024}`;
    }
    // Other categories need the same explicit title, including size/model details.
    const key = text.replace(/\b(nou|noua|new|sigilat|folosit|utilizat|second[ -]?hand)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
    return key.length >= 8 && /\b(?:[a-z]+\d+[a-z0-9]*|\d+[a-z]+[a-z0-9]*)\b/.test(key) ? `title:${key}` : null;
  };
  const key = identity(left.title);
  return Boolean(key && key === identity(right.title));
}
