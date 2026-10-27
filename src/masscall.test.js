import test from "node:test";
import assert from "node:assert/strict";
import { callBrief, masscallRequest, normalizeCallApproval } from "./masscall.js";

const deal = { stage: "draft", paused_at: null, listing_url: "https://example.test/listing", listing_title: "Phone", listing_price: "1200 RON", brief: { maxPriceRon: 1500, openingOfferRon: 1100, questions: ["Any defects?"] } };
const env = { LIBERGENT_CALLING_ENABLED: "1", LIBERGENT_ALLOWED_DESTINATIONS: "+40712345679", LIBERGENT_RECORDING_RETENTION_DAYS: "7", MASSCALL_SERVICE_URL: "https://masscall.test", MASSCALL_SERVICE_TOKEN: "a".repeat(40), MASSCALL_CALLER_ID: "+40712345678" };
const input = { to: "+40712345679", idempotencyKey: "2a752583-c1b8-4baa-8b80-4331ec1f6441", objective: "Check condition", contactSource: deal.listing_url, recordingConsentEvidence: "Test recipient consented on 2026-10-07", buyerApproved: true, contactPermitted: true, recordingNoticeAcknowledged: true };

test("call approval is bounded and tied to the deal", () => {
  assert.deepEqual(normalizeCallApproval(input, deal, env), { destination: input.to, idempotencyKey: input.idempotencyKey, objective: input.objective, contactSource: input.contactSource, recordingConsentEvidence: input.recordingConsentEvidence });
  assert.throws(() => normalizeCallApproval({ ...input, contactSource: "https://elsewhere.test" }, deal, env), /deal's listing/);
  assert.throws(() => normalizeCallApproval({ ...input, recordingNoticeAcknowledged: false }, deal, env), /required/);
  assert.throws(() => normalizeCallApproval(input, { ...deal, paused_at: "now" }, env), /not active/);
  assert.throws(() => normalizeCallApproval(input, deal, { ...env, LIBERGENT_CALLING_ENABLED: "0" }), /not enabled/);
  assert.throws(() => normalizeCallApproval(input, deal, { ...env, MASSCALL_SERVICE_TOKEN: "short" }), /not configured/);
  assert.match(callBrief(deal, input.objective), /Never agree to purchase/);
});

test("dedicated service request sends only service credentials and bounded payload", async () => {
  let seen;
  const result = await masscallRequest("/v1/calls", { method: "POST", body: { to: input.to }, env, fetchImpl: async (url, options) => {
    seen = { url, options };
    return new Response(JSON.stringify({ providerCallId: "CA" + "a".repeat(32), status: "queued" }), { status: 201 });
  } });
  assert.equal(seen.url, "https://masscall.test/v1/calls");
  assert.equal(seen.options.headers.authorization, `Bearer ${env.MASSCALL_SERVICE_TOKEN}`);
  assert.equal(JSON.parse(seen.options.body).to, input.to);
  assert.equal(result.status, "queued");
});
