import test from "node:test";
import assert from "node:assert/strict";
import {
  FREE_CAR_SITE_KEYS,
  FREE_DEFAULT_SITE_KEYS,
  FREE_TECH_SITE_KEYS,
  PREMIUM_BROWSER_SITE_KEYS,
  PREMIUM_SITE_KEYS,
  getSiteKeysForAllSearch,
  isCarQuery,
  isRefurbishedTechQuery,
  SITES
} from "./sites.js";

test("detects common car searches and routes all-search to Autovit first", () => {
  assert.equal(isCarQuery("bmw"), true);
  assert.equal(isCarQuery("Mercedes C Class 2019 diesel"), true);
  assert.equal(isCarQuery("Skoda Octavia 2.0 TDI"), true);
  assert.equal(isCarQuery("BMW X5 150 000 km"), true);
  assert.equal(isCarQuery("PASSAT CC"), true);
  assert.deepEqual(getSiteKeysForAllSearch("Mercedes C Class 2019 diesel"), [
    "autovit.ro",
    "bestauto.ro",
    "olx.ro",
    "lajumate.ro",
    "vinted.ro",
    "okazii.ro",
    "publi24.ro",
    "anuntul.ro",
    "price.ro",
    "shopmania.ro"
  ]);
  assert.deepEqual(getSiteKeysForAllSearch("PASSAT CC"), [
    "autovit.ro",
    "bestauto.ro",
    "olx.ro",
    "lajumate.ro",
    "vinted.ro",
    "okazii.ro",
    "publi24.ro",
    "anuntul.ro",
    "price.ro",
    "shopmania.ro"
  ]);
  assert.equal(
    SITES["autovit.ro"].searchUrl("PASSAT CC"),
    "https://www.autovit.ro/autoturisme/volkswagen/passat-cc/"
  );
});

test("routes refurbished tech sources only for relevant Free searches", () => {
  assert.equal(isRefurbishedTechQuery("iphone 15 pro"), true);
  assert.equal(isRefurbishedTechQuery("laptop lenovo"), true);
  assert.equal(isRefurbishedTechQuery("canapea extensibila"), false);
  assert.deepEqual(getSiteKeysForAllSearch("iphone 15 pro").slice(0, 2), ["flip.ro", "klap.ro"]);
  assert.equal(getSiteKeysForAllSearch("canapea extensibila").includes("flip.ro"), false);
});

test("categorizes every registered marketplace into one access tier", () => {
  const freeKeys = [...FREE_DEFAULT_SITE_KEYS, ...FREE_CAR_SITE_KEYS, ...FREE_TECH_SITE_KEYS];
  assert.equal(new Set(freeKeys).size, freeKeys.length);
  assert.equal(PREMIUM_SITE_KEYS.some((siteKey) => freeKeys.includes(siteKey)), false);
  assert.deepEqual(
    [...new Set([...freeKeys, ...PREMIUM_SITE_KEYS])].sort(),
    Object.keys(SITES).sort()
  );
  assert.equal(PREMIUM_BROWSER_SITE_KEYS.every((siteKey) => PREMIUM_SITE_KEYS.includes(siteKey)), true);
  assert.equal(PREMIUM_BROWSER_SITE_KEYS.includes("emag.ro"), false);
  assert.equal(PREMIUM_BROWSER_SITE_KEYS.includes("evomag.ro"), false);
  assert.equal(PREMIUM_BROWSER_SITE_KEYS.includes("cel.ro"), true);
});

test("does not classify non-car terms as car searches", () => {
  assert.equal(isCarQuery("masina de spalat samsung"), false);
  assert.equal(isCarQuery("spalat rufe slim"), false);
  assert.equal(isCarQuery("scaun auto copii isofix"), false);
  assert.equal(isCarQuery("trotineta electrica xiaomi"), false);
  assert.equal(isCarQuery("anvelope audi"), false);
  assert.equal(isCarQuery("anveolpe audi"), false);
  assert.deepEqual(getSiteKeysForAllSearch("anveolpe audi"), [
    "olx.ro",
    "lajumate.ro",
    "vinted.ro",
    "okazii.ro",
    "publi24.ro",
    "anuntul.ro",
    "price.ro",
    "shopmania.ro"
  ]);
});
