import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOfferFeedbackPayload } from "./feedback.js";

test("normalizes structured authenticated offer feedback", () => {
  const feedback = normalizeOfferFeedbackPayload({
    query: "whiteboard",
    feedback: "dislike",
    reason: "part_or_accessory",
    correctionText: "I wanted the board itself",
    sessionId: "session-1",
    searchId: "search-1",
    listingFingerprint: "olx:marker-1",
    originalRank: 3,
    appliedAction: "hide_similar_and_rerank",
    queryUnderstanding: { category: "office" },
    listingFeatures: { listingType: "accessory", signatureTokens: ["marker"] },
    offer: { title: "Whiteboard markers", site: "olx.ro", url: "https://www.olx.ro/item", priceRon: 30, listingType: "accessory" }
  }, "user-1");

  assert.equal(feedback.userId, "user-1");
  assert.equal(feedback.reason, "part_or_accessory");
  assert.equal(feedback.algorithmVersion, "feedback-loop-v1");
  assert.equal(feedback.offer.title, "Whiteboard markers");
  assert.deepEqual(feedback.listingFeatures.signatureTokens, ["marker"]);
});

test("rejects unsupported feedback reasons", () => {
  assert.throws(() => normalizeOfferFeedbackPayload({ feedback: "dislike", reason: "poison_the_ranker" }, "user-1"), /unsupported/i);
});
