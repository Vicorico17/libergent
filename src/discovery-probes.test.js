import test from "node:test";
import assert from "node:assert/strict";
import { buildProbeSuggestions, chooseProbeTerm, isEligibleProbeQuery, serializeProbeRun } from "./discovery-probes.js";

test("discovery probes accept only safe product queries", () => {
  assert.equal(isEligibleProbeQuery("iPhone 15 Pro"), true);
  assert.equal(isEligibleProbeQuery("cuvinte fără categorie"), false);
  assert.equal(isEligibleProbeQuery("iPhone 15 Pro pula"), false);
  assert.equal(isEligibleProbeQuery("email@example.com"), false);
});

test("probe selection picks only queued terms from a bounded random sample", () => {
  const terms = [
    { query: "iPhone 15", status: "ignored" },
    { query: "iPhone 14", status: "queued" },
    { query: "iPhone 13", status: "queued" }
  ];
  assert.equal(chooseProbeTerm(terms, () => 0.9)?.query, "iPhone 13");
  assert.equal(chooseProbeTerm(terms.slice(0, 1)), null);
});

test("probe suggestions extend relevant product queries with validated listing details", () => {
  const results = [{ ok: true, items: [
    { url: "https://market.test/item/1", title: "Apple iPhone 15 Pro 256GB Titanium", relevanceScore: 96, isRecommendedCandidate: true },
    { url: "https://market.test/item/2", title: "iPhone 15 case 256GB", relevanceScore: 94, isRecommendedCandidate: false }
  ] }];
  const suggestions = buildProbeSuggestions("iPhone 15 Pro", results, 3);
  assert.ok(suggestions.includes("iPhone 15 Pro 256gb"));
  assert.equal(suggestions.some((query) => query.includes("case")), false);
});

test("probe run storage keeps a small public offer summary", () => {
  const run = serializeProbeRun({
    query: "iPhone 15 Pro",
    site: "olx.ro",
    elapsedMs: 120,
    payload: {
      results: [{ ok: true, items: [{ url: "https://olx.ro/item/1", title: "iPhone 15 Pro", site: "olx.ro", priceRon: 3000, relevanceScore: 90, description: "private long description" }] }],
      summary: { includedListings: 1, parsedListings: 2, searchedAt: "2026-10-02T00:00:00Z" }
    }
  });
  assert.equal(run.outcome, "results");
  assert.equal(run.results_count, 1);
  assert.equal(run.offers[0].description, undefined);
});
