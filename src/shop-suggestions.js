const URL_PATTERN = /^https?:\/\/[a-z0-9.-]+(?:\/[\S]*)?$/i;
const MAX_NAME = 100;
const MAX_URL = 500;
const MAX_NICHE = 40;
const MAX_NOTE = 800;

export function normalizeShopSuggestion(body = {}) {
  const name = String(body.name || "").trim().slice(0, MAX_NAME);
  const url = String(body.url || "").trim().slice(0, MAX_URL);
  const niche = String(body.niche || "").trim().toLowerCase().slice(0, MAX_NICHE);
  const note = String(body.note || "").trim().slice(0, MAX_NOTE);
  if (name.length < 2) throw new Error("Expected a shop name.");
  if (!URL_PATTERN.test(url)) throw new Error("Expected a valid http(s) shop URL.");
  if (niche.length < 2) throw new Error("Expected a niche.");
  return { name, url, niche, note, status: "pending" };
}

export function normalizeShopSuggestionStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (!["pending", "approved", "rejected"].includes(status)) throw new Error("Expected status pending, approved, or rejected.");
  return status;
}
