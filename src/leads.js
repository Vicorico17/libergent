const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_SOURCE_LENGTH = 80;
const MAX_QUERY_LENGTH = 240;
const MAX_PAGE_PATH_LENGTH = 300;

function normalizeText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

export function normalizeLeadEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeLeadPayload(body = {}) {
  const email = normalizeLeadEmail(body.email);

  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    throw new Error("Expected a valid email address.");
  }

  return {
    email,
    source: normalizeText(body.source, MAX_SOURCE_LENGTH) || "search_results_popup",
    query: normalizeText(body.query, MAX_QUERY_LENGTH),
    pagePath: normalizeText(body.pagePath, MAX_PAGE_PATH_LENGTH)
  };
}
