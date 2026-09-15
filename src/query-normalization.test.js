import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMarketplaceQuery } from "./query-normalization.js";
import { aggregateMarketplaceResults } from "./aggregate.js";

test("normalizes common marketplace query typos before searching", () => {
  assert.equal(normalizeMarketplaceQuery("anveolpe audi"), "anvelope audi");
  assert.equal(normalizeMarketplaceQuery("Anvelpe BMW"), "anvelope BMW");
});

test("corrects the Chrome Hearts brand without changing unrelated hearth searches", () => {
  assert.equal(normalizeMarketplaceQuery("Chrome Hearths hoodie"), "chrome hearts hoodie");
  assert.equal(normalizeMarketplaceQuery("stone hearths"), "stone hearths");
  assert.equal(normalizeMarketplaceQuery("chrome hearts"), "chrome hearts");
});

test("corrected brand query survives final listing classification", () => {
  const payload = aggregateMarketplaceResults([{
    ok: true, site: "olx.ro", query: normalizeMarketplaceQuery("chrome hearths"),
    itemCount: 1, rawItemCount: 1,
    items: [{ title: "Hanorac Chrome Hearts", price: "450 lei", condition: "utilizat", url: "https://www.olx.ro/d/oferta/hanorac-test.html" }]
  }]);
  assert.equal(payload.summary.totalListings, 1);
});
