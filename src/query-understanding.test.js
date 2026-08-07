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
