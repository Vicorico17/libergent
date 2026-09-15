const QUERY_TERM_REPLACEMENTS = new Map([
  ["anveolpe", "anvelope"],
  ["anvelpe", "anvelope"],
  ["anvlope", "anvelope"]
]);

// Match storage/RAM formatting consistently without changing the displayed title.
export function normalizeCapacityTerms(value = "") {
  return String(value).replace(/\b(\d+)\s*(gb|tb)\b/gi, (_, amount, unit) => `${amount}${unit.toLowerCase()}`);
}

export function normalizeMarketplaceQuery(query = "") {
  return String(query)
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
