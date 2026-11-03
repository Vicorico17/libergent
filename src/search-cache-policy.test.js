import test from 'node:test';
import assert from 'node:assert/strict';
import { searchCacheLifetimeSeconds, isSearchCacheFresh } from './search-cache-policy.js';
import worker from './worker.js';

const complete = () => ({ results: [{ ok: true, items: [{ title: 'iPhone 15' }] }] });

test('complete snapshots last five minutes; failed sources and pages last one minute', () => {
  assert.equal(searchCacheLifetimeSeconds(complete()), 300);
  for (const failure of [{ ok: false, error: 'HTTP 403' },
    { ok: true, items: [], pageError: 'Timeout' },
    { ok: true, items: [], exhaustedReason: 'page-error' }]) {
    assert.equal(searchCacheLifetimeSeconds({ results: [...complete().results, failure] }), 60);
  }
  assert.equal(searchCacheLifetimeSeconds({ results: [...complete().results, { ok: true, items: [] }] }), 300);
});

test('empty, failed-only and malformed search snapshots are not cacheable', () => {
  for (const payload of [null, {}, { results: {} }, { results: [] }, { results: [null] },
    { results: [{ ok: true, items: [] }] }, { results: [{ ok: false }] },
    { results: [...complete().results, { ok: true, items: {} }] }]) {
    assert.equal(searchCacheLifetimeSeconds(payload), 0);
  }
});

test('read-time age checks reject old partial snapshots, missing timestamps and clock anomalies', () => {
  const now = 1_800_000_000_000;
  const partial = { results: [...complete().results, { ok: false }] };
  assert.equal(isSearchCacheFresh(partial, String(now - 59_999), now), true);
  assert.equal(isSearchCacheFresh(partial, String(now - 60_000), now), false);
  assert.equal(isSearchCacheFresh(complete(), String(now - 299_999), now), true);
  assert.equal(isSearchCacheFresh(complete(), String(now - 300_000), now), false);
  for (const stamp of [null, '', 'invalid', 'Infinity', '0', '-1', String(now + 1)]) {
    assert.equal(isSearchCacheFresh(complete(), stamp, now), false);
  }
});

test('Worker caches useful partial results briefly and searches again when they expire', async t => {
  const before = { ...process.env }; const previousCache = globalThis.caches;
  t.after(() => {
    globalThis.caches = previousCache;
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  });
  let calls = 0; const entries = new Map(); const writes = [];
  t.mock.method(globalThis, 'fetch', async url => {
    calls++;
    if (new URL(url).hostname !== 'www.olx.ro') return new Response('Unavailable', { status: 404 });
    return new Response(`<div data-cy="l-card" data-testid="l-card">
      <a href="/d/oferta/iphone-IDtest.html"><h4>iPhone 15</h4></a>
      <p data-testid="ad-price">2000 lei</p></div>`);
  });
  globalThis.caches = { default: {
    match: async request => entries.get(request.url)?.clone(),
    put: async (request, response) => { entries.set(request.url, response.clone()); }
  } };
  const run = async (path = '/api/search/free') => {
    const response = await worker.fetch(new Request(`https://libergent.test${path}?q=iphone&site=default&pages=1`),
      { LIBERGENT_MOCK_SEARCH: '0', LIBERGENT_MOCK_PROVIDER: '0' }, { waitUntil: promise => writes.push(promise) });
    await Promise.all(writes);
    assert.equal(response.status, 200);
    return response.json();
  };
  const first = await run();
  assert.equal(first.summary.cacheHit, false);
  assert.ok(first.results.some(result => !result.ok));
  assert.equal(entries.size, 1);
  const [key, cached] = [...entries][0];
  assert.equal(cached.headers.get('cache-control'), 'public, max-age=60');
  const callsAfterFirst = calls;
  assert.equal((await run('/api/search')).summary.cacheHit, true);
  assert.equal(calls, callsAfterFirst);
  // Simulate an old longer-lived entry still returned by the cache backend.
  const stale = cached.clone();
  stale.headers.set('x-libergent-cached-at', String(Date.now() - 61_000));
  stale.headers.set('cache-control', 'public, max-age=300');
  entries.set(key, stale);
  assert.equal((await run()).summary.cacheHit, false);
  assert.ok(calls > callsAfterFirst);
  const legacy = entries.get(key).clone();
  legacy.headers.delete('x-libergent-cached-at');
  entries.set(key, legacy);
  assert.equal((await run()).summary.cacheHit, false);
});
