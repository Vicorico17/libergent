import test from "node:test";
import assert from "node:assert/strict";

import { rankListings } from "../src/ranking.js";

test("rankListings returns deterministic ordering with score breakdown", () => {
  const listings = [
    {
      title: "iPhone 15 Pro 256GB",
      url: "https://example.com/a",
      site: "olx.ro",
      priceRon: 4200,
      relevanceScore: 95,
      condition: "nou",
      location: "Bucuresti"
    },
    {
      title: "iPhone 15 Pro ca nou",
      url: "https://example.com/b",
      site: "vinted.ro",
      priceRon: 3900,
      relevanceScore: 90,
      condition: "nou",
      location: "Cluj"
    }
  ];

  const ranked = rankListings({ listings, query: "iphone 15 pro", condition: "new", limit: 2 });

  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].url, "https://example.com/b");
  assert.equal(typeof ranked[0].rankingScore, "number");
  assert.ok(ranked[0].scoreBreakdown);
  assert.ok(ranked[0].scoreBreakdown.components);
  assert.ok(ranked[0].scoreBreakdown.weighted);
  assert.ok(ranked[0].scoreBreakdown.weights);
});

test("rankListings supports tradeoff tuning via weights", () => {
  const listings = [
    {
      title: "iPhone 15 Pro Max perfect",
      url: "https://example.com/high-text",
      site: "olx.ro",
      priceRon: 5000,
      relevanceScore: 98,
      condition: "folosit",
      location: "Iasi"
    },
    {
      title: "iPhone 15",
      url: "https://example.com/better-price",
      site: "olx.ro",
      priceRon: 3600,
      relevanceScore: 70,
      condition: "folosit",
      location: "Iasi"
    }
  ];

  const textHeavy = rankListings({
    listings,
    query: "iphone 15 pro max",
    condition: "used",
    weights: {
      textRelevance: 0.8,
      price: 0.1,
      condition: 0.05,
      location: 0.05
    },
    limit: 2
  });

  const priceHeavy = rankListings({
    listings,
    query: "iphone 15 pro max",
    condition: "used",
    weights: {
      textRelevance: 0.2,
      price: 0.7,
      condition: 0.05,
      location: 0.05
    },
    limit: 2
  });

  assert.equal(textHeavy[0].url, "https://example.com/high-text");
  assert.equal(priceHeavy[0].url, "https://example.com/better-price");
});
