const RO_COUNTRY_CODE = "40";

function compact(value) {
  return String(value || "").replace(/[\s().-]/g, "");
}

/**
 * Normalize a Romanian mobile or fixed-line number to E.164.
 * Returns null for values that are not plausible Romanian numbers.
 */
export function normalizeRomanianPhone(value) {
  const raw = compact(value).replace(/^tel:/i, "");
  if (!raw) return null;

  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;

  if (digits.startsWith("+40")) {
    digits = digits.slice(1);
  } else if (digits.startsWith("40")) {
    // Already in international form without the plus sign.
  } else if (digits.startsWith("0")) {
    digits = `${RO_COUNTRY_CODE}${digits.slice(1)}`;
  } else {
    return null;
  }

  if (!/^40\d{9}$/.test(digits)) return null;
  return `+${digits}`;
}

/** Extract plausible Romanian phone numbers from HTML or plain text. */
export function extractRomanianPhones(value) {
  const text = String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const candidates = text.match(/(?:\+40|0040|0)\s*[2-7](?:[\s().-]*\d){8,9}/g) || [];
  return [...new Set(candidates.map(normalizeRomanianPhone).filter(Boolean))];
}

export function extractPhonesFromListing(listing = {}) {
  const values = [listing.phone, listing.phoneNumber, listing.telephone, listing.description, listing.content, listing.html];
  return [...new Set(values.flatMap(extractRomanianPhones))];
}
