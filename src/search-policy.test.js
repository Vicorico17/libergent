import test from "node:test";
import assert from "node:assert/strict";
import { buildHistoryPayloadFromEntries } from "./history-base.js";
import { getSearchQueryError, isPublicSearchQuery } from "./search-policy.js";
import worker from "./worker.js";
import { readSupabaseHistoryPayload } from "./supabase.js";

test("rejects offensive words, obfuscated words, and personal data", () => {
  for (const query of ["iphone muie", "m.u.i.e", "F U C K", "c căcat", "ion@example.com", "+40 712 345 678"]) {
    assert.ok(getSearchQueryError(query), query);
    assert.equal(isPublicSearchQuery(query), false);
  }
});

test("keeps ordinary product searches and whole-word matches", () => {
  for (const query of ["pulover negru", "bass guitar", "iphone 15 pro 256gb", "mașină de cusut"]) {
    assert.equal(getSearchQueryError(query), null, query);
    assert.equal(isPublicSearchQuery(query), true);
  }
});

test("bounds public search text with a useful error", () => {
  assert.match(getSearchQueryError("a".repeat(121)), /120 de caractere/);
});

test("old unsuitable entries are removed from every public history list", () => {
  const payload = buildHistoryPayloadFromEntries([
    { query: "iphone muie", searchedAt: "2026-09-28T12:00:00Z" },
    { query: "ion@example.com", searchedAt: "2026-09-28T11:00:00Z" },
    { query: "iphone 15", searchedAt: "2026-09-28T10:00:00Z" }
  ]);
  assert.equal(payload.totals.searches, 1);
  assert.deepEqual(payload.recentSearches.map((entry) => entry.query), ["iphone 15"]);
  assert.deepEqual(payload.topQueries.map((entry) => entry.value), ["iphone 15"]);
  assert.deepEqual(payload.topKeywords.map((entry) => entry.value), ["iphone"]);
  assert.deepEqual(payload.dailyTrend, [{ date: "2026-09-28", count: 1 }]);
});

test("Free API rejects unsuitable queries before marketplace work", async () => {
  const response = await worker.fetch(new Request("https://libergent.test/api/search/free?q=iphone%20muie"), {
    LIBERGENT_MOCK_SEARCH: "1"
  });
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.match(payload.error, /limbaj ofensator/);
});

test("Supabase history filters existing query and keyword stats", async (t) => {
  const previousFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = previousFetch; });
  globalThis.fetch = async (requestUrl, init = {}) => {
    if (init.method === "HEAD") return new Response(null, { headers: { "content-range": "0-0/3" } });
    const pathname = new URL(requestUrl).pathname;
    const rows = pathname.endsWith("/search_events")
      ? [
          { query: "iphone muie", searched_at: "2026-09-28T12:00:00Z" },
          { query: "iphone 15", searched_at: "2026-09-28T11:00:00Z" }
        ]
      : pathname.endsWith("/search_query_stats")
        ? [{ query: "iphone muie", search_count: 10 }, { query: "iphone 15", search_count: 2 }]
        : [{ keyword: "muie", search_count: 10 }, { keyword: "iphone", search_count: 12 }];
    return Response.json(rows);
  };
  const payload = await readSupabaseHistoryPayload({ SUPABASE_URL: "https://example.supabase.co", SUPABASE_SECRET_KEY: "test" });
  assert.deepEqual(payload.recentSearches.map((entry) => entry.query), ["iphone 15"]);
  assert.deepEqual(payload.topQueries.map((entry) => entry.value), ["iphone 15"]);
  assert.deepEqual(payload.topKeywords.map((entry) => entry.value), ["iphone"]);
  assert.deepEqual(payload.dailyTrend, [{ date: "2026-09-28", count: 1 }]);
});
