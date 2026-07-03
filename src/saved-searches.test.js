import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSavedSearchPayload } from "./saved-searches.js";
import { insertSavedSearchToSupabase } from "./supabase.js";

test("normalizeSavedSearchPayload normalizes saved search input", () => {
  const savedSearch = normalizeSavedSearchPayload({
    email: " Buyer@Example.RO ",
    query: " iphone 15 pro ",
    pagePath: "/search?q=iphone",
    notificationsEnabled: true
  });

  assert.deepEqual(savedSearch, {
    email: "buyer@example.ro",
    query: "iphone 15 pro",
    source: "search_results_save",
    pagePath: "/search?q=iphone",
    notificationsEnabled: true
  });
});

test("normalizeSavedSearchPayload requires email and query", () => {
  assert.throws(() => normalizeSavedSearchPayload({ email: "bad", query: "iphone" }), /valid email/);
  assert.throws(() => normalizeSavedSearchPayload({ email: "user@example.com", query: "" }), /search query/);
});

test("insertSavedSearchToSupabase upserts by email and query", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  let capturedInit = null;

  globalThis.fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedInit = init;
    return new Response(null, { status: 201 });
  };

  try {
    const ok = await insertSavedSearchToSupabase({
      email: "Buyer@Example.RO",
      query: "iphone 15 pro",
      source: "search_results_save",
      pagePath: "/search?q=iphone",
      notificationsEnabled: true,
      updatedAt: "2026-07-03T09:00:00.000Z"
    }, {
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SECRET_KEY: "service-role-key"
    });

    assert.equal(ok, true);
    assert.equal(capturedUrl, "https://project.supabase.co/rest/v1/saved_searches?on_conflict=email,query");
    assert.equal(capturedInit.headers.Prefer, "resolution=merge-duplicates,return=minimal");
    assert.deepEqual(JSON.parse(capturedInit.body), {
      email: "buyer@example.ro",
      query: "iphone 15 pro",
      source: "search_results_save",
      page_path: "/search?q=iphone",
      notifications_enabled: true,
      created_at: "2026-07-03T09:00:00.000Z",
      updated_at: "2026-07-03T09:00:00.000Z"
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
