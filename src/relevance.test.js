import test from "node:test";
import assert from "node:assert/strict";
import { classifyListingIntent } from "./relevance.js";

test("ranks exact pro above pro max for pro-only query", () => {
  const query = "iPhone 14 Pro";
  const exactPro = classifyListingIntent(
    { title: "Apple iPhone 14 Pro 128GB", price: "2800 lei", priceRon: 2800 },
    query
  );
  const proMax = classifyListingIntent(
    { title: "Apple iPhone 14 Pro Max 128GB", price: "2800 lei", priceRon: 2800 },
    query
  );

  assert.ok(exactPro.relevanceScore > proMax.relevanceScore);
  assert.ok(proMax.rejectionReasons.includes("variant_mismatch:pro_vs_pro_max"));
});

test("ranks exact pro max above pro-only for pro max query", () => {
  const query = "iPhone 14 Pro Max";
  const exactProMax = classifyListingIntent(
    { title: "Apple iPhone 14 Pro Max 128GB", price: "3100 lei", priceRon: 3100 },
    query
  );
  const proOnly = classifyListingIntent(
    { title: "Apple iPhone 14 Pro 128GB", price: "2800 lei", priceRon: 2800 },
    query
  );

  assert.ok(exactProMax.relevanceScore > proOnly.relevanceScore);
  assert.ok(proOnly.rejectionReasons.includes("variant_mismatch:pro_max_vs_pro"));
});

test("does not treat accessory sets as recommended product candidates", () => {
  const query = "Jeep Compass";
  const accessorySet = classifyListingIntent(
    {
      title: "Set covorase Jeep Compass",
      description: "Accesorii interior pentru Jeep Compass",
      price: "200 lei",
      priceRon: 200
    },
    query
  );

  assert.equal(accessorySet.listingType, "accessory");
  assert.equal(accessorySet.isRecommendedCandidate, false);
});

test("rejects listings when random critical query token is missing", () => {
  const query = "asdf iphone 14";
  const listing = classifyListingIntent(
    { title: "Apple iPhone 14 128GB", price: "2500 lei", priceRon: 2500 },
    query
  );

  assert.equal(listing.isRecommendedCandidate, false);
  assert.ok(listing.relevanceScore < 55);
  assert.ok(listing.rejectionReasons.includes("missing_critical_query_tokens"));
test("car query rejects accessories and keeps complete vehicle listing as recommended", () => {
  const query = "BMW X5";
  const accessory = classifyListingIntent(
    {
      title: "Covorase BMW X5 set complet",
      description: "Presuri textile pentru BMW X5",
      price: "250 lei",
      priceRon: 250
    },
    query
  );
  const vehicle = classifyListingIntent(
    {
      title: "BMW X5 3.0d xDrive 2015",
      description: "Masina in stare buna, acte la zi",
      price: "16500 euro",
      priceRon: 82000
    },
    query
  );

  assert.notEqual(accessory.listingType, "main_product");
  assert.equal(accessory.isRecommendedCandidate, false);
  assert.ok(vehicle.isRecommendedCandidate);
  assert.ok(vehicle.relevanceScore > accessory.relevanceScore);
});
