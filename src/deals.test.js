import test from "node:test";
import assert from "node:assert/strict";
import { buildDealOpeningDraft, buildDealReplyDraft, normalizeDealBrief, normalizeDealChange } from "./deals.js";

const brief = { maxPriceRon: 1800, openingOfferRon: 1500, questions: ["Are factură?"], deliveryPreference: "Ridicare", location: "București", timing: "Sâmbătă", dealBreakers: "Fără defecte" };

test("validates the buyer's offer ceiling and generates an agent disclosure", () => {
  assert.throws(() => normalizeDealBrief({ maxPriceRon: 1000, openingOfferRon: 1200 }), /exceeds/);
  const normalized = normalizeDealBrief(brief);
  const draft = buildDealOpeningDraft({ listing_title: "Telefon", brief: normalized });
  assert.match(draft, /asistentul LiberGent/);
  assert.match(draft, /1500 RON/);
  assert.doesNotMatch(draft, /1800 RON/);
});

test("agreement, buyer acceptance and completed purchase are separate transitions", () => {
  const negotiating = { stage: "negotiating", brief, paused_at: null };
  assert.throws(() => normalizeDealChange({ action: "completed" }, negotiating), /Cannot move/);
  assert.throws(() => normalizeDealChange({ action: "terms_agreed", agreedPriceRon: 1900, agreedTerms: "Ridicare" }, negotiating), /exceeds/);
  const terms = normalizeDealChange({ action: "terms_agreed", agreedPriceRon: 1700, agreedTerms: "Ridicare sâmbătă" }, negotiating);
  assert.equal(terms.stage, "terms_agreed");
  assert.throws(() => normalizeDealChange({ action: "buyer_accepted", agreedPriceRon: 1600 }, { ...negotiating, ...terms }), /must match/);
  const accepted = normalizeDealChange({ action: "buyer_accepted" }, { ...negotiating, ...terms });
  assert.equal(accepted.stage, "buyer_accepted");
  assert.ok(accepted.buyer_accepted_at);
  const completed = normalizeDealChange({ action: "completed" }, { ...negotiating, ...terms, ...accepted });
  assert.equal(completed.stage, "completed");
  assert.ok(completed.completed_at);
});

test("pause and terminal state stop stage changes", () => {
  const paused = { stage: "contacting", brief, paused_at: new Date().toISOString() };
  assert.throws(() => normalizeDealChange({ action: "negotiating" }, paused), /Resume/);
  assert.deepEqual(normalizeDealChange({ action: "resume" }, paused), { paused_at: null });
  assert.throws(() => normalizeDealChange({ action: "resume" }, { stage: "cancelled", brief }), /closed/);
});

test("reply proposal never treats seller wording as buyer acceptance", () => {
  const deal = { stage: "negotiating", brief };
  const reply = buildDealReplyDraft(deal, { messages: [{ direction: "inbound", text: "De acord, rămâne stabilit" }] });
  assert.match(reply, /voi confirma/i);
  assert.equal(buildDealReplyDraft(deal, { messages: [{ direction: "inbound", text: "Nu mai trimite mesaje" }] }), null);
  assert.equal(buildDealReplyDraft(deal, { messages: [{ direction: "outbound", text: "Salut" }] }), null);
});
