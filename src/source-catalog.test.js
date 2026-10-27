import test from "node:test";
import assert from "node:assert/strict";
import { buildSourceCatalog } from "./source-catalog.js";
import { SITES, getSiteKeysForAllSearch } from "./sites.js";

test("source catalog exposes fresh direct and production evidence without dropping routed sources", () => {
  const catalog = buildSourceCatalog();
  assert.equal(catalog.length, Object.keys(SITES).length);
  for (const source of catalog) {
    assert.ok(source.directValidation.queriesChecked >= 2);
    assert.ok(Number.isFinite(Date.parse(source.directValidation.checkedAt)));
    assert.equal(source.directValidation.checks.length, source.directValidation.queriesChecked);
  }
  for (const domain of ["price.ro", "shopmania.ro"]) {
    assert.equal(catalog.find(s => s.domain === domain).status, "experimental");
    assert.ok(getSiteKeysForAllSearch("iphone 15").includes(domain));
  }
  for (const domain of ["olx.ro", "anuntul.ro"]) {
    const source = catalog.find(s => s.domain === domain);
    assert.ok(source.productionValidation.some(check => check.accepted > 0));
    assert.equal(source.status, "active");
  }
  assert.equal(catalog.find(s => s.domain === "okazii.ro").status, "experimental");
  const jysk = catalog.find(s => s.domain === "jysk.ro");
  assert.equal(jysk.directValidation.queriesWithAcceptedOffers, 0);
  assert.ok(jysk.browserValidation.some(check => check.accepted > 0 && check.priceVerified && check.engine === "kitesurf"));
  for (const domain of ["ikea.com", "f64.ro", "bookzone.ro"]) {
    const source = catalog.find(s => s.domain === domain);
    assert.ok(source.browserValidation.some(check => check.accepted > 0 && check.priceVerified));
  }
});

test("every registered source has an explicit customer-facing inventory category", () => {
  const catalog = buildSourceCatalog();
  const allowed = new Set(["retail", "second_hand", "refurbished", "mixed", "price_comparison"]);
  assert.ok(catalog.every(source => allowed.has(source.sourceCategory)));
  const category = domain => catalog.find(source => source.domain === domain).sourceCategory;
  assert.equal(category("altex.ro"), "retail");
  assert.equal(category("olx.ro"), "second_hand");
  assert.equal(category("flip.ro"), "refurbished");
  assert.equal(category("klap.ro"), "refurbished");
  assert.equal(category("emag.ro"), "mixed");
  assert.equal(category("compari.ro"), "price_comparison");
});
