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

test("prefers a verifiable balanced offer over a slightly cheaper thin listing", () => {
  const query = "iPhone 15 Pro";
  const aggregated = aggregateMarketplaceResults([
    makeResult("olx.ro", query, [
      {
        title: "Apple iPhone 15 Pro 128GB",
        price: "1900 lei",
        url: "https://olx.ro/thin"
      },
      {
        title: "Apple iPhone 15 Pro 128GB impecabil",
        price: "2200 lei",
        condition: "folosit",
        postedAt: "Azi",
        location: "București",
        sellerType: "Persoană fizică",
        image: "https://example.test/complete.jpg",
        url: "https://olx.ro/complete"
      }
    ]),
    makeResult("publi24.ro", query, [
      {
        title: "Apple iPhone 15 Pro 128GB",
        price: "2400 lei",
        condition: "folosit",
        postedAt: "Ieri",
        location: "Cluj-Napoca",
        image: "https://example.test/market.jpg",
        url: "https://publi24.ro/market"
      }
    ])
  ]);

  assert.equal(aggregated.bestOffer?.url, "https://olx.ro/complete");
  assert.ok(aggregated.bestOffer.evidenceConfidence.score > 70);
  assert.equal(aggregated.bestOffer.recommendation.strong, true);
  assert.ok(aggregated.bestOffer.recommendation.reasons.some((reason) => reason.includes("3 oferte comparabile")));

  const thin = aggregated.results[0].items.find((item) => item.url === "https://olx.ro/thin");
  assert.ok(thin.evidenceConfidence.score < aggregated.bestOffer.evidenceConfidence.score);
});

test("labels a recommendation as limited when the available evidence is thin", () => {
  const query = "Bialetti Venus";
  const aggregated = aggregateMarketplaceResults([
    makeResult("olx.ro", query, [
      {
        title: "Bialetti Venus 2 cești",
        price: "100 lei",
        url: "https://olx.ro/bialetti"
      }
    ])
  ]);

  assert.equal(aggregated.bestOffer?.recommendation.strong, false);
  assert.equal(aggregated.bestOffer?.recommendation.confidenceLabel, "încredere limitată");
  assert.ok(aggregated.bestOffer?.recommendationScore <= 79);
  assert.equal(aggregated.bestOffer?.dealQuality.label, "date insuficiente");
  assert.equal(aggregated.bestOffer?.priceInsight.label, "eșantion insuficient");
  assert.ok(aggregated.bestOffer?.recommendation.cautions.some((reason) => reason.includes("Date încă lipsă")));
});

test("keeps exact tech product matches ahead of accessories and wrong variants", () => {
  const query = "iphone 15 pro";
  const aggregated = aggregateMarketplaceResults([
    makeResult("olx.ro", query, [
      {
        title: "Husa iPhone 15 Pro Max silicon",
        price: "35 lei",
        condition: "nou",
        postedAt: "Azi",
        url: "https://olx.ro/case"
      },
      {
        title: "Apple iPhone 15 Pro 128GB impecabil",
        price: "2500 lei",
        condition: "folosit",
        postedAt: "Azi",
        url: "https://olx.ro/exact"
      },
      {
        title: "Apple iPhone 15 Pro Max 256GB",
        price: "3300 lei",
        condition: "folosit",
        postedAt: "Azi",
        url: "https://olx.ro/pro-max"
      }
    ])
  ]);

  const [result] = aggregated.results;

  assert.deepEqual(result.items.map((item) => item.url), ["https://olx.ro/exact"]);
  assert.equal(result.relatedAccessories.length, 1);
  assert.equal(result.secondaryMatches.length, 1);
  assert.equal(aggregated.bestOffer?.url, "https://olx.ro/exact");
  assert.ok(result.items[0].keywordSignals.matchedKeywords.includes("iphone"));
  assert.equal(result.secondaryMatches[0].keywordSignals.variantMismatch, "pro_vs_pro_max");
});

test("adds deal quality, risk flags, and price intelligence to returned listings", () => {
  const query = "Samsung Galaxy S23";
  const aggregated = aggregateMarketplaceResults([
    makeResult("olx.ro", query, [
      {
        title: "Samsung Galaxy S23 128GB",
        price: "2500 lei",
        condition: "folosit",
        postedAt: "Azi",
        image: "https://example.test/s23.jpg",
        url: "https://olx.ro/s23"
      },
      {
        title: "Samsung Galaxy S23 128GB sigilat",
        price: "4200 lei",
        condition: "nou",
        postedAt: "Azi",
        image: "https://example.test/s23-new.jpg",
        url: "https://olx.ro/s23-new"
      }
    ])
  ]);

  const [result] = aggregated.results;
  const [first] = result.items;

  assert.ok(Number.isFinite(first.dealQuality.score));
  assert.ok(first.dealQuality.reasons.some((reason) => reason.includes("potrivire produs")));
  assert.equal(first.priceInsight.marketMedianRon, aggregated.summary.priceIntelligence.medianRon);
  assert.equal(aggregated.summary.priceIntelligence.pricedListingsRon, 2);
  assert.ok(aggregated.summary.priceIntelligence.fairLowRon < aggregated.summary.priceIntelligence.fairHighRon);
  assert.ok(result.items.some((item) => item.priceInsight.label === "peste medie" || item.priceInsight.label === "scump"));
});

test("flags suspiciously cheap listings even when they match the product", () => {
  const query = "iPhone 14 Pro";
  const aggregated = aggregateMarketplaceResults([
    makeResult("olx.ro", query, [
      {
        title: "Apple iPhone 14 Pro 128GB impecabil",
        price: "2900 lei",
        condition: "folosit",
        postedAt: "Azi",
        image: "https://example.test/good.jpg",
        url: "https://olx.ro/good"
      },
      {
        title: "Apple iPhone 14 Pro 128GB",
        price: "700 lei",
        condition: "folosit",
        postedAt: "Azi",
        image: "https://example.test/cheap.jpg",
        url: "https://olx.ro/cheap"
      }
    ])
  ]);

  const cheap = aggregated.results[0].items.find((item) => item.url === "https://olx.ro/cheap");

  assert.ok(cheap.riskFlags.some((flag) => flag.code === "very_low_price"));
  assert.equal(cheap.priceInsight.severity, "warning");
  assert.ok(cheap.dealQuality.risk < 100);
});

test("extracts phone-specific signals and why-this-deal explanations", () => {
  const query = "iPhone 15 Pro";
  const aggregated = aggregateMarketplaceResults([
    makeResult("olx.ro", query, [
      {
        title: "iPhone 15 Pro 256GB neverlocked baterie 91% factura garantie",
        price: "2500 lei",
        condition: "folosit",
        postedAt: "Azi",
        image: "https://example.test/iphone.jpg",
        url: "https://olx.ro/iphone"
      },
      {
        title: "iPhone 15 Pro 128GB iCloud blocat display spart",
        price: "1200 lei",
        condition: "folosit",
        postedAt: "Azi",
        image: "https://example.test/locked.jpg",
        url: "https://olx.ro/locked"
      },
      {
        title: "iPhone 15 Pro 128GB baterie 77%",
        price: "2300 lei",
        condition: "folosit",
        postedAt: "Azi",
        image: "https://example.test/battery.jpg",
        url: "https://olx.ro/battery"
      }
    ])
  ]);

  const good = aggregated.results[0].items.find((item) => item.url === "https://olx.ro/iphone");
  const lowBattery = aggregated.results[0].items.find((item) => item.url === "https://olx.ro/battery");
  const locked = aggregated.results[0].partsAndRepair.find((item) => item.url === "https://olx.ro/locked");

  assert.equal(good.phoneSpecs.brand, "Apple");
  assert.equal(good.phoneSpecs.storageGb, 256);
  assert.equal(good.phoneSpecs.batteryHealthPct, 91);
  assert.equal(good.phoneSpecs.invoice, true);
  assert.equal(good.phoneSpecs.warranty, true);
  assert.ok(good.whyThisDeal.some((reason) => reason.includes("Se potrivește prin")));
  assert.ok(good.whyThisDeal.some((reason) => reason.includes("Condiție declarată")));
  assert.ok(good.whyThisDeal.some((reason) => reason.includes("Battery health")));
  assert.ok(lowBattery.riskFlags.some((flag) => flag.code === "low_battery_health"));
  assert.equal(locked.listingType, "broken_or_for_parts");
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

test("preserves parsed and filtered listing counts after aggregation", () => {
  const query = "bmw";
  const aggregated = aggregateMarketplaceResults([
    {
      ...makeResult("olx.ro", query, [
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
        }
      ]),
      rawItemCount: 8
    }
  ]);

  const [result] = aggregated.results;
  assert.equal(result.rawItemCount, 8);
  assert.equal(result.parsedItemCount, 8);
  assert.equal(result.matchedItemCount, 2);
  assert.equal(result.queryMismatchItemCount, 6);
  assert.equal(result.includedItemCount, 1);
  assert.equal(result.excludedItemCount, 1);
  assert.equal(aggregated.summary.parsedListings, 8);
  assert.equal(aggregated.summary.matchedListings, 2);
  assert.equal(aggregated.summary.queryMismatchListings, 6);
  assert.equal(aggregated.summary.includedListings, 1);
  assert.equal(aggregated.summary.excludedListings, 1);
  assert.equal(aggregated.summary.totalListings, 1);
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

test("Passat CC search surfaces cars and excludes marketplace accessories", () => {
  const query = "PASSAT CC";
  const aggregated = aggregateMarketplaceResults([
    makeResult("olx.ro", query, [
      {
        title: "Carenaj roata mic stanga fata Volkswagen Passat CC facelift 3C8805911D",
        price: "99 lei",
        condition: "folosit",
        postedAt: "Azi",
        url: "https://olx.ro/passat-part"
      },
      {
        title: "Vw Passat cc R line 2010 dsg",
        price: "35 913 lei",
        condition: "folosit",
        postedAt: "Azi",
        url: "https://olx.ro/passat-car"
      }
    ]),
    makeResult("vinted.ro", query, [
      {
        title: "Presuri Passat CC",
        price: "70 lei",
        condition: "folosit",
        postedAt: "Azi",
        url: "https://vinted.ro/passat-mats"
      }
    ]),
    makeResult("autovit.ro", query, [
      {
        title: "Volkswagen Passat CC 2.0 TDI DSG",
        price: "7 500 EUR",
        currency: "EUR",
        condition: "diesel • 2011",
        postedAt: "Azi",
        url: "https://autovit.ro/passat-car"
      }
    ])
  ]);

  const urls = aggregated.results.flatMap((result) => result.items.map((item) => item.url));
  const autovitListing = aggregated.results
    .find((result) => result.site === "autovit.ro")
    ?.items.find((item) => item.url === "https://autovit.ro/passat-car");

  assert.deepEqual(urls.sort(), ["https://autovit.ro/passat-car", "https://olx.ro/passat-car"].sort());
  assert.notEqual(aggregated.bestOffer?.url, "https://olx.ro/passat-part");
  assert.notEqual(aggregated.bestOffer?.url, "https://vinted.ro/passat-mats");
  assert.equal(autovitListing?.price, "7 500 EUR");
  assert.equal(autovitListing?.priceRon, 37500);
  assert.equal(aggregated.summary.totalListings, 2);
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


test("separates used price intelligence from new retail benchmarks", () => {
  const query = "iphone 15";
  const aggregated = aggregateMarketplaceResults([
    makeResult("olx.ro", query, [
      {
        title: "Apple iPhone 15 128GB impecabil",
        price: "2500 lei",
        condition: "folosit",
        sourceType: "classifieds",
        postedAt: "Azi",
        url: "https://olx.ro/iphone-15-used"
      },
      {
        title: "Apple iPhone 15 128GB ca nou",
        price: "2600 lei",
        condition: "folosit",
        sourceType: "classifieds",
        postedAt: "Azi",
        url: "https://olx.ro/iphone-15-used-2"
      }
    ]),
    makeResult("price.ro", query, [
      {
        title: "Apple iPhone 15 128GB Black",
        price: "4000 lei",
        condition: "Nou",
        sourceType: "price_aggregator",
        postedAt: "",
        url: "https://price.ro/iphone-15-new"
      }
    ])
  ]);

  const used = aggregated.results.find((result) => result.site === "olx.ro").items[0];
  const retail = aggregated.results.find((result) => result.site === "price.ro").items[0];

  assert.equal(used.priceInsight.marketMedianRon, 2550);
  assert.equal(retail.priceInsight.marketMedianRon, 4000);
  assert.equal(aggregated.summary.priceIntelligence.usedMedianRon, 2550);
  assert.equal(aggregated.summary.priceIntelligence.newLowestRon, 4000);
  assert.equal(aggregated.summary.priceIntelligence.savingsVsNewPct, 38);
  assert.equal(aggregated.summary.bestUsedOffer.sourceType, "classifieds");
  assert.equal(aggregated.summary.bestNewBenchmark.sourceType, "price_aggregator");
});

test("dedupes equivalent new benchmark products across retail sources", () => {
  const query = "iphone 15";
  const aggregated = aggregateMarketplaceResults([
    makeResult("price.ro", query, [
      { title: "Apple iPhone 15 128GB", price: "3300 lei", condition: "Nou", sourceType: "price_aggregator", url: "https://price.ro/a" }
    ]),
    makeResult("shopmania.ro", query, [
      { title: "iPhone 15 128GB", price: "3200 lei", condition: "Nou", sourceType: "price_aggregator", url: "https://shopmania.ro/a" }
    ]),
    makeResult("cel.ro", query, [
      { title: "Apple iPhone 15 128GB", price: "3400 lei", condition: "Nou", sourceType: "retailer", url: "https://cel.ro/a" }
    ])
  ]);

  assert.equal(aggregated.summary.totalListings, 1);
  assert.equal(aggregated.summary.duplicateListings, 2);
  assert.equal(aggregated.summary.bestNewBenchmark.url, "https://shopmania.ro/a");
  assert.equal(aggregated.summary.priceIntelligence.newLowestRon, 3200);
});

test("rejects phone variants when the query asks for the base model", () => {
  const query = "iphone 15 128GB";
  const aggregated = aggregateMarketplaceResults([
    makeResult("price.ro", query, [
      { title: "Apple iPhone 15 Pro 128GB", price: "4500 lei", condition: "Nou", sourceType: "price_aggregator", url: "https://price.ro/pro" },
      { title: "Apple iPhone 15 128GB", price: "3500 lei", condition: "Nou", sourceType: "price_aggregator", url: "https://price.ro/base" }
    ])
  ]);

  const urls = aggregated.results[0].items.map((item) => item.url);

  assert.deepEqual(urls, ["https://price.ro/base"]);
  assert.equal(aggregated.results[0].secondaryMatches[0].keywordSignals.variantMismatch, "extra_pro");
});
