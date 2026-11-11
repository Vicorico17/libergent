import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.js";
import { normalizeOfferFeedbackPayload } from "./feedback.js";
import { handleFeedbackApp } from "./feedback-app.js";
import { insertOfferFeedbackToSupabase } from "./supabase.js";

const id = "00000000-0000-0000-0000-000000000001";
const env = { SUPABASE_URL: "https://feedback.test", SUPABASE_SECRET_KEY: "test", LIBERGENT_FEEDBACK_REVIEWER_IDS: "reviewer" };
const row = { id, user_id: "owner", query: "mustang", feedback: "dislike", reason: "wrong_product", listing_fingerprint: "listing-1", offer: { title: "Machetă Ford Mustang 1:24", priceRon: 120, price: "120 lei" } };
function mock(t, fn) {
  const previous = globalThis.fetch;
  globalThis.fetch = fn;
  t.after(() => { globalThis.fetch = previous; });
}

test("feedback endpoints require authentication and a server-configured reviewer", async (t) => {
  mock(t, async () => Response.json({ id: "owner", app_metadata: { role: "admin" } }));
  for (const path of ["/api/feedback", "/api/feedback/review"]) {
    assert.equal((await worker.fetch(new Request(`https://app.test${path}`), env)).status, 401);
  }
  const response = await worker.fetch(new Request("https://app.test/api/feedback/review", { headers: { authorization: "Bearer token" } }), env);
  assert.equal(response.status, 403);
});

test("personal list is bounded, owner scoped and literal-query filtered", async (t) => {
  mock(t, async url => {
    const params = new URL(url).searchParams;
    assert.equal(params.get("user_id"), "eq.owner");
    assert.equal(params.get("query"), "eq.100%_*");
    assert.equal(params.get("limit"), "201");
    return Response.json([{ ...row, offer: { ...row.offer, review: { reviewedBy: "secret" } } }]);
  });
  const result = await handleFeedbackApp({ method: "GET", userId: "owner", query: "100%_*" }, env);
  assert.equal(result.status, 200);
  assert.equal(result.payload.rows.length, 1);
  assert.equal(result.payload.rows[0].review, undefined);
  assert.equal(result.payload.rows[0].user_id, undefined);
});

test("cannot delete another account's report and repeated own reports are restored together", async (t) => {
  let deleted = false;
  mock(t, async (url, init = {}) => {
    const params = new URL(url).searchParams;
    assert.equal(params.get("user_id"), "eq.owner");
    if (init.method === "DELETE") {
      deleted = true;
      assert.equal(params.get("listing_fingerprint"), "eq.listing-1");
      assert.equal(params.get("query"), "eq.mustang");
      return new Response(null, { status: 204 });
    }
    return Response.json(params.get("id") === `eq.${id}` ? [row] : []);
  });
  const denied = await handleFeedbackApp({ method: "DELETE", userId: "owner", body: { id: "00000000-0000-0000-0000-000000000002", userId: "other" } }, env);
  assert.equal(denied.status, 404);
  assert.equal(deleted, false);
  const removed = await handleFeedbackApp({ method: "DELETE", userId: "owner", body: { id } }, env);
  assert.equal(removed.status, 200);
  assert.equal(deleted, true);
});

test("review requires checked matching evidence and stores trusted reviewer identity", async (t) => {
  let saved;
  mock(t, async (_url, init = {}) => {
    if (init.method === "PATCH") { saved = JSON.parse(init.body); return Response.json([{ id }]); }
    return Response.json([row]);
  });
  const args = { method: "PATCH", reviewMode: true, userId: "reviewer", body: { id, status: "confirmed", expectedCandidate: false } };
  assert.equal((await handleFeedbackApp(args, env)).status, 400);
  args.body.evidenceChecked = true;
  args.body.reviewedBy = "spoofed";
  assert.equal((await handleFeedbackApp(args, env)).status, 200);
  assert.equal(saved.offer.review.reviewedBy, "reviewer");
  assert.equal(saved.offer.review.expectedCandidate, false);
  assert.equal(saved.offer.title, row.offer.title);
});

test("price reports cannot be promoted to matching labels", async (t) => {
  mock(t, async () => Response.json([{ ...row, reason: "bad_price" }]));
  const result = await handleFeedbackApp({ method: "PATCH", reviewMode: true, userId: "reviewer", body: { id, status: "confirmed", expectedCandidate: false, evidenceChecked: true } }, env);
  assert.equal(result.status, 400);
});

test("review queue replays confirmed cases and excludes pending reports", async (t) => {
  mock(t, async () => Response.json([row, { ...row, id: "confirmed", offer: { ...row.offer, review: { status: "confirmed", expectedCandidate: false } } }]));
  const result = await handleFeedbackApp({ method: "GET", reviewMode: true, userId: "reviewer" }, env);
  assert.equal(result.payload.evaluation.total, 1);
  assert.equal(result.payload.evaluation.passed, 1);
  assert.equal(result.payload.triage.groups[0].distinctUsers, 1);
});

test("normalization prevents forged reviews and preserves unknown prices and reported evidence", () => {
  const normalized = normalizeOfferFeedbackPayload({ feedback: "dislike", offer: { title: "item", priceRon: null, description: "details", review: { status: "confirmed" }, evidenceSource: "server" } }, "owner");
  assert.equal(normalized.offer.review, undefined);
  assert.equal(normalized.offer.priceRon, null);
  assert.equal(normalized.offer.description, "details");
  assert.equal(normalized.offer.evidenceSource, "client_report");
});

test("failed feedback persistence never falls back into public search history", async (t) => {
  const urls = [];
  mock(t, async url => { urls.push(String(url)); return Response.json({ message: "offer_feedback schema cache failure" }, { status: 400 }); });
  await assert.rejects(insertOfferFeedbackToSupabase({ feedback: "dislike", userId: "owner" }, env), /schema cache/);
  assert.equal(urls.length, 1);
  assert.ok(!urls[0].includes("log_search_event"));
});
