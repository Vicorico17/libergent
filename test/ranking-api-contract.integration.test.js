import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { aggregateMarketplaceResults } from "../src/aggregate.js";
import { DEFAULT_RANKING_WEIGHTS, rankListings } from "../src/ranking.js";
import { assertRankingApiContract, assertRankingScoredApiContract } from "../src/ranking-api-contract.js";

const FIXTURES_DIR = path.join(process.cwd(), "test", "fixtures");

function readFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8"));
}

function toProjection(payload) {
  return {
    summaryKeys: Object.keys(payload.summary).sort(),
    resultKeys: Object.keys(payload.results[0]).sort(),
    summaryView: {
      condition: payload.summary.condition,
      conditionLabel: payload.summary.conditionLabel,
      marketplaces: payload.summary.marketplaces,
      successfulMarketplaces: payload.summary.successfulMarketplaces,
      totalListings: payload.summary.totalListings,
      pricedListingsRon: payload.summary.pricedListingsRon,
      bestOfferSite: payload.summary.bestOffer?.site ?? null,
      bestOfferTitle: payload.summary.bestOffer?.title ?? null,
      recommendedSites: (payload.summary.recommendedOffers || []).map((offer) => offer.site)
    },
    resultView: payload.results.map((result) => ({
      site: result.site,
      itemCount: result.itemCount,
      rawItemCount: result.rawItemCount,
      excludedItemCount: result.excludedItemCount,
      bestOfferTitle: result.bestOffer?.title ?? null,
      bestOfferScore: result.bestOffer?.offerScore ?? null,
      lowestTitle: result.lowest?.title ?? null
    }))
  };
}

test("ranking API payload contract and UI mapping stay stable", () => {
  const input = readFixture("ranking-api-input.json");
  const expectedProjection = readFixture("ranking-api-projection.expected.json");

  const payload = aggregateMarketplaceResults(input.results, input.options);
  assert.doesNotThrow(() => assertRankingApiContract(payload));

  const projection = toProjection(payload);
  assert.deepEqual(projection, expectedProjection);
});

test("ranked API payload contract stays stable on fixture data", () => {
  const input = readFixture("ranking-api-input.json");
  const basePayload = aggregateMarketplaceResults(input.results, input.options);
  const listingPool = basePayload.results
    .filter((result) => result.ok)
    .flatMap((result) => result.items.map((item) => ({ ...item, site: result.site })));

  const scoredPayload = {
    ...basePayload,
    summary: {
      ...basePayload.summary,
      rankingWeights: DEFAULT_RANKING_WEIGHTS
    },
    rankedResults: rankListings({
      listings: listingPool,
      query: "iphone 15 pro",
      condition: input.options.condition,
      limit: 10,
      weights: DEFAULT_RANKING_WEIGHTS
    })
  };

  assert.doesNotThrow(() => assertRankingScoredApiContract(scoredPayload));
  assert.equal(scoredPayload.rankedResults[0].title, "iPhone 15 Pro 128GB");
  assert.equal(scoredPayload.rankedResults[0].site, "olx.ro");
});
