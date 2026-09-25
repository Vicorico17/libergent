const QUERY_TERM_REPLACEMENTS = new Map([
  ["anveolpe", "anvelope"],
  ["anvelpe", "anvelope"],
  ["anvlope", "anvelope"]
]);

// Normalize known product families in both user input and listing text.
// Preserve model numbers and variant names instead of guessing another model.
export function normalizeModelTerms(value = "") {
  return String(value)
    .replace(/\b(rtx|gtx)[\s-]*(\d{3,4})(?:[\s-]*(ti|super))?\b/gi,
      (_, family, model, variant) => `${family} ${model}${variant ? ` ${variant}` : ""}`)
    .replace(/\biphone[\s-]*(\d{1,2})(?:[\s-]*(pro[\s-]*max|pro|plus|mini|max))?\b/gi,
      (_, model, variant) => `iphone ${model}${variant ? ` ${variant.replace(/pro[\s-]*max/i, "pro max")}` : ""}`)
    .replace(/\b(samsung)[\s-]*(?=galaxy\b|galaxy[sa]\d|[sa][\s-]*\d{2}\b)/gi, "$1 ")
    .replace(/\bgalaxy[\s-]*([sa])[\s-]*(\d{2})(?:[\s-]*(ultra|plus|fe))?\b/gi,
      (_, family, model, variant) => `galaxy ${family}${model}${variant ? ` ${variant}` : ""}`);
}

// Match storage/RAM formatting consistently without changing the displayed title.
export function normalizeCapacityTerms(value = "") {
  return String(value).replace(/\b(\d+)\s*(gb|tb)\b/gi, (_, amount, unit) => `${amount}${unit.toLowerCase()}`);
}

export function normalizeMarketplaceQuery(query = "") {
  return normalizeCapacityTerms(normalizeModelTerms(query))
    .replace(/\bchrome\s+hearths\b/gi, "chrome hearts")
    .split(/(\s+)/)
    .map((part) => {
      const normalized = part
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return QUERY_TERM_REPLACEMENTS.get(normalized) || part;
    })
    .join("")
    .trim();
}
