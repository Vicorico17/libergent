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

test("does not surface recommendations when critical random tokens are missing", () => {
  const query = "asdf iphone 14";
  const aggregated = aggregateMarketplaceResults([
    makeResult("olx.ro", query, [
      {
        title: "Apple iPhone 14 128GB impecabil",
        price: "2500 lei",
        condition: "folosit",
        postedAt: "Azi",
        url: "https://olx.ro/iphone14"
      }
    ])
  ]);

  assert.equal(aggregated.results[0].itemCount, 0);
  assert.equal(aggregated.summary.recommendedOffers.length, 0);
  assert.equal(aggregated.bestOffer, null);
});

test("surfaces matching accessories for accessory searches", () => {
  const query = "husa iphone";
  const aggregated = aggregateMarketplaceResults([
    makeResult("olx.ro", query, [
      {
        title: "Husa iPhone 15 Pro Max",
        price: "30 lei",
        condition: "nou",
        postedAt: "Azi",
        url: "https://olx.ro/husa"
      },
      {
        title: "Apple iPhone 14 Pro 128GB",
        price: "2500 lei",
        condition: "folosit",
        postedAt: "Azi",
        url: "https://olx.ro/iphone"
      }
    ]),
    makeResult("vinted.ro", query, [
      {
        title: "Huse iPhone 14 Pro Max",
        price: "45 lei",
        condition: "nou",
        postedAt: "Azi",
        url: "https://vinted.ro/huse"
      }
    ])
  ]);

  const urls = aggregated.results.flatMap((result) => result.items.map((item) => item.url));

  assert.deepEqual(urls.sort(), ["https://olx.ro/husa", "https://vinted.ro/huse"].sort());
  assert.equal(aggregated.summary.totalListings, 2);
  assert.equal(aggregated.summary.recommendedOffers.length, 2);
});
