import test from 'node:test';
import assert from 'node:assert/strict';
import { getFreeSearchProvider, getFreeSearchSiteKeys } from './free-search-policy.js';
import { PREMIUM_SITE_KEYS, FREE_DEFAULT_SITE_KEYS, FREE_CAR_SITE_KEYS, FREE_TECH_SITE_KEYS } from './sites.js';
import { normalizeSearchProvider } from './provider-options.js';
import worker from './worker.js';

test('Free auto always resolves to direct; public requests cannot select paid providers', () => {
  for (const value of [undefined, 'auto', 'direct', ' AUTO ', 'DIRECT']) assert.equal(getFreeSearchProvider(value), 'direct');
  for (const value of ['firecrawl', 'cloudflare', ' CloudFlare ', 'browser', 'mock']) assert.throws(() => getFreeSearchProvider(value), /Unsupported provider/);
  // Do not disable paid-provider tooling for the CLI/admin pipeline.
  assert.equal(normalizeSearchProvider('firecrawl'), 'firecrawl');
});

test('Free source selection preserves conditional routing and rejects Premium or experimental sources', () => {
  const free = new Set([...FREE_DEFAULT_SITE_KEYS, ...FREE_CAR_SITE_KEYS, ...FREE_TECH_SITE_KEYS]);
  for (const source of free) assert.deepEqual(getFreeSearchSiteKeys(source), [source]);
  for (const source of PREMIUM_SITE_KEYS) assert.throws(() => getFreeSearchSiteKeys(source), /Unsupported site/);
  for (const query of ['iphone 15', 'ford mustang', 'canapea']) assert.ok(getFreeSearchSiteKeys('all', query).every(source => free.has(source)));
  assert.ok(getFreeSearchSiteKeys('all', 'ford mustang').includes('autovit.ro'));
  assert.ok(getFreeSearchSiteKeys('all', 'iphone 15').includes('flip.ro'));
  assert.throws(() => getFreeSearchSiteKeys('not-a-source'), /Unsupported site/);
});

test('both public Worker aliases reject paid work before any network, cache or browser access', async t => {
  const before = { ...process.env };
  const cache = globalThis.caches;
  t.after(() => {
    globalThis.caches = cache;
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  });
  let network = 0; let cacheReads = 0;
  t.mock.method(globalThis, 'fetch', async () => { network++; throw Error('No external calls allowed'); });
  globalThis.caches = { default: { match: async () => { cacheReads++; throw Error('Cache must not bypass eligibility'); } } };
  const env = { LIBERGENT_MOCK_SEARCH: '0', FIRECRAWL_API_KEY: 'configured-test-key', CLOUDFLARE_ACCOUNT_ID: 'configured-test-account', CLOUDFLARE_API_TOKEN: 'configured-test-token', BROWSER: {} };
  for (const path of ['/api/search', '/api/search/free']) {
    for (const suffix of ['provider=firecrawl', 'provider=cloudflare', 'provider=%20CloudFlare%20', 'site=emag.ro', 'site=altex.ro']) {
      const response = await worker.fetch(new Request(`https://libergent.test${path}?q=iphone&${suffix}`), env);
      assert.equal(response.status, 400, suffix);
      assert.match((await response.json()).error, /Unsupported (provider|site)/);
    }
  }
  assert.equal(network, 0); assert.equal(cacheReads, 0);
});

test('Free auto and direct still return results; Premium route remains authenticated', async t => {
  const before = { ...process.env };
  t.after(() => { for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key]; Object.assign(process.env, before); });
  for (const path of ['/api/search', '/api/search/free']) {
    for (const provider of ['auto', 'direct']) {
      const response = await worker.fetch(new Request(`https://libergent.test${path}?q=iphone&provider=${provider}&site=olx.ro`), { LIBERGENT_MOCK_SEARCH: '1' });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).searchTier, 'free');
    }
  }
  assert.equal((await worker.fetch(new Request('https://libergent.test/api/search/premium?q=iphone'), {})).status, 401);
});
