import test from "node:test";
import assert from "node:assert/strict";
import { __testables } from "./search.js";

const { filterRelevantItems, shouldRetryDirectFetchStatus } = __testables;

test("single-token query keeps only titles that match the token", () => {
  const items = [
    { title: "Samsung Galaxy S23 Ultra", url: "https://x/1" },
    { title: "Apple iPhone 14", url: "https://x/2" }
  ];

  const filtered = filterRelevantItems(items, "samsung");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].url, "https://x/1");
});

test("matching tolerates one-character typo for longer query tokens", () => {
  const items = [
    { title: "Aspirator Rowenta Silence Force", url: "https://x/1" },
    { title: "Aspirator Philips PowerPro", url: "https://x/2" }
  ];

  const filtered = filterRelevantItems(items, "aspirator rowneta");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].url, "https://x/1");
});

test("numeric query token remains mandatory for multi-token searches", () => {
  const items = [
    { title: "Apple iPhone 13 Pro 128GB", url: "https://x/1" },
    { title: "Apple iPhone Pro Max", url: "https://x/2" }
  ];

  const filtered = filterRelevantItems(items, "iphone 13");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].url, "https://x/1");
});

test("retries transient Cloudflare origin errors with the alternate header profile", () => {
  for (const status of [520, 521, 522, 523, 524]) {
    assert.equal(shouldRetryDirectFetchStatus(status), true);
  }
});

test("direct search stops at first or later terminal page without following previous links", async (t) => {
  const { runSearch } = await import('./search.js');
  const { SITES } = await import('./sites.js');
  const originalFetch = globalThis.fetch;
  const originalMock = process.env.LIBERGENT_MOCK_SEARCH;
  process.env.LIBERGENT_MOCK_SEARCH = '0';
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalMock === undefined) delete process.env.LIBERGENT_MOCK_SEARCH;
    else process.env.LIBERGENT_MOCK_SEARCH = originalMock;
  });
  for (const lastPage of [1, 2]) {
    const fetched = [];
    globalThis.fetch = async input => {
      const page = Number(new URL(String(input)).searchParams.get('page') || 1);
      fetched.push(page);
      const pagination = page < lastPage ? `<a href="?page=${page + 1}">Next</a>` : '<a href="?page=1">Previous</a>';
      return new Response(`<div data-cy="l-card" data-testid="l-card"><a href="/d/oferta/iphone-ID${page}.html"><h4>iPhone 15 128GB</h4></a><p data-testid="ad-price">2000 lei</p></div>${pagination}`);
    };
    const result = await runSearch({ provider: 'direct', site: { ...SITES['olx.ro'], pageSize: 1, maxPages: 4 }, query: 'iphone 15', limit: 10, maxPages: 4 });
    assert.deepEqual(fetched, lastPage === 1 ? [1] : [1, 2]);
    assert.equal(result.pagesUsed, lastPage);
    assert.equal(result.exhaustedReason, 'no-next-page');
  }
});

test('pagination fills the unique-match target within source and request budgets', async (t) => {
  const { runSearch } = await import('./search.js');
  const { SITES } = await import('./sites.js');
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const cases = [
    { name: 'eight matches do not stop expansion', counts: [8, 8], limit: 80, maxPages: 2, calls: [1, 2], count: 16, reason: 'page-window' },
    { name: 'a limit smaller than page size still needs another page after filtering', counts: [8, 8], limit: 12, maxPages: 3, calls: [1, 2], count: 12, reason: 'limit' },
    { name: 'enough unique matches avoid unnecessary requests', counts: [8], limit: 8, maxPages: 3, calls: [1], count: 8, reason: 'limit' },
    { name: 'explicit one-page request is respected', counts: [8], limit: 80, maxPages: 1, calls: [1], count: 8, reason: 'page-window' },
    { name: 'source page cap is respected', counts: [8, 8], limit: 80, maxPages: 10, siteMaxPages: 2, calls: [1, 2], count: 16, reason: 'page-window' },
    { name: 'duplicates do not fill the target', counts: [8, 8, 8], repeatSecond: true, limit: 12, maxPages: 3, calls: [1, 2, 3], count: 12, reason: 'limit' },
    { name: 'later page failure preserves collected listings', counts: [8], failSecond: true, limit: 80, maxPages: 3, calls: [1, 2], count: 8, reason: 'page-error' },
    { name: 'empty first page avoids expansion even with a stray next link', counts: [0], limit: 80, maxPages: 3, calls: [1], count: 0, reason: 'empty-first-page' },
  ];
  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      const calls = [];
      globalThis.fetch = async input => {
        const page = Number(new URL(String(input)).searchParams.get('page') || 1);
        calls.push(page);
        if (scenario.failSecond && page === 2) return new Response('', { status: 403 });
        const identityPage = scenario.repeatSecond && page === 2 ? 1 : page;
        const cards = Array.from({ length: scenario.counts[page - 1] || 0 }, (_, i) =>
          `<div data-cy="l-card" data-testid="l-card"><a href="/d/oferta/iphone-ID${identityPage}-${i}.html"><h4>iPhone 15 128GB</h4></a><p data-testid="ad-price">2000 lei</p></div>`).join('');
        return new Response(`${cards || "Am găsit 0 rezultate"}<a rel="next" href="?page=${page + 1}">Next</a>`);
      };
      const result = await runSearch({ provider: 'direct', site: { ...SITES['olx.ro'], pageSize: 40, maxPages: scenario.siteMaxPages || 4 }, query: 'iphone 15', limit: scenario.limit, maxPages: scenario.maxPages });
      assert.deepEqual(calls, scenario.calls);
      assert.equal(result.itemCount, scenario.count);
      assert.equal(result.exhaustedReason, scenario.reason);
      assert.equal(result.pagesUsed, scenario.failSecond ? 1 : calls.length);
      if (scenario.failSecond) assert.match(result.pageError, /403/);
    });
  }
});
