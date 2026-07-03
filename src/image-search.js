const MAX_IMAGE_SEARCH_BYTES = 4 * 1024 * 1024;
const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateImageSearchRequest({ contentType = "", contentLength = 0 } = {}) {
  const mimeType = contentType.split(";")[0].trim().toLowerCase();

  if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error("Expected a JPEG, PNG, or WebP image.");
  }
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_SEARCH_BYTES) {
    throw new Error("Image is too large.");
  }

  return { mimeType };
}

export async function extractImageSearchIntent() {
  throw new Error("Image search provider is not configured yet.");
}
