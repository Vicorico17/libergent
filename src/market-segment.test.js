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
