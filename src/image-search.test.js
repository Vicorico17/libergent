import test from "node:test";
import assert from "node:assert/strict";
import { validateImageSearchRequest } from "./image-search.js";

test("validateImageSearchRequest accepts supported image mime types", () => {
  assert.deepEqual(
    validateImageSearchRequest({ contentType: "image/jpeg; charset=binary", contentLength: 1024 }),
    { mimeType: "image/jpeg" }
  );
});

test("validateImageSearchRequest rejects unsupported or oversized images", () => {
  assert.throws(
    () => validateImageSearchRequest({ contentType: "application/pdf", contentLength: 1024 }),
    /JPEG, PNG, or WebP/
  );
  assert.throws(
    () => validateImageSearchRequest({ contentType: "image/png", contentLength: 5 * 1024 * 1024 }),
    /too large/
  );
});
