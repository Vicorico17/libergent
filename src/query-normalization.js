const QUERY_TERM_REPLACEMENTS = new Map([
  ["anveolpe", "anvelope"],
  ["anvelpe", "anvelope"],
  ["anvlope", "anvelope"]
]);

// GPU model spacing varies between user input and marketplace titles.
// Keep the model digits intact so 5090 cannot become a match for 5080.
export function normalizeModelTerms(value = "") {
  return String(value).replace(/\b(rtx|gtx)[\s-]*(\d{3,4})\b/gi, "$1 $2");
}

// Match storage/RAM formatting consistently without changing the displayed title.
export function normalizeCapacityTerms(value = "") {
  return String(value).replace(/\b(\d+)\s*(gb|tb)\b/gi, (_, amount, unit) => `${amount}${unit.toLowerCase()}`);
}

export function normalizeMarketplaceQuery(query = "") {
  return normalizeModelTerms(query)
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
