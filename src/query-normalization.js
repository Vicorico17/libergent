const QUERY_TERM_REPLACEMENTS = new Map([
  ["anveolpe", "anvelope"],
  ["anvelpe", "anvelope"],
  ["anvlope", "anvelope"]
]);

export function normalizeMarketplaceQuery(query = "") {
  return String(query)
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
