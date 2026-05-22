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

test("scores freshness from parsed relative dates instead of fixed calendar strings", () => {
  const query = "Samsung Galaxy S23";
  const aggregated = aggregateMarketplaceResults([
    makeResult("olx.ro", query, [
      {
        title: "Samsung Galaxy S23 128GB",
        price: "2500 lei",
        condition: "folosit",
        postedAt: "acum 120 zile",
        url: "https://olx.ro/stale"
      },
      {
        title: "Samsung Galaxy S23 128GB",
        price: "2500 lei",
        condition: "folosit",
        postedAt: "acum 2 zile",
        url: "https://olx.ro/recent"
      }
    ])
  ]);

  assert.equal(aggregated.bestOffer?.url, "https://olx.ro/recent");
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

test("generic car make search surfaces vehicles instead of parts and branded goods", () => {
  const query = "bmw";
  const aggregated = aggregateMarketplaceResults([
    makeResult("olx.ro", query, [
      {
        title: "BMW Seria 3 320d 2015",
        price: "35000 lei",
        condition: "folosit",
        postedAt: "Azi",
        url: "https://olx.ro/bmw-car"
      },
      {
        title: "Caseta Directie Bmw E65/E66 Volan Stanga",
        price: "800 lei",
        condition: "folosit",
        postedAt: "Azi",
        url: "https://olx.ro/bmw-part"
      },
      {
        title: "Fata completa / bot complet bmw x6 f16 pachet M",
        price: "23427 lei",
        condition: "folosit",
        postedAt: "Azi",
        url: "https://olx.ro/bmw-front"
      }
    ]),
    makeResult("vinted.ro", query, [
      {
        title: "Sneakersy Puma BMW Motorsport r 36",
        price: "36105 lei",
        condition: "folosit",
        postedAt: "Azi",
        url: "https://vinted.ro/bmw-puma"
      }
    ]),
    makeResult("okazii.ro", query, [
      {
        title: "Macheta BMW seria 5 F10 Welly 1/36",
        price: "70 lei",
        condition: "nou",
        postedAt: "Azi",
        url: "https://okazii.ro/bmw-model"
      }
    ])
  ]);

  const urls = aggregated.results.flatMap((result) => result.items.map((item) => item.url));

  assert.deepEqual(urls, ["https://olx.ro/bmw-car"]);
  assert.equal(aggregated.bestOffer?.url, "https://olx.ro/bmw-car");
  assert.equal(aggregated.summary.totalListings, 1);
});

test("vehicle part search surfaces tire listings instead of complete vehicles", () => {
  const query = "anvelope audi";
  const aggregated = aggregateMarketplaceResults([
    makeResult("publi24.ro", query, [
      {
        title: "Audi A7 50 TDI quattro Tiptronic MHEV",
        price: "258933 lei",
        condition: "folosit",
        postedAt: "Azi",
        url: "https://publi24.ro/audi-car"
      },
      {
        title: "Set 4 Jante Aliaj cu Anvelope Iarna 245/45 R18 Audi",
        price: "2084 lei",
        condition: "folosit",
        postedAt: "Azi",
        url: "https://publi24.ro/audi-tires"
      },
      {
        title: "Roti Audi jante anvelope complete",
        price: "781 lei",
        condition: "folosit",
        postedAt: "Azi",
        url: "https://publi24.ro/audi-wheels"
      }
    ])
  ]);

  const urls = aggregated.results.flatMap((result) => result.items.map((item) => item.url));

  assert.deepEqual(urls.sort(), ["https://publi24.ro/audi-tires", "https://publi24.ro/audi-wheels"].sort());
  assert.equal(aggregated.summary.totalListings, 2);
});
