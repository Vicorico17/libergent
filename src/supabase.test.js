import test from "node:test";
import assert from "node:assert/strict";
import { insertEmailLeadToSupabase } from "./supabase.js";

test("insertEmailLeadToSupabase accepts a public-qualified email leads table setting", async (t) => {
  const previousFetch = globalThis.fetch;
  let requestUrl = "";
  let requestBody = "";

  globalThis.fetch = async (url, init = {}) => {
    requestUrl = String(url);
    requestBody = String(init.body || "");
    return new Response(null, { status: 201 });
  };

  t.after(() => {
    globalThis.fetch = previousFetch;
  });

  await insertEmailLeadToSupabase({
    email: " Buyer@Example.RO ",
    source: "search_results_popup",
    query: "iphone 15 pro",
    pagePath: "/search?q=iphone"
  }, {
    SUPABASE_URL: "https://example.supabase.co/",
    SUPABASE_SECRET_KEY: "test-secret",
    SUPABASE_EMAIL_LEADS_TABLE: " public.email_leads "
  });

  const row = JSON.parse(requestBody);

  assert.equal(requestUrl, "https://example.supabase.co/rest/v1/email_leads?on_conflict=email");
  assert.deepEqual(row, {
    email: "buyer@example.ro",
    source: "search_results_popup",
    query: "iphone 15 pro",
    page_path: "/search?q=iphone",
    updated_at: row.updated_at
  });
});
