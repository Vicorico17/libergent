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
});

test("vacuum query rejects Rowenta accessory listings", () => {
  const query = "aspirator rowneta";
  const vacuum = classifyListingIntent(
    {
      title: "Aspirator Rowenta Swift Power Cyclonic",
      price: "295 lei",
      priceRon: 295
    },
    query
  );
  const tube = classifyListingIntent(
    {
      title: "Tub telescopic aspirator Rowenta SS-2230002521",
      price: "65 lei",
      priceRon: 65
    },
    query
  );
  const brush = classifyListingIntent(
    {
      title: "Perie aspirator Rowenta originala",
      price: "45 lei",
      priceRon: 45
    },
    query
  );

  assert.equal(vacuum.listingType, "main_product");
  assert.equal(vacuum.isRecommendedCandidate, true);
  assert.notEqual(tube.listingType, "main_product");
  assert.notEqual(brush.listingType, "main_product");
  assert.equal(tube.isRecommendedCandidate, false);
  assert.equal(brush.isRecommendedCandidate, false);
  assert.ok(vacuum.relevanceScore > tube.relevanceScore);
  assert.ok(vacuum.relevanceScore > brush.relevanceScore);
});

test("vacuum query keeps complete bagged vacuum listings", () => {
  const listing = classifyListingIntent(
    {
      title: "Aspirator cu sac Rowenta Silence Force",
      price: "250 lei",
      priceRon: 250
    },
    "aspirator rowenta"
  );

  assert.equal(listing.listingType, "main_product");
  assert.equal(listing.isRecommendedCandidate, true);
});

test("accessory query keeps iPhone case listings as recommendations", () => {
  const query = "husa iphone";
  const husa = classifyListingIntent(
    {
      title: "Husa iPhone 15 Pro Max",
      price: "30 lei",
      priceRon: 30
    },
    query
  );
  const huse = classifyListingIntent(
    {
      title: "Huse iPhone 14 Pro Max",
      price: "40 lei",
      priceRon: 40
    },
    query
  );
  const phone = classifyListingIntent(
    {
      title: "Apple iPhone 14 Pro 128GB",
      price: "2500 lei",
      priceRon: 2500
    },
    query
  );

  assert.equal(husa.listingType, "accessory");
  assert.equal(husa.isRecommendedCandidate, true);
  assert.equal(huse.listingType, "accessory");
  assert.equal(huse.isRecommendedCandidate, true);
  assert.equal(phone.isRecommendedCandidate, false);
  assert.ok(phone.rejectionReasons.includes("type_mismatch:accessory->main_product"));
});

test("rejects listings that use query as a shape or style descriptor", () => {
  const campingTable = classifyListingIntent(
    {
      title: "Masa Camping Pliabila Tip Valiza 120x60x70cm Aluminiu si MDF",
      price: "120 lei",
      priceRon: 120
    },
    "valiza"
  );
  const suitcase = classifyListingIntent(
    {
      title: "Valiza voiaj Samsonite mare",
      price: "180 lei",
      priceRon: 180
    },
    "valiza"
  );
  const trolley = classifyListingIntent(
    {
      title: "Troler valiza calatorie",
      price: "100 lei",
      priceRon: 100
    },
    "valiza"
  );

  assert.notEqual(campingTable.listingType, "main_product");
  assert.equal(campingTable.isRecommendedCandidate, false);
  assert.equal(suitcase.listingType, "main_product");
  assert.equal(suitcase.isRecommendedCandidate, true);
  assert.equal(trolley.listingType, "main_product");
  assert.equal(trolley.isRecommendedCandidate, true);
  assert.ok(suitcase.relevanceScore > campingTable.relevanceScore);
});

test("luggage query rejects tool cases and keeps travel luggage", () => {
  const toolCase = classifyListingIntent(
    {
      title: "Valiza BOSCH 5-40 pentru rotopercutor sau picamar SDS MAX",
      price: "160 lei",
      priceRon: 160
    },
    "valiza"
  );
  const suitcase = classifyListingIntent(
    {
      title: "Valiza troller mare plastic dur ABS Samsonite",
      price: "220 lei",
      priceRon: 220
    },
    "valiza"
  );

  assert.notEqual(toolCase.listingType, "main_product");
  assert.equal(toolCase.isRecommendedCandidate, false);
  assert.equal(suitcase.listingType, "main_product");
  assert.equal(suitcase.isRecommendedCandidate, true);
  assert.ok(suitcase.relevanceScore > toolCase.relevanceScore);
});

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
