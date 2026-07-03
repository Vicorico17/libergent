import { normalizeLeadEmail } from "./leads.js";

const MAX_QUERY_LENGTH = 240;
const MAX_PAGE_PATH_LENGTH = 300;
const MAX_SOURCE_LENGTH = 80;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

export function normalizeSavedSearchPayload(body = {}) {
  const email = normalizeLeadEmail(body.email);
  const query = normalizeText(body.query, MAX_QUERY_LENGTH);

  if (!email || !EMAIL_PATTERN.test(email)) {
    throw new Error("Expected a valid email address.");
  }
  if (!query) {
    throw new Error("Expected a search query.");
  }

  return {
    email,
    query,
    source: normalizeText(body.source, MAX_SOURCE_LENGTH) || "search_results_save",
    pagePath: normalizeText(body.pagePath, MAX_PAGE_PATH_LENGTH),
    notificationsEnabled: body.notificationsEnabled !== false
  };
}
