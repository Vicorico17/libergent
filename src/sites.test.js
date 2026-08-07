import test from "node:test";
import assert from "node:assert/strict";
import {
  FREE_CAR_SITE_KEYS,
  FREE_DEFAULT_SITE_KEYS,
  FREE_TECH_SITE_KEYS,
  PREMIUM_BROWSER_SITE_KEYS,
  PREMIUM_DIY_SITE_KEYS,
  PREMIUM_FASHION_SITE_KEYS,
  PREMIUM_BOOKS_SITE_KEYS,
  PREMIUM_HOME_SITE_KEYS,
  PREMIUM_MUSIC_SITE_KEYS,
  PREMIUM_PHOTO_SITE_KEYS,
  PREMIUM_SITE_KEYS,
  PREMIUM_SPORT_SITE_KEYS,
  getPremiumSiteKeys,
  getSiteKeysForAllSearch,
  isCarQuery,
  isFashionQuery,
  isDiyQuery,
  isBooksQuery,
  isHomeQuery,
  isMusicQuery,
  isPhotoQuery,
  isRefurbishedTechQuery,
  isSportQuery,
  SITES
} from "./sites.js";

test("detects common car searches and routes all-search to Autovit first", () => {
  assert.equal(isCarQuery("bmw"), true);
  assert.equal(isCarQuery("Mercedes C Class 2019 diesel"), true);
  assert.equal(isCarQuery("Skoda Octavia 2.0 TDI"), true);
  assert.equal(isCarQuery("BMW X5 150 000 km"), true);
  assert.equal(isCarQuery("PASSAT CC"), true);
  assert.equal(isCarQuery("mustang"), true);
  assert.deepEqual(getSiteKeysForAllSearch("Mercedes C Class 2019 diesel"), [
    "autovit.ro",
    "bestauto.ro",
    "olx.ro",
    "lajumate.ro",
    "okazii.ro",
    "publi24.ro",
    "anuntul.ro"
  ]);
  assert.deepEqual(getSiteKeysForAllSearch("PASSAT CC"), [
    "autovit.ro",
    "bestauto.ro",
    "olx.ro",
    "lajumate.ro",
    "okazii.ro",
    "publi24.ro",
    "anuntul.ro"
  ]);
  assert.equal(
    SITES["autovit.ro"].searchUrl("PASSAT CC"),
    "https://www.autovit.ro/autoturisme/volkswagen/passat-cc/"
  );
  assert.equal(
    SITES["autovit.ro"].searchUrl("mustang"),
    "https://www.autovit.ro/autoturisme/ford/mustang/"
  );
});

test("routes refurbished tech sources only for relevant Free searches", () => {
  assert.equal(isRefurbishedTechQuery("iphone 15 pro"), true);
  assert.equal(isRefurbishedTechQuery("laptop lenovo"), true);
  assert.equal(isRefurbishedTechQuery("canapea extensibila"), false);
  assert.deepEqual(getSiteKeysForAllSearch("iphone 15 pro").slice(0, 2), ["flip.ro", "klap.ro"]);
  assert.equal(getSiteKeysForAllSearch("canapea extensibila").includes("flip.ro"), false);
});

test("routes fashion retail benchmarks only for fashion searches", () => {
  assert.equal(isFashionQuery("adidas samba"), true);
  assert.equal(isFashionQuery("rochie de seara"), true);
  assert.equal(isFashionQuery("iphone 15 pro"), false);
  assert.equal(PREMIUM_FASHION_SITE_KEYS.every((siteKey) => getPremiumSiteKeys("adidas samba").includes(siteKey)), true);
  assert.equal(getPremiumSiteKeys("iphone 15 pro").some((siteKey) => PREMIUM_FASHION_SITE_KEYS.includes(siteKey)), false);
  assert.match(SITES["sizeer.ro"].searchUrl("adidas samba"), /querystring%5D=adidas%20samba/);
  assert.equal(SITES["epantofi.ro"].searchUrl("adidas samba"), "https://epantofi.ro/s/adidas%20samba?q=adidas%20samba");
});

test("routes category retailers only for their matching niche", () => {
  assert.equal(isHomeQuery("canapea extensibila"), true);
  assert.equal(isDiyQuery("bormasina bosch"), true);
  assert.equal(isSportQuery("bicicleta mtb"), true);
  assert.equal(isHomeQuery("iphone 15 pro"), false);
  assert.equal(PREMIUM_HOME_SITE_KEYS.every((siteKey) => getPremiumSiteKeys("canapea extensibila").includes(siteKey)), true);
  assert.equal(PREMIUM_DIY_SITE_KEYS.every((siteKey) => getPremiumSiteKeys("bormasina bosch").includes(siteKey)), true);
  assert.equal(PREMIUM_SPORT_SITE_KEYS.every((siteKey) => getPremiumSiteKeys("bicicleta mtb").includes(siteKey)), true);
  assert.equal(isPhotoQuery("camera foto sony"), true);
  assert.equal(isMusicQuery("chitara electrica"), true);
  assert.equal(isBooksQuery("carte ISBN 978"), true);
  assert.equal(PREMIUM_PHOTO_SITE_KEYS.every((siteKey) => getPremiumSiteKeys("camera foto sony").includes(siteKey)), true);
  assert.equal(PREMIUM_MUSIC_SITE_KEYS.every((siteKey) => getPremiumSiteKeys("chitara electrica").includes(siteKey)), true);
  assert.equal(PREMIUM_BOOKS_SITE_KEYS.every((siteKey) => getPremiumSiteKeys("carte ISBN 978").includes(siteKey)), true);
});

test("categorizes every registered marketplace into one access tier", () => {
  const freeKeys = [...FREE_DEFAULT_SITE_KEYS, ...FREE_CAR_SITE_KEYS, ...FREE_TECH_SITE_KEYS];
  assert.equal(new Set(freeKeys).size, freeKeys.length);
  assert.equal(PREMIUM_SITE_KEYS.some((siteKey) => freeKeys.includes(siteKey)), false);
  assert.deepEqual(
    Object.keys(SITES).sort(),
    [...new Set([...freeKeys, ...PREMIUM_SITE_KEYS])].sort()
  );
  assert.equal(PREMIUM_BROWSER_SITE_KEYS.every((siteKey) => PREMIUM_SITE_KEYS.includes(siteKey)), true);
  assert.equal(PREMIUM_BROWSER_SITE_KEYS.includes("emag.ro"), false);
  assert.equal(PREMIUM_BROWSER_SITE_KEYS.includes("evomag.ro"), false);
  assert.equal(PREMIUM_BROWSER_SITE_KEYS.includes("cel.ro"), false);
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
