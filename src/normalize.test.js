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

test("normalizes EUR prices while keeping the displayed marketplace price", () => {
  const explicitCurrency = normalizeListing({ price: "7 500", currency: "EUR" });
  const priceTextCurrency = normalizeListing({ price: "7 500 EUR", site: "publi24.ro" });
  const euroSymbol = normalizeListing({ price: "7 500 €", site: "vinted.ro" });

  assert.equal(explicitCurrency.currency, "EUR");
  assert.equal(explicitCurrency.price, "7 500");
  assert.equal(explicitCurrency.priceRon, 37500);
  assert.equal(priceTextCurrency.currency, "EUR");
  assert.equal(priceTextCurrency.price, "7 500 EUR");
  assert.equal(priceTextCurrency.priceRon, 37500);
  assert.equal(euroSymbol.currency, "EUR");
  assert.equal(euroSymbol.price, "7 500 €");
  assert.equal(euroSymbol.priceRon, 37500);
});
