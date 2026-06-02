import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLeadPayload } from "./leads.js";
import { insertEmailLeadToSupabase } from "./supabase.js";

test("normalizeLeadPayload normalizes valid email lead data", () => {
  const lead = normalizeLeadPayload({
    email: "  Buyer@Example.RO ",
    source: "search_results_popup",
    query: "iphone 15 pro",
    pagePath: "/search?q=iphone+15+pro"
  });

  assert.deepEqual(lead, {
    email: "buyer@example.ro",
    source: "search_results_popup",
    query: "iphone 15 pro",
    pagePath: "/search?q=iphone+15+pro"
  });
});

test("normalizeLeadPayload rejects invalid email addresses", () => {
  assert.throws(
    () => normalizeLeadPayload({ email: "not-an-email" }),
    /Expected a valid email address/
  );
});

test("normalizeLeadPayload applies safe defaults and limits", () => {
  const lead = normalizeLeadPayload({
    email: "user@example.com",
    source: "",
    query: "q".repeat(300),
    pagePath: "/".repeat(400)
  });

  assert.equal(lead.source, "search_results_popup");
  assert.equal(lead.query.length, 240);
  assert.equal(lead.pagePath.length, 300);
});

test("insertEmailLeadToSupabase upserts into email_leads", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  let capturedInit = null;

  globalThis.fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedInit = init;
    return new Response(null, { status: 201 });
  };

  try {
    const ok = await insertEmailLeadToSupabase({
      email: "Buyer@Example.RO",
      source: "search_results_popup",
      query: "iphone 15 pro",
      pagePath: "/search?q=iphone+15+pro",
      updatedAt: "2026-06-02T10:00:00.000Z"
    }, {
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SECRET_KEY: "service-role-key"
    });

    assert.equal(ok, true);
    assert.equal(capturedUrl, "https://project.supabase.co/rest/v1/email_leads?on_conflict=email");
    assert.equal(capturedInit.method, "POST");
    assert.equal(capturedInit.headers.Prefer, "resolution=merge-duplicates,return=minimal");
    assert.equal(capturedInit.headers.Authorization, "Bearer service-role-key");
    assert.deepEqual(JSON.parse(capturedInit.body), {
      email: "buyer@example.ro",
      source: "search_results_popup",
      query: "iphone 15 pro",
      page_path: "/search?q=iphone+15+pro",
      updated_at: "2026-06-02T10:00:00.000Z"
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
