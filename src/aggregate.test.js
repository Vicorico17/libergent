import test from "node:test";
import assert from "node:assert/strict";
import { aggregateMarketplaceResults } from "./aggregate.js";

function makeResult(site, query, items) {
  return {
    ok: true,
    site,
    query,
    itemCount: items.length,
    items
  };
}

test("prefers trusted complete offer over suspiciously cheap defective listing", () => {
  const query = "iPhone 14 Pro";
  const aggregated = aggregateMarketplaceResults([
    makeResult("olx.ro", query, [
      {
        title: "iPhone 14 Pro defect pentru piese",
        price: "600 lei",
        condition: "folosit",
        postedAt: "Azi",
        url: "https://olx.ro/defect"
      },
      {
        title: "Apple iPhone 14 Pro 128GB impecabil",
        price: "2900 lei",
        condition: "folosit",
        postedAt: "Azi",
        url: "https://olx.ro/good"
      }
    ]),
    makeResult("publi24.ro", query, [
      {
        title: "Apple iPhone 14 Pro 128GB",
        price: "2800 lei",
        condition: "folosit",
        postedAt: "Ieri",
        url: "https://publi24.ro/pro"
      }
    ])
  ]);

  assert.notEqual(aggregated.bestOffer?.url, "https://olx.ro/defect");
  assert.ok(
    ["https://olx.ro/good", "https://publi24.ro/pro"].includes(aggregated.bestOffer?.url),
    "best offer should be a complete non-defective listing"
  );
  assert.ok(aggregated.bestOffer?.recommendationScore > 0);

  const topOlxRecommendation = aggregated.summary.recommendedOffers.find((offer) => offer.site === "olx.ro");
  assert.equal(topOlxRecommendation?.url, "https://olx.ro/good");
});

test("keeps listings with missing optional metadata in recommendation output", () => {
  const query = "Samsung Galaxy S23";
  const aggregated = aggregateMarketplaceResults([
    makeResult("olx.ro", query, [
      {
        title: "Samsung Galaxy S23 128GB",
        price: "",
        condition: "folosit",
        postedAt: "",
        url: "https://olx.ro/no-price"
      }
    ]),
    makeResult("vinted.ro", query, [
      {
        title: "Samsung Galaxy S23 128GB",
        price: "2600 lei",
        condition: "folosit",
        postedAt: "Azi",
        url: "https://vinted.ro/priced"
      }
    ])
  ]);

  const noPriceOffer = aggregated.summary.recommendedOffers.find((offer) => offer.url === "https://olx.ro/no-price");
  assert.ok(noPriceOffer, "expected no-price listing to still be scored and surfaced");
  assert.ok(Number.isFinite(noPriceOffer.recommendationScore));
});

test("ranks recommendations closer to requester location when listing quality is similar", () => {
  const query = "MacBook Air M1";
  const aggregated = aggregateMarketplaceResults([
    makeResult("olx.ro", query, [
      {
        title: "MacBook Air M1 8GB 256GB",
        price: "2900 lei",
        condition: "folosit",
        location: "Bucuresti",
        postedAt: "Azi",
        url: "https://olx.ro/bucuresti"
      }
    ]),
    makeResult("vinted.ro", query, [
      {
        title: "MacBook Air M1 8GB 256GB",
        price: "2920 lei",
        condition: "folosit",
        location: "Cluj-Napoca",
        postedAt: "Azi",
        url: "https://vinted.ro/cluj"
      }
    ])
  ], {
    requesterLocation: "Cluj-Napoca"
  });

  assert.equal(aggregated.bestOffer?.url, "https://vinted.ro/cluj");
});
