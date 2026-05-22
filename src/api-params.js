export const MAX_API_SEARCH_LIMIT = 240;
export const MAX_API_SEARCH_PAGES = 4;
export const MAX_JSON_BODY_BYTES = 64 * 1024;
export const MAX_IMAGE_PROXY_BYTES = 5 * 1024 * 1024;
export const IMAGE_PROXY_TIMEOUT_MS = 10_000;

export function parseBoundedPositiveInteger(value, { name, max }) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected ${name} to be a positive integer.`);
  }

  return Math.min(parsed, max);
}
