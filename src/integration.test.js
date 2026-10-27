import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticateIntegration, keyHash, parseIntegrationQuery, handleIntegration, IntegrationGateway, searchIntegration, fetchIntegrationDetail } from './integration.js';
import { classifyFur, normalizeIntegrationListing } from './integration-listings.js';
import worker from './worker.js';
const token = 'lg_blana0001.' + 'a'.repeat(43);
const config = { id: 'blana', scopes: ['search:read', 'listings:details'], sites: ['olx.ro', 'publi24.ro'], perMinute: 10, perDay: 100, expiresAt: '2099-01-01T00:00:00Z' };
const request = (query = 'q=haina+blana&details=false', credential = token) => new Request(`https://example.test/api/integrations/v1/search?${query}`, { headers: { authorization: `Bearer ${credential}` } });
async function env(overrides = {}) { return { LIBERGENT_INTEGRATIONS_ENABLED: '1', LIBERGENT_INTEGRATION_KEYS: JSON.stringify([{ ...config, keyHash: await keyHash(token), ...overrides }]) }; }
function storage() {
  const data = new Map(); let tail = Promise.resolve();
  const store = { get: async k => structuredClone(data.get(k)), put: async (k,v) => data.set(k, structuredClone(v)), delete: async keys => { for (const k of Array.isArray(keys) ? keys : [keys]) data.delete(k); }, list: async ({ prefix }) => new Map([...data].filter(([k]) => k.startsWith(prefix))), transaction: fn => { const result = tail.then(() => fn(store)); tail = result.catch(() => {}); return result; } };
  return store;
}
test('credentials fail closed: absent, malformed, revoked, expired, scopes, config', async () => {
  assert.equal((await handleIntegration(request(), {})).status, 404);
  for (const bad of ['', 'session-token', token + 'x']) assert.equal((await authenticateIntegration(request(undefined, bad), await env())).response.status, 401);
  for (const change of [{ revoked: true }, { expiresAt: '2000-01-01' }, { expiresAt: 'invalid' }]) assert.equal((await authenticateIntegration(request(), await env(change))).response.status, 401);
  assert.equal((await authenticateIntegration(request(), await env({ scopes: [] }))).response.status, 403);
  assert.equal((await authenticateIntegration(request(), await env({ perDay: 0 }))).response.status, 503);
  assert.equal((await handleIntegration(request(), await env())).status, 503);
});
test('versioned Worker routing stays gated and MCP remains disabled', async () => {
  assert.equal((await worker.fetch(request(), {}, {})).status, 404);
  assert.equal((await worker.fetch(new Request('https://example.test/mcp'), {}, {})).status, 404);
});
test('strict parameters and source/detail scopes', () => {
  for (const q of ['q=x&limit=21', 'q=x&limit=1.5', 'q=x&sites=evil.test', 'q=x&sites=okazii.ro', 'q=x&refresh=1', 'q=x&q=y', 'q=x&material=genuine', 'q=x&category=coat', 'q=x&details=yes', 'q=']) {
    assert.throws(() => parseIntegrationQuery(new URL(request(q).url), config));
  }
  assert.throws(() => parseIntegrationQuery(new URL(request('q=x').url), { ...config, scopes: ['search:read'] }), /insufficient_scope/);
});
test('multilingual coat/material evidence, conservative exclusions and claims', () => {
  for (const title of ['Haina de blana naturala', 'Real fur coat', 'Manteau en fourrure naturelle']) {
    const c = classifyFur({ title }); assert.equal(c.category, 'full_fur_coat'); assert.equal(c.material, 'natural'); assert.ok(c.evidence.length); assert.equal(c.independentlyVerified, false); assert.equal(c.authenticity, null);
  }
  assert.equal(classifyFur({ title: 'Faux fur coat' }).material, 'synthetic');
  assert.equal(classifyFur({ title: 'Palton cu guler de blana naturala' }).category, 'fur_trim_only_or_ambiguous');
  assert.equal(classifyFur({ title: 'Caciula de blana' }).category, 'accessory');
  assert.equal(classifyFur({ title: 'Haina de blana' }).material, 'unknown');
  assert.equal(classifyFur({ title: 'Not real fur coat' }).material, 'unknown');
  assert.equal(classifyFur({ title: 'Faux mink fur coat' }).material, 'unknown');
  assert.equal(classifyFur({ title: 'Cumpar haina de blana naturala' }).category, 'unknown');
  assert.equal(classifyFur({ title: 'Telefon', imageUrl: 'https://test/fur-coat.jpg' }).category, 'unknown');
});
test('missing fields explicit, original images preserved, no invented availability', () => {
  const item = normalizeIntegrationListing({ title: 'Haina', url: 'https://www.olx.ro/item', imageUrl: 'https://cdn.test/1' }, 'olx.ro');
  for (const k of ['price', 'currency', 'location', 'description', 'size', 'measurements', 'material', 'lastVerifiedAt']) assert.equal(item[k], null);
  assert.deepEqual(item.galleryImages, []); assert.equal(item.availability, 'unknown'); assert.equal(item.mainImage.sourceUrl, item.url);
  assert.equal(normalizeIntegrationListing({}, 'olx.ro', { availability: 'InStock' }, '2026-01-01').availability, 'active');
  assert.equal(normalizeIntegrationListing({}, 'olx.ro', { availability: 'removed' }, '2026-01-01').availability, 'removed');
});
test('partial sources, detail failures, and filtering after enrichment', async () => {
  const p = { query: 'haina blana', sites: ['olx.ro', 'publi24.ro'], details: true, category: 'full_fur_coat', material: 'natural', limit: 20 };
  const result = await searchIntegration(p, { search: async ({ site }) => {
    if (site === undefined || site.key === 'bad') throw Error('bad');
    if (site === (await import('./sites.js')).getSite('publi24.ro')) throw Error('source failure with secret');
    return { items: [{ title: 'Haina de blana', url: 'https://www.olx.ro/item' }, { title: 'Palton cu guler blana', url: 'https://www.olx.ro/other' }] };
  }, details: async url => { if (url.endsWith('other')) throw Error('fail'); return { description: 'Blana naturala', status: 'verified' }; } });
  assert.equal(result.items.length, 1); assert.equal(result.partial, true); assert.equal(result.sources[1].error, 'source_unavailable');
});
test('timeouts bound even a noncooperative source', async () => {
  const result = await searchIntegration({ query: 'x', sites: ['olx.ro'], details: false, category: 'any', material: 'any', limit: 20 }, { search: () => new Promise(() => {}), searchTimeoutMs: 5 });
  assert.equal(result.sources[0].error, 'timeout'); assert.equal(result.partial, true);
});
test('details reject SSRF and redirects, distinguish gone and malformed/challenge HTML', async () => {
  for (const url of ['http://www.olx.ro/a', 'https://olx.ro.evil.test/a', 'https://user@olx.ro/a', 'https://127.0.0.1/a']) await assert.rejects(fetchIntegrationDetail(url, undefined, () => { throw Error('must not fetch'); }), /unsupported_url/);
  assert.equal((await fetchIntegrationDetail('https://olx.ro/a', undefined, async () => new Response('', { status: 410 }))).availability, 'removed');
  await assert.rejects(fetchIntegrationDetail('https://olx.ro/a', undefined, async () => new Response('', { status: 302 })), /detail_unavailable/);
  await assert.rejects(fetchIntegrationDetail('https://olx.ro/a', undefined, async () => new Response('<html>challenge</html>')), /detail_unverified/);
});
test('persistent quota applies atomically including cache hits across restarts', async () => {
  const state = { storage: storage() }; const e = await env({ perMinute: 2 });
  let calls = 0;
  const search = async () => { calls++; return { searchedAt: new Date().toISOString(), expiresAt: new Date(Date.now()+900000).toISOString(), sources: [{ status: 'ok' }], items: [] }; };
  const gateway = new IntegrationGateway(state, e); gateway.search = search;
  const responses = await Promise.all([gateway.fetch(request()), gateway.fetch(request()), gateway.fetch(request())]);
  assert.deepEqual(responses.map(r => r.status), [200,200,429]); assert.equal(calls, 1);
  const restarted = new IntegrationGateway(state, e); restarted.search = search;
  assert.equal((await restarted.fetch(request())).status, 429);
});
test('cache survives restart; revocation is checked before cache; daily quota independent', async () => {
  const state = { storage: storage() }; const e = await env(); let calls = 0;
  const g = new IntegrationGateway(state, e); g.search = async () => { calls++; return { searchedAt: new Date().toISOString(), expiresAt: new Date(Date.now()+900000).toISOString(), sources: [{ status: 'ok' }], items: [] }; };
  await g.fetch(request());
  const next = new IntegrationGateway(state, e);
  assert.equal((await (await next.fetch(request())).json()).cache.status, 'hit'); assert.equal(calls, 1);
  assert.equal((await new IntegrationGateway(state, await env({ revoked: true })).fetch(request())).status, 401);
  await state.storage.put('usage', { minute: 0, minuteCount: 0, day: Math.floor(Date.now()/86400000), dayCount: 100 });
  assert.equal((await next.fetch(request())).status, 429);
});
test('expired entries refresh and all-source failures never become cache hits', async () => {
  const state = { storage: storage() }; const g = new IntegrationGateway(state, await env()); let calls = 0;
  const params = parseIntegrationQuery(new URL(request().url), config);
  const key = `cache:${await keyHash(JSON.stringify(params))}`;
  await state.storage.put(key, { expiresAt: '2000-01-01T00:00:00Z' });
  g.search = async () => { calls++; return { searchedAt: new Date().toISOString(), expiresAt: new Date(Date.now()+900000).toISOString(), sources: [{ status: 'failed' }], items: [], partial: true }; };
  assert.equal((await g.fetch(request())).status, 502); assert.equal((await g.fetch(request())).status, 502); assert.equal(calls, 2);
});
test('rotation shares integration quota and changed source scopes reject cached queries', async () => {
  const state = { storage: storage() }; const rotated = 'lg_blana0002.' + 'b'.repeat(43);
  const e = await env({ perDay: 1 });
  const records = JSON.parse(e.LIBERGENT_INTEGRATION_KEYS);
  records.push({ ...records[0], keyHash: await keyHash(rotated) });
  e.LIBERGENT_INTEGRATION_KEYS = JSON.stringify(records);
  const g = new IntegrationGateway(state, e);
  g.search = async () => ({ searchedAt: new Date().toISOString(), expiresAt: new Date(Date.now()+900000).toISOString(), sources: [{ status: 'ok' }], items: [] });
  assert.equal((await g.fetch(request())).status, 200);
  assert.equal((await g.fetch(request(undefined, rotated))).status, 429);
  assert.equal((await handleIntegration(request(), await env({ sites: ['publi24.ro'] }))).status, 400);
});
test('structured detail exposes gallery, size, material, and labeled measurements', async () => {
  const html = '<script type="application/ld+json">' + JSON.stringify({ '@type': 'Product', name: 'Haina de blana', size: 'M', material: 'blana naturala', image: ['https://cdn.test/a', 'https://cdn.test/b'], additionalProperty: [{ name: 'Measurements', value: 'chest 90 cm' }], offers: { price: 120, priceCurrency: 'RON', availability: 'https://schema.org/InStock' } }) + '</script>';
  const detail = await fetchIntegrationDetail('https://olx.ro/item', undefined, async () => new Response(html));
  const listing = normalizeIntegrationListing({ url: 'https://olx.ro/item' }, 'olx.ro', detail, new Date().toISOString());
  assert.equal(listing.size, 'M'); assert.equal(listing.material, 'blana naturala'); assert.equal(listing.measurements, 'chest 90 cm'); assert.equal(listing.galleryImages.length, 1); assert.equal(listing.price, 120); assert.equal(listing.currency, 'RON');
});
test('BLANĂ adapter owns the query, keeps key server-side, hides removed listings and bounds CDN age', async () => {
  const { default: handler } = await import('../examples/blana/api/catalog.mjs');
  const previousFetch = globalThis.fetch;
  const previousOrigin = process.env.LIBERGENT_API_ORIGIN;
  const previousKey = process.env.LIBERGENT_INTEGRATION_KEY;
  process.env.LIBERGENT_API_ORIGIN = 'https://api.example.test'; process.env.LIBERGENT_INTEGRATION_KEY = token;
  const headers = {}; let code, body;
  const res = { setHeader: (k,v) => { headers[k] = v; }, status: n => { code = n; return res; }, json: data => { body = data; } };
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url.hostname, 'api.example.test'); assert.equal(url.searchParams.get('category'), 'full_fur_coat');
      assert.equal(options.headers.Authorization, `Bearer ${token}`);
      return Response.json({ apiVersion: '1', partial: false, expiresAt: new Date(Date.now()+60000).toISOString(), items: [{ availability: 'removed' }, { availability: 'unknown' }] });
    };
    await handler({ method: 'GET', url: '/api/catalog?q=evil' }, res);
    assert.equal(code, 200); assert.equal(body.items.length, 1); assert.ok(!JSON.stringify(body).includes(token));
    assert.match(headers['Vercel-CDN-Cache-Control'], /s-maxage=(59|60)$/);
    globalThis.fetch = async () => new Response('', { status: 429, headers: { 'retry-after': '20' } });
    await handler({ method: 'GET' }, res); assert.equal(code, 503); assert.equal(headers['Cache-Control'], 'no-store'); assert.equal(headers['Retry-After'], '20');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousOrigin === undefined) delete process.env.LIBERGENT_API_ORIGIN; else process.env.LIBERGENT_API_ORIGIN = previousOrigin;
    if (previousKey === undefined) delete process.env.LIBERGENT_INTEGRATION_KEY; else process.env.LIBERGENT_INTEGRATION_KEY = previousKey;
  }
});
