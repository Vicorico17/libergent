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
