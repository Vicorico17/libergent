import test from "node:test";
import assert from "node:assert/strict";
import { personalFeedbackExclusions } from "./personal-feedback.ts";

test("saved personal feedback uses latest exact-listing decision, never price or freshness", () => {
  const row = { id: "one", query: "phone", feedback: "dislike", reason: "wrong_model", listingFingerprint: "listing" };
  assert.equal(personalFeedbackExclusions([row, row]).length, 1);
  assert.equal(personalFeedbackExclusions([{ ...row, feedback: "like", reason: "relevant" }, row]).length, 0);
  for (const reason of ["bad_price", "unavailable", "duplicate", "other"]) {
    assert.equal(personalFeedbackExclusions([{ ...row, reason }]).length, 0);
  }
  assert.equal(personalFeedbackExclusions([{ ...row, listingFingerprint: "" }]).length, 0);
  assert.equal(personalFeedbackExclusions([{ ...row, listingFingerprint: "", offer: { url: "https://example.com/listing" } }]).length, 1);
});
