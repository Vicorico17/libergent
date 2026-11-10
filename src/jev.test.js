import test from "node:test";
import assert from "node:assert/strict";
import { applyJevProductDecision } from "./jev.js";

test("optional ranking respects offer condition and recalculates savings for its selection", async () => {
  const listing = (id, condition, marketType, capacity) => ({
    title: `iPhone 15 Pro ${capacity}GB`, url: `https://example.com/${id}`,
    condition, marketType, priceRon: marketType === "retail" ? 4000 : 2500,
    isRecommendedCandidate: true, relevanceScore: 99, recommendationScore: 90,
  });
  const items = [
    listing("used128", "Folosit", "secondary", 128),
    listing("used256", "Folosit", "secondary", 256),
    listing("refurb", "Recondiționat", "retail", 256),
    listing("new128", "Nou", "retail", 128),
    listing("new256", "Nou", "retail", 256),
  ];
  const payload = { results: [{ items }], summary: {
    bestUsedOffer: items[0], bestNewBenchmark: items[3], priceIntelligence: { savingsVsNewPct: 38 }
  } };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const { questions } = JSON.parse(options.body);
    assert.equal(Object.keys(questions.best_new.criteria).length, 2);
    assert.ok(Object.values(questions.best_new.criteria).every(text => !text.includes("Recondiționat")));
    assert.equal(Object.keys(questions.best_used.criteria).length, 3);
    return Response.json({ answers: { best_used: { type: "choice", choice: "u02", confidence: 0.9 } } });
  };
  try {
    const result = await applyJevProductDecision(payload, { env: { JEV_API_KEY: "test-key" }, query: "iphone 15 pro" });
    assert.equal(result.status, "selected");
    assert.equal(payload.summary.bestUsedOffer.url, items[1].url);
    assert.equal(payload.summary.priceIntelligence.savingsVsNewPct, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Jev cannot select an over-budget used offer while retail benchmarks remain unconstrained", async (t) => {
  const listing = (id, priceRon, condition, marketType) => ({
    title: "iPhone 15 Pro 256GB", url: `https://example.com/${id}`,
    condition, marketType, priceRon, isRecommendedCandidate: true,
    relevanceScore: 99, recommendationScore: 90, site: "olx.ro"
  });
  const used = [listing("used1", 1000, "Folosit", "secondary"), listing("used2", 1200, "Folosit", "secondary"), listing("expensive", 3000, "Folosit", "secondary")];
  const fresh = [listing("new1", 4000, "Nou", "retail"), listing("new2", 4500, "Nou", "retail")];
  const payload = { results: [{ items: [...used, ...fresh] }], summary: { maxPriceRon: 1500, bestUsedOffer: used[0], bestNewBenchmark: fresh[0], priceIntelligence: {} } };
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (_url, options) => {
    const { questions } = JSON.parse(options.body);
    assert.equal(Object.keys(questions.best_used.criteria).length, 2);
    assert.ok(Object.values(questions.best_used.criteria).every((value) => !value.includes("3000 RON")));
    assert.equal(Object.keys(questions.best_new.criteria).length, 2);
    return Response.json({ answers: { best_used: { type: "choice", choice: "u02", confidence: 0.9 } } });
  };
  assert.equal((await applyJevProductDecision(payload, { env: { JEV_API_KEY: "test" }, query: "iphone 15 pro", condition: "used" })).status, "selected");
  assert.equal(payload.summary.bestUsedOffer.url, used[1].url);
  assert.equal(payload.summary.bestUsedOffer.jevDecision.confidence, 0.9);
});

test("free JEV uses independent configuration and preserves picks on rejected or failed decisions", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalInfo = console.info;
  const logs = [];
  console.info = (message) => logs.push(JSON.parse(message));
  t.after(() => { globalThis.fetch = originalFetch; console.info = originalInfo; });
  const items = [1, 2].map(id => ({ title: "Phone", url: `https://example.com/${id}`,
    condition: "Folosit", marketType: "secondary", priceRon: 1000,
    isRecommendedCandidate: true, relevanceScore: 99, recommendationScore: 90 }));
  const payload = { results: [{ items }], summary: { bestUsedOffer: items[0] } };
  let calls = 0;
  let answer = { type: "choice", choice: "u02", confidence: 0.54 };
  let failure = false;
  globalThis.fetch = async (_url, options) => {
    calls++;
    assert.equal(JSON.parse(options.body).model, "free-model");
    assert.ok(options.signal instanceof AbortSignal);
    if (failure) throw new DOMException("Timed out", "TimeoutError");
    return Response.json({ answers: { best_used: answer }, usage: { input_tokens: 1234 } });
  };
  const options = { env: { JEV_API_KEY: "test", PREMIUM_JEV_ENABLED: "0", FREE_JEV_MODEL: "free-model" }, tier: "free", query: "private query" };
  assert.equal((await applyJevProductDecision(payload, { ...options, env: { ...options.env, FREE_JEV_ENABLED: "0" } })).status, "disabled");
  assert.equal((await applyJevProductDecision(payload, { ...options, env: { ...options.env, JEV_API_KEY: "" } })).status, "unavailable");
  assert.equal((await applyJevProductDecision({ results: [], summary: {} }, options)).status, "insufficient_candidates");
  assert.equal(calls, 0);
  for (const invalid of [answer, { type: "choice", choice: "invented", confidence: 0.9 }, { type: "choice", choice: "u02", confidence: 1.1 }]) {
    answer = invalid;
    assert.equal((await applyJevProductDecision(payload, options)).status, "low_confidence");
    assert.equal(payload.summary.bestUsedOffer, items[0]);
  }
  failure = true;
  assert.equal((await applyJevProductDecision(payload, options)).status, "unavailable");
  assert.equal(payload.summary.bestUsedOffer, items[0]);
  assert.equal(logs.at(-1).inputTokens, null);
  failure = false;
  answer = { type: "choice", choice: "u02", confidence: 0.9 };
  assert.equal((await applyJevProductDecision(payload, options)).status, "selected");
  assert.equal(payload.summary.bestUsedOffer.url, items[1].url);
  assert.equal(logs.length, calls);
  assert.equal(logs.at(-1).inputTokens, 1234);
  assert.equal(logs.at(-1).tier, "free");
  assert.ok(!JSON.stringify(logs).includes("private query"));
  assert.ok(!JSON.stringify(logs).includes("example.com"));
});
