import test from "node:test";
import assert from "node:assert/strict";
import { findWhatsAppConversationOwner, insertEmailLeadToSupabase, insertOfferFeedbackToSupabase, insertWhatsAppInboundToSupabase } from "./supabase.js";

test("insertOfferFeedbackToSupabase stores learning context", async (t) => {
  const originalFetch = globalThis.fetch;
  let row;
  globalThis.fetch = async (_url, init = {}) => {
    row = JSON.parse(String(init.body || "{}"));
    return new Response(null, { status: 201 });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  await insertOfferFeedbackToSupabase({
    userId: "00000000-0000-0000-0000-000000000001",
    query: "whiteboard",
    feedback: "dislike",
    reason: "part_or_accessory",
    correctionText: "tabla, nu markere",
    sessionId: "session-1",
    searchId: "search-1",
    listingFingerprint: "olx:marker-1",
    originalRank: 2,
    algorithmVersion: "feedback-loop-v1",
    appliedAction: "hide_similar_and_rerank",
    queryUnderstanding: { category: "office" },
    listingFeatures: { signatureTokens: ["marker"] },
    offer: { title: "Whiteboard markers", site: "olx.ro", url: "https://olx.ro/item" }
  }, { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SECRET_KEY: "secret" });

  assert.equal(row.user_id, "00000000-0000-0000-0000-000000000001");
  assert.equal(row.reason, "part_or_accessory");
  assert.equal(row.correction_text, "tabla, nu markere");
  assert.deepEqual(row.listing_features.signatureTokens, ["marker"]);
});

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

test("insertWhatsAppInboundToSupabase upserts inbound WhatsApp messages", async (t) => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  let capturedBody = null;
  globalThis.fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedBody = JSON.parse(init.body);
    return new Response(null, { status: 201 });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await insertWhatsAppInboundToSupabase({
    messageId: "msg-1",
    from: "+40735577052",
    to: "+40750404177",
    text: "Da, este disponibil",
    timestamp: "2026-07-15T12:00:00Z",
    raw: { source: "test" }
  }, {
    SUPABASE_URL: "https://example.supabase.co/",
    SUPABASE_SECRET_KEY: "service-role"
  });

  assert.equal(capturedUrl, "https://example.supabase.co/rest/v1/whatsapp_messages?on_conflict=message_id");
  assert.equal(capturedBody.message_id, "msg-1");
  assert.equal(capturedBody.direction, "inbound");
  assert.equal(capturedBody.from_number, "+40735577052");
  assert.equal(capturedBody.text, "Da, este disponibil");
});

test("findWhatsAppConversationOwner fails closed when a seller number belongs to multiple accounts", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify([
    { direction: "outbound", to_number: "+40735577052", raw: { userId: "user-1", listing: { title: "One" } } },
    { direction: "outbound", to_number: "+40735577052", raw: { userId: "user-2", listing: { title: "Two" } } }
  ]), { status: 200 });
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const owner = await findWhatsAppConversationOwner("+40735577052", {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "service-role"
  });

  assert.equal(owner, null);
});
