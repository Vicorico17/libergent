import test from "node:test";
import assert from "node:assert/strict";
import { normalizeListing } from "./normalize.js";

test("normalizes comma decimal RON prices", () => {
  const listing = normalizeListing({
    title: "Cablu USB-C",
    price: "99,99 Lei",
    currency: "Lei"
  });

  assert.equal(listing.currency, "RON");
  assert.equal(listing.numericPrice, 99.99);
  assert.equal(listing.priceRon, 99.99);
});

test("uses the first price when marketplace text includes buyer protection totals", () => {
  const listing = normalizeListing({
    title: "Husa iPhone",
    price: "99,99 Lei 105,84 Lei include Protecția cumpărătorului",
    currency: "Lei"
  });

  assert.equal(listing.numericPrice, 99.99);
  assert.equal(listing.priceRon, 99.99);
});

test("normalizes numeric and string price fields from structured marketplace data", () => {
  assert.equal(normalizeListing({ price: 99.99, currency: "RON" }).priceRon, 99.99);
  assert.equal(normalizeListing({ priceRon: "99,99" }).priceRon, 99.99);
  assert.equal(normalizeListing({ numericPrice: "99,99", currency: "RON" }).priceRon, 99.99);
});

test("keeps thousands separators as whole RON values", () => {
  assert.equal(normalizeListing({ price: "1.234 lei" }).priceRon, 1234);
  assert.equal(normalizeListing({ price: "1,234 lei" }).priceRon, 1234);
  assert.equal(normalizeListing({ price: "1.234,56 lei" }).priceRon, 1234.56);
});
