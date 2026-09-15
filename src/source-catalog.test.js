import test from "node:test";
import assert from "node:assert/strict";
import { buildSourceCatalog } from "./source-catalog.js";
import { SITES, getSiteKeysForAllSearch } from "./sites.js";

test("source catalog exposes dated evidence and demotes repeated empty sources without losing error reporting", () => {
  const catalog = buildSourceCatalog();
  assert.equal(catalog.length, Object.keys(SITES).length);
  for (const source of catalog) {
    assert.equal(source.directValidation.queriesChecked, 2);
    assert.match(source.directValidation.checkedAt, /^2026-09-15/);
  }
  for (const domain of ["anuntul.ro", "price.ro", "shopmania.ro"]) {
    assert.equal(catalog.find(s => s.domain === domain).status, "experimental");
    assert.ok(getSiteKeysForAllSearch("iphone 15").includes(domain));
  }
  for (const domain of ["olx.ro", "okazii.ro"]) {
    const source = catalog.find(s => s.domain === domain);
    assert.equal(source.directValidation.queriesWithAcceptedOffers, 0);
    assert.ok(source.productionValidation.some(check => check.accepted > 0));
    assert.equal(source.status, "active");
  }
});
