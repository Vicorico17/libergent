import test from 'node:test';
import assert from 'node:assert/strict';
import { runSearch } from './search.js';
import { SITES } from './sites.js';
import { normalizeListing } from './normalize.js';
import { parseOlxHtml } from './parsers/olx.js';
import { listingIdentity, uniqueListings } from './listing-identity.js';
import { needsBrowserFallback, preferBrowserFallback } from './scrape-fallback.js';
import { createScrapeTransport, retryAfterMs, readBoundedResponse } from './scrape-transport.js';
import { ScrapeCoordinator } from './scrape-coordinator.js';

const card = (id, title = 'iPhone 15 128GB', condition = '') => `<div data-cy="l-card" data-testid="l-card"><a href="/d/oferta/iphone-ID${id}.html"><h4>${title}</h4></a><p data-testid="ad-price">1.999,99 lei</p><div data-nx-name="NexusBadge">${condition}</div></div>`;
const search = options => runSearch({ provider: 'direct', site: { ...SITES['olx.ro'], pageSize: 10, maxPages: 3 }, query: 'iphone 15', limit: 2, maxPages: 3, ...options });

test('accessories cannot fill the product collection target', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => new Response(++calls === 1
    ? card('case1', 'Husa iPhone 15') + card('case2', 'Husa iPhone 15') + '<a rel="next" href="?page=2">Next</a>'
    : card('phone1') + card('phone2')));
  const result = await search();
  assert.equal(calls, 2);
  assert.equal(result.eligibleItemCount, 2);
  assert.ok(result.items.every(item => !item.title.includes('Husa')));
});

test('condition-ineligible inventory cannot fill the collection target', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => new Response(++calls === 1
    ? card('used1', undefined, 'Utilizat') + card('used2', undefined, 'Utilizat') + '<a rel="next" href="?page=2">Next</a>'
    : card('new1', undefined, 'Nou') + card('new2', undefined, 'Nou')));
  const result = await search({ condition: 'new' });
  assert.equal(calls, 2);
  assert.equal(result.eligibleItemCount, 2);
  assert.ok(result.items.every(item => item.condition === 'Nou'));
});

test('matching cards beyond the display limit are extracted from the same page', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response(card('a', 'Samsung S24') + card('b', 'Samsung S24') + card('c') + card('d')); });
  const result = await search({ maxPages: 1 });
  assert.equal(calls, 1);
  assert.equal(result.eligibleItemCount, 2);
});

test('challenge and unknown empty pages are failures; confirmed empty remains successful', async t => {
  for (const [html, outcome] of [['<title>Just a moment...</title>', 'blocked'], ['<html>New layout</html>', 'parser_failure']]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => new Response(html));
    await assert.rejects(search(), error => error.outcome === outcome);
    mock.mock.restore();
  }
  t.mock.method(globalThis, 'fetch', async () => new Response('Am găsit 0 rezultate'));
  const result = await search();
  assert.equal(result.outcome, 'empty');
  assert.equal(result.pagesUsed, 1);
});

test('OLX decimal prices reach the common price normalizer intact', () => {
  const item = parseOlxHtml(card('one'), 10).items[0];
  assert.equal(item.price, '1.999,99 lei');
  assert.equal(normalizeListing(item).numericPrice, 1999.99);
});

test('identity removes tracking but retains separate variants, sellers and sources', () => {
  assert.equal(listingIdentity({ url: 'https://www.olx.ro/d/oferta/new-slug-IDabc.html?utm_source=x' }), listingIdentity({ url: 'https://olx.ro/d/oferta/old-slug-IDabc.html#photo' }));
  const items = [{ url: 'https://shop.test/product?sku=1&seller=a&utm_source=x' }, { url: 'https://shop.test/product?seller=a&sku=1' }, { url: 'https://shop.test/product?sku=2&seller=a' }, { url: 'https://shop.test/product?sku=1&seller=b' }];
  assert.equal(uniqueListings(items).length, 3);
  assert.notEqual(listingIdentity(items[0], 'one'), listingIdentity({ url: 'https://other.test/product?sku=1&seller=a' }, 'two'));
});

test('fallback selection compares eligible products and respects confirmed empty/cooldown', () => {
  const direct = { ok: true, eligibleItemCount: 1, rawItemCount: 20, itemCount: 20 };
  const browser = { ok: true, eligibleItemCount: 3, itemCount: 3 };
  assert.equal(needsBrowserFallback(direct), true);
  assert.equal(preferBrowserFallback(direct, browser), browser);
  assert.equal(preferBrowserFallback(browser, direct), browser);
  assert.equal(needsBrowserFallback({ ok: true, outcome: 'empty', itemCount: 0 }), false);
  assert.equal(needsBrowserFallback({ ok: false, outcome: 'rate_limited' }), false);
});

test('coalesced callers get independent bodies and cancellation does not cancel other subscribers', async () => {
  let finish;
  let calls = 0;
  const transport = createScrapeTransport({ fetchImpl: async () => { calls++; return new Promise(resolve => { finish = () => resolve(new Response('same body')); }); } });
  const controller = new AbortController();
  const first = transport('https://example.test/q', { signal: controller.signal });
  const second = transport('https://example.test/q');
  controller.abort(new Error('caller cancelled'));
  await assert.rejects(first, /caller cancelled/);
  finish();
  assert.equal(await (await second).text(), 'same body');
  assert.equal(calls, 1);
});

test('source cooldowns are shared across queries and expire', async () => {
  let now = 1000;
  let calls = 0;
  const transport = createScrapeTransport({ now: () => now, fetchImpl: async () => { calls++; return new Response('slow', { status: 429, headers: { 'retry-after': '2' } }); } });
  await transport('https://example.test/one');
  await assert.rejects(transport('https://www.example.test/two'), error => error.outcome === 'rate_limited');
  assert.equal(calls, 1);
  now += 2001;
  await transport('https://example.test/two');
  assert.equal(calls, 2);
  assert.equal(retryAfterMs('Thu, 01 Jan 1970 00:00:05 GMT', 1000), 4000);
});

test('response size enforcement also bounds streamed bodies without content-length', async () => {
  await assert.rejects(readBoundedResponse(new Response('12345'), 4), /size limit/);
});

test('large OLX pages parse while other origins and oversized OLX streams stay bounded', async t => {
  const html = card('large') + '<!--' + ' '.repeat(4 * 1024 * 1024) + '-->';
  t.mock.method(globalThis, 'fetch', async () => new Response(html));
  const result = await search({ maxPages: 1 });
  assert.equal(result.items[0].title, 'iPhone 15 128GB');

  const transport = createScrapeTransport({ fetchImpl: async () => new Response(html) });
  await assert.rejects(transport('https://example.test/search'), /size limit/);
  await assert.rejects(transport('https://olx.ro.example.test/search'), /size limit/);
  const redirected = createScrapeTransport({ fetchImpl: async () => {
    const response = new Response(html);
    Object.defineProperty(response, 'url', { value: 'https://example.test/search' });
    return response;
  } });
  await assert.rejects(redirected('https://www.olx.ro/search'), /size limit/);

  const oversized = createScrapeTransport({ fetchImpl: async () => new Response(' '.repeat(8 * 1024 * 1024 + 1)) });
  await assert.rejects(oversized('https://www.olx.ro/search'), /size limit/);
});

test('shared coordinator serializes leases and retains cooldown in persistent storage', async () => {
  const map = new Map();
  let queue = Promise.resolve();
  const storage = { get: async key => structuredClone(map.get(key)), put: async (key, value) => { map.set(key, structuredClone(value)); }, transaction: callback => { const next = queue.then(() => callback(storage)); queue = next.catch(() => {}); return next; } };
  const invoke = (coordinator, path, body) => coordinator.fetch(new Request(`https://test/${path}`, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) }));
  const coordinator = new ScrapeCoordinator({ storage });
  const results = await Promise.all(Array.from({ length: 5 }, () => invoke(coordinator, 'acquire')));
  assert.equal(results.filter(r => r.status === 200).length, 2);
  assert.equal(results.filter(r => r.status === 429).length, 3);
  const { lease } = await results[0].json();
  await invoke(coordinator, 'release', { lease });
  assert.equal((await invoke(coordinator, 'acquire')).status, 200);
  await invoke(coordinator, 'cooldown', { delay: 60000 });
  const restarted = new ScrapeCoordinator({ storage });
  assert.equal((await invoke(restarted, 'acquire')).status, 429);
});

test('benchmark does not invent relevance or price accuracy without labels', async () => {
  const { summarizeScrapeCase } = await import('./scrape-benchmark.js');
  const payload = { results: [{ ok: true, items: [{ title: 'Phone', url: 'https://example.test/one', priceRon: 2000 }] }] };
  const unjudged = summarizeScrapeCase(payload, { query: 'phone', site: 'example.test', durationMs: 100 });
  assert.equal(unjudged.precisionAt10, null);
  assert.equal(unjudged.priceAccuracy, null);
  assert.equal(unjudged.originRequests, null);
  const judged = summarizeScrapeCase(payload, { query: 'phone', site: 'example.test', durationMs: 100, labels: { 'https://example.test/one': { relevant: true, expectedPriceRon: 2000 } } });
  assert.equal(judged.precisionAt10, 1);
  assert.equal(judged.priceAccuracy, 1);
});

test('aborted searches do not start origin fetches', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response(card('one')); });
  const controller = new AbortController();
  controller.abort(new DOMException('Deadline reached', 'TimeoutError'));
  await assert.rejects(search({ signal: controller.signal }));
  assert.equal(calls, 0);
});
