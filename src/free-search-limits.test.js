import test from 'node:test';
import assert from 'node:assert/strict';
import { checkFreeSearchLimits } from './free-search-limits.js';
import worker from './worker.js';

const request = (path = '/api/search?q=iphone', ip = '192.0.2.1') => new Request(`https://libergent.test${path}`, {
  headers: { 'cf-connecting-ip': ip, 'x-forwarded-for': 'spoofed' }
});
const enabled = (client, total = async () => ({ success: true })) => ({
  LIBERGENT_FREE_SEARCH_LIMITS_ENABLED: '1',
  FREE_SEARCH_CLIENT_LIMITER: { limit: client }, FREE_SEARCH_TOTAL_LIMITER: { limit: total }
});

test('Free burst limits share identity across aliases, query changes and refreshes', async () => {
  const keys = []; const totals = [];
  const env = enabled(async ({ key }) => { keys.push(key); return { success: keys.length <= 2 }; },
    async ({ key }) => { totals.push(key); return { success: true }; });
  assert.equal(await checkFreeSearchLimits(request(), env), null);
  assert.equal(await checkFreeSearchLimits(request('/api/search/free?q=car&refresh=1'), env), null);
  const denied = await checkFreeSearchLimits(request('/api/search?q=other&userId=new'), env);
  assert.equal(denied.status, 429);
  assert.equal(denied.headers.get('retry-after'), '60');
  assert.equal(denied.headers.get('cache-control'), 'no-store');
  assert.deepEqual(keys, Array(3).fill('free:ip:192.0.2.1'));
  assert.deepEqual(totals, ['free:all', 'free:all']);
});

test('shared allowance stops searches across different anonymous clients', async () => {
  const keys = [];
  const env = enabled(async () => ({ success: true }), async ({ key }) => {
    keys.push(key); return { success: keys.length === 1 };
  });
  assert.equal(await checkFreeSearchLimits(request(), env), null);
  assert.equal((await checkFreeSearchLimits(request(undefined, '192.0.2.2'), env)).status, 429);
  assert.deepEqual(keys, ['free:all', 'free:all']);
});

test('enabled limits fail closed on missing, broken or malformed bindings without exposing errors', async () => {
  for (const env of [
    { LIBERGENT_FREE_SEARCH_LIMITS_ENABLED: '1' },
    enabled(async () => { throw Error('private-provider-detail'); }),
    enabled(async () => ({})),
    enabled(async () => ({ success: true }), async () => null)
  ]) {
    const response = await checkFreeSearchLimits(request(), env);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.doesNotMatch(await response.text(), /private-provider-detail/);
  }
  assert.equal(await checkFreeSearchLimits(request(), {}), null);
});

test('Worker denies both public aliases before cache, network or asset access', async t => {
  const before = { ...process.env };
  const previousCache = globalThis.caches;
  t.after(() => {
    globalThis.caches = previousCache;
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  });
  let work = 0;
  t.mock.method(globalThis, 'fetch', async () => { work++; throw Error('Unexpected network'); });
  globalThis.caches = { default: { match: async () => { work++; throw Error('Unexpected cache'); } } };
  const env = enabled(async () => ({ success: false }));
  for (const path of ['/api/search', '/api/search/free', '/api/search/free/']) {
    for (const suffix of ['?q=iphone', '?q=iphone&refresh=1']) {
      assert.equal((await worker.fetch(request(path + suffix), env)).status, 429);
    }
  }
  assert.equal((await worker.fetch(request(), { LIBERGENT_FREE_SEARCH_LIMITS_ENABLED: '1' })).status, 503);
  // Existing API-key and Premium access checks are not replaced by this guard.
  assert.equal((await worker.fetch(request('/api/search/premium?q=iphone'), env)).status, 401);
  assert.equal(work, 0);
});

test('allowed Worker requests still return Free results with limits enabled', async t => {
  const before = { ...process.env };
  t.after(() => {
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  });
  const env = { ...enabled(async () => ({ success: true })), LIBERGENT_MOCK_SEARCH: '1' };
  const response = await worker.fetch(request('/api/search/free?q=iphone&site=olx.ro'), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).searchTier, 'free');
});
