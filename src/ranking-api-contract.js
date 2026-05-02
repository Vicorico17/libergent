const REQUIRED_SUMMARY_KEYS = [
  "searchedAt",
  "condition",
  "conditionLabel",
  "creditBudget",
  "creditsUsed",
  "marketplaces",
  "successfulMarketplaces",
  "totalListings",
  "pricedListingsRon",
  "averagePriceRon",
  "bestOffer",
  "recommendedOffers"
];

const REQUIRED_RESULT_KEYS = [
  "ok",
  "site",
  "query",
  "itemCount",
  "items",
  "totalResults",
  "bestOffer",
  "lowest",
  "relatedAccessories",
  "partsAndRepair",
  "wantedAds",
  "secondaryMatches",
  "excludedItemCount"
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Ranking API contract violation: ${message}`);
  }
}

function assertObject(value, path) {
  assert(Boolean(value) && typeof value === "object" && !Array.isArray(value), `${path} must be an object`);
}

function assertHasKeys(object, requiredKeys, path) {
  for (const key of requiredKeys) {
    assert(Object.hasOwn(object, key), `${path}.${key} is required`);
  }
}

function assertOfferShape(offer, path, { requireSite = true } = {}) {
  assertObject(offer, path);
  assert(typeof offer.title === "string", `${path}.title must be a string`);
  if (requireSite) {
    assert(typeof offer.site === "string", `${path}.site must be a string`);
  } else if (offer.site !== undefined && offer.site !== null) {
    assert(typeof offer.site === "string", `${path}.site must be a string when present`);
  }
  assert(typeof offer.url === "string", `${path}.url must be a string`);
  assert(Number.isFinite(offer.priceRon), `${path}.priceRon must be a finite number`);
}

/**
 * Ranking API contract used by `public/app.js` (`renderResults`, `renderSummary`, `renderSite`).
 * Keep this strict so tests fail fast on response shape drift.
 */
export function assertRankingApiContract(payload) {
  assertObject(payload, "payload");
  assert(Array.isArray(payload.results), "payload.results must be an array");
  assertObject(payload.summary, "payload.summary");
  assertHasKeys(payload.summary, REQUIRED_SUMMARY_KEYS, "payload.summary");

  assert(typeof payload.summary.searchedAt === "string", "payload.summary.searchedAt must be a string");
  assert(["any", "new", "used"].includes(payload.summary.condition), "payload.summary.condition must be any/new/used");
  assert(typeof payload.summary.conditionLabel === "string", "payload.summary.conditionLabel must be a string");
  assert(Array.isArray(payload.summary.recommendedOffers), "payload.summary.recommendedOffers must be an array");

  if (payload.summary.bestOffer !== null) {
    assertOfferShape(payload.summary.bestOffer, "payload.summary.bestOffer");
  }

  for (const [index, offer] of payload.summary.recommendedOffers.entries()) {
    assertOfferShape(offer, `payload.summary.recommendedOffers[${index}]`);
  }

  for (const [index, result] of payload.results.entries()) {
    assertObject(result, `payload.results[${index}]`);
    assertHasKeys(result, REQUIRED_RESULT_KEYS, `payload.results[${index}]`);

    assert(typeof result.ok === "boolean", `payload.results[${index}].ok must be a boolean`);
    assert(typeof result.site === "string", `payload.results[${index}].site must be a string`);
    assert(Array.isArray(result.items), `payload.results[${index}].items must be an array`);
    assert(Array.isArray(result.relatedAccessories), `payload.results[${index}].relatedAccessories must be an array`);
    assert(Array.isArray(result.partsAndRepair), `payload.results[${index}].partsAndRepair must be an array`);
    assert(Array.isArray(result.wantedAds), `payload.results[${index}].wantedAds must be an array`);
    assert(Array.isArray(result.secondaryMatches), `payload.results[${index}].secondaryMatches must be an array`);

    if (result.ok) {
      assert(typeof result.query === "string", `payload.results[${index}].query must be a string`);
      assert(Number.isFinite(result.itemCount), `payload.results[${index}].itemCount must be numeric`);
    }

    if (result.bestOffer !== null) {
    assertOfferShape(result.bestOffer, `payload.results[${index}].bestOffer`, { requireSite: false });
    }
  }

  return payload;
}

export function assertRankingScoredApiContract(payload) {
  assertRankingApiContract(payload);
  assert(Array.isArray(payload.rankedResults), "payload.rankedResults must be an array");
  assertObject(payload.summary, "payload.summary");
  assertObject(payload.summary.rankingWeights, "payload.summary.rankingWeights");

  for (const [index, item] of payload.rankedResults.entries()) {
    assertObject(item, `payload.rankedResults[${index}]`);
    assert(typeof item.site === "string", `payload.rankedResults[${index}].site must be a string`);
    assert(Number.isFinite(item.rankingScore), `payload.rankedResults[${index}].rankingScore must be numeric`);
    assertObject(item.scoreBreakdown, `payload.rankedResults[${index}].scoreBreakdown`);
    assertObject(item.scoreBreakdown.components, `payload.rankedResults[${index}].scoreBreakdown.components`);
    assertObject(item.scoreBreakdown.weighted, `payload.rankedResults[${index}].scoreBreakdown.weighted`);
    assertObject(item.scoreBreakdown.weights, `payload.rankedResults[${index}].scoreBreakdown.weights`);
  }

  return payload;
}
