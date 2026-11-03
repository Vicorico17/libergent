export function isSellerStopRequest(text = '') {
  const normalized = String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  return /^(?:please\s+)?stop[.!?\s]*$|\bnu mai (?:imi |ne |ma )?(?:trimite|scrie|contacta)\b|\bopreste\b|\b(?:do not|don't) (?:message|contact|text)\b/.test(normalized);
}
