import test from "node:test";
import assert from "node:assert/strict";
import { getSiteKeysForAllSearch, isCarQuery } from "./sites.js";

test("detects common car searches and routes all-search to Autovit first", () => {
  assert.equal(isCarQuery("Mercedes C Class 2019 diesel"), true);
  assert.equal(isCarQuery("Skoda Octavia 2.0 TDI"), true);
  assert.equal(isCarQuery("BMW X5 150 000 km"), true);
  assert.deepEqual(getSiteKeysForAllSearch("Mercedes C Class 2019 diesel"), [
    "autovit.ro",
    "olx.ro",
    "lajumate.ro",
    "vinted.ro",
    "okazii.ro",
    "publi24.ro"
  ]);
});

test("does not classify non-car terms as car searches", () => {
  assert.equal(isCarQuery("masina de spalat samsung"), false);
  assert.equal(isCarQuery("spalat rufe slim"), false);
});
