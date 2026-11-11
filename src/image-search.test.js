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

const { handleImageSearch, extractImageSearchIntent } = await import('./image-search.js');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const photoRequest = (body = png, headers = {}) => new Request('https://example.com/api/image-search', { method: 'POST', headers: { 'content-type': 'image/png', ...headers }, body });
const env = { GROQ_API_KEY: 'test-secret' };
const provider = (content) => async () => Response.json({ choices: [{ message: { content: JSON.stringify(content) } }] });

test('photo request sends actual bytes server-side and returns an editable query', async () => {
  const response = await handleImageSearch(photoRequest(), env, async (url, init) => {
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(init.headers.authorization, 'Bearer test-secret');
    const body = JSON.parse(init.body);
    assert.equal(body.messages[0].content[1].image_url.url, `data:image/png;base64,${png.toString('base64')}`);
    assert.equal(body.response_format.type, 'json_object');
    return provider({ query: '  scaun   birou ', confidence: 'high' })();
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { ok: true, query: 'scaun birou', confidence: 'high' });
});

test('rejects spoofed image bodies and actual oversize bodies without trusting content-length', async () => {
  for (const [body, expected] of [[Buffer.from('not a photo'), 400], [Buffer.alloc(4 * 1024 * 1024 + 1), 413]]) {
    const response = await handleImageSearch(photoRequest(body), env, () => assert.fail('must not call provider'));
    assert.equal(response.status, expected);
  }
});

test('maps unavailable provider, empty identification, invalid JSON and rate limits without leaking provider details', async () => {
  for (const [fetchImpl, expected] of [
    [provider({ query: '', confidence: 'low' }), 422],
    [provider({ query: 42, confidence: 'high' }), 502],
    [async () => Response.json({ choices: [] }), 502],
    [async () => new Response('secret-provider-debug', { status: 401 }), 502],
    [async () => new Response('quota', { status: 429 }), 429],
    [async () => { throw new Error('network secret'); }, 504]
  ]) {
    const response = await handleImageSearch(photoRequest(), env, fetchImpl);
    assert.equal(response.status, expected);
    assert.doesNotMatch(await response.text(), /secret/);
  }
});

test('missing configuration and non-POST requests never reach provider', async () => {
  assert.equal((await handleImageSearch(photoRequest(), {}, () => assert.fail())).status, 503);
  assert.equal((await handleImageSearch(new Request('https://example.com/api/image-search'), env)).status, 405);
});

test('enabled edge limits fail closed and block requests before recognition', async () => {
  assert.equal((await handleImageSearch(photoRequest(), { ...env, IMAGE_SEARCH_LIMITS_ENABLED: '1' })).status, 503);
  const response = await handleImageSearch(photoRequest(), { ...env, IMAGE_SEARCH_LIMITS_ENABLED: '1',
    IMAGE_SEARCH_CLIENT_LIMITER: { limit: async () => ({ success: false }) },
    IMAGE_SEARCH_TOTAL_LIMITER: { limit: () => assert.fail('blocked clients must not use shared quota') }
  }, () => assert.fail());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '60');
});
