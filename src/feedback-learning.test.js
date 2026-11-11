import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { triageFeedback, evaluateFeedbackCases } from "./feedback-learning.js";

const report = { query: "iphone", offer: { title: "Husa iPhone", url: "https://example.com/1" }, feedback: "dislike", reason: "part_or_accessory", user_id: "user-1" };

test("triage counts distinct users, groups normalized queries, and flags conflicting labels", () => {
  const result = triageFeedback([
    report, { ...report, query: "IPHONE" },
    { ...report, user_id: "user-2", feedback: "like", reason: "relevant" },
    null,
  ]);
  assert.equal(result.skipped, 1);
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].reports, 3);
  assert.equal(result.groups[0].distinctUsers, 2);
  assert.equal(result.groups[0].conflictingLabels, true);
  assert.equal(result.groups[0].suggestedExpected, null);
  assert.equal(result.groups[0].reviewRequired, true);
  assert.ok(!JSON.stringify(result).includes("user-1"));
});

test("price, freshness and duplicate reports never become negative relevance labels", () => {
  for (const [reason, lane] of [["bad_price", "pricing"], ["unavailable", "freshness"], ["duplicate", "deduplication"]]) {
    const group = triageFeedback([{ ...report, reason }]).groups[0];
    assert.deepEqual(group.lanes, [lane]);
    assert.equal(group.suggestedExpected, null);
  }
  const inconsistent = triageFeedback([{ ...report, feedback: "like" }]).groups[0];
  assert.ok(inconsistent.lanes.includes("manual_review"));
  assert.equal(inconsistent.suggestedExpected, null);
});

test("evaluation rejects unreviewed, empty and duplicate cases", () => {
  const entry = { id: "one", reviewed: true, query: "iphone", listing: { title: "iPhone" }, expectedCandidate: true };
  assert.throws(() => evaluateFeedbackCases([]), /non-empty/);
  assert.throws(() => evaluateFeedbackCases([{ ...entry, reviewed: false }]), /reviewed/);
  assert.throws(() => evaluateFeedbackCases([entry, entry]), /unique/);
});

test("reviewed baseline replays real classifier and reports both error directions", async () => {
  const cases = JSON.parse(await readFile(new URL("../test/fixtures/feedback-regressions.json", import.meta.url), "utf8"));
  const result = evaluateFeedbackCases(cases);
  assert.equal(result.passed, cases.length);
  assert.equal(result.falseAccepts, 0);
  assert.equal(result.falseRejects, 0);
  const inverted = evaluateFeedbackCases(cases.map((entry) => ({ ...entry, expectedCandidate: !entry.expectedCandidate })));
  assert.equal(inverted.passed, 0);
  assert.equal(inverted.falseAccepts, result.positives);
  assert.equal(inverted.falseRejects, result.negatives);
});

test("CLI fails closed on invalid inputs and passes baseline", () => {
  const cwd = new URL("../", import.meta.url);
  const success = spawnSync(process.execPath, ["scripts/feedback-loop.js", "evaluate", "test/fixtures/feedback-regressions.json"], { cwd, encoding: "utf8" });
  assert.equal(success.status, 0, success.stderr);
  assert.equal(JSON.parse(success.stdout).total, 5);
  const invalid = spawnSync(process.execPath, ["scripts/feedback-loop.js", "evaluate", "package.json"], { cwd, encoding: "utf8" });
  assert.equal(invalid.status, 1);
});
