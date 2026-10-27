import test from "node:test";
import assert from "node:assert/strict";
import { classifyMarketSegment } from "./market-segment.js";

test("classifies retail and price benchmark sources as retail", () => {
  assert.equal(classifyMarketSegment({ sourceType: "retailer" }), "retail");
  assert.equal(classifyMarketSegment({ sourceType: "price_aggregator" }), "retail");
});

test("classifies marketplace inventory using seller evidence", () => {
  assert.equal(classifyMarketSegment({ sourceType: "retailer_marketplace", sellerType: "Persoană fizică" }), "secondary");
  assert.equal(classifyMarketSegment({ sourceType: "retailer_marketplace", sellerType: "Magazin" }), "retail");
  assert.equal(classifyMarketSegment({ sourceType: "retailer_marketplace", sellerType: "" }), "mixed");
});

test("classifies classifieds as secondary market", () => {
  assert.equal(classifyMarketSegment({ sourceType: "classifieds", sellerType: "" }), "secondary");
});

import { classifyOfferKind, canCompareRetailOffers } from "./market-segment.js";

test("new retail eligibility respects condition and marketplace seller evidence", () => {
  assert.equal(classifyOfferKind({ sourceType: "retailer", condition: "Nou" }), "new");
  for (const condition of ["Recondiționat", "Resigilat", "Folosit", "Ca nou", "Like new", "Open box"]) {
    assert.equal(classifyOfferKind({ sourceType: "retailer", condition }), "used", condition);
  }
  assert.equal(classifyOfferKind({ sourceType: "retailer", condition: "Nou", title: "iPhone 15 reconditionat" }), "used");
  assert.equal(classifyOfferKind({ sourceType: "classifieds", condition: "Nou sigilat" }), "used");
  assert.equal(classifyOfferKind({ sourceType: "retailer_marketplace", sellerType: "Persoană fizică", condition: "Nou" }), "used");
  assert.equal(classifyOfferKind({ sourceType: "retailer_marketplace", condition: "Nou" }), "mixed");
});

test("retail savings require the same model, variant and known storage", () => {
  const used = { title: "Apple iPhone 15 Pro 256GB folosit" };
  assert.equal(canCompareRetailOffers(used, { title: "Telefon APPLE iPhone 15 Pro 256 GB Blue" }), true);
  assert.equal(canCompareRetailOffers(used, { title: "iPhone 15 Pro 128GB" }), false);
  assert.equal(canCompareRetailOffers(used, { title: "iPhone 15 Pro Max 256GB" }), false);
  assert.equal(canCompareRetailOffers(used, { title: "iPhone 15 Pro" }), false);
  assert.equal(canCompareRetailOffers({ title: "Samsung S24 FE 128GB" }, { title: "Samsung Galaxy S24 128GB" }), false);
  assert.equal(canCompareRetailOffers({ title: "iPhone 15 Pro 1TB" }, { title: "iPhone 15 Pro 1024GB" }), true);
  assert.equal(canCompareRetailOffers(null, used), false);
});
