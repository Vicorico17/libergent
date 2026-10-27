import test from "node:test";
import assert from "node:assert/strict";
import { understandMarketplaceQuery } from "./query-understanding.js";

test("understands standalone high-confidence vehicle models", () => {
  const mustang = understandMarketplaceQuery("mustang");
  assert.equal(mustang.category, "vehicle");
  assert.equal(mustang.make, "ford");
  assert.equal(mustang.model, "mustang");
  assert.equal(mustang.canonicalPath, "ford-mustang");
  assert.ok(mustang.confidence >= 0.9);
  assert.ok(mustang.alternatives.some((choice) => choice.query === "macheta mustang"));
  assert.equal(understandMarketplaceQuery("macheta mustang").category, "collectible");
  assert.equal(understandMarketplaceQuery("haine mustang").category, "apparel");
});

test("uses the same extensible profile for other common products", () => {
  assert.equal(understandMarketplaceQuery("Dacia Duster 2019").category, "vehicle");
  assert.equal(understandMarketplaceQuery("octavia").make, "skoda");
  assert.equal(understandMarketplaceQuery("iphone 15 pro").category, "phone");
  assert.equal(understandMarketplaceQuery("air fryer philips").category, "kitchen");
  assert.equal(understandMarketplaceQuery("canapea extensibila").category, null);
});

test("ambiguous car makes need vehicle context and do not override tech families", () => {
  for (const query of ["iphone 13 mini", "ipad mini", "mac mini m2", "smart tv samsung", "nintendo ds", "samsung galaxy s24 2024"]) {
    assert.notEqual(understandMarketplaceQuery(query).category, "vehicle", query);
  }
  for (const query of ["mini cooper", "mini countryman 2019", "smart fortwo", "ds 7", "mg zs", "seat leon", "mini diesel 2018"]) {
    assert.equal(understandMarketplaceQuery(query).category, "vehicle", query);
  }
});
