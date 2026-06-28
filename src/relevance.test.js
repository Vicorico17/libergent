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

test("requires exact model and variant tokens for technical product searches", () => {
  const s24 = classifyListingIntent(
    { title: "Samsung Galaxy S24 Ultra 256GB", price: "3200 lei", priceRon: 3200 },
    "Samsung Galaxy S24 Ultra 256GB"
  );
  const s23 = classifyListingIntent(
    { title: "Samsung Galaxy S23 Ultra 256GB", price: "2800 lei", priceRon: 2800 },
    "Samsung Galaxy S24 Ultra 256GB"
  );
  const pro = classifyListingIntent(
    { title: "iPhone 15 Pro 128GB sigilat", price: "4100 lei", priceRon: 4100 },
    "iphone 15 pro sigilat"
  );
  const plus = classifyListingIntent(
    { title: "Iphone 15 Plus Black sigilat 128 GB", price: "3500 lei", priceRon: 3500 },
    "iphone 15 pro sigilat"
  );
  const wrongBrand = classifyListingIntent(
    { title: "Xiaomi Redmi Note 15 Pro Black sigilat", price: "1400 lei", priceRon: 1400 },
    "iphone 15 pro sigilat"
  );

  assert.equal(s24.isRecommendedCandidate, true);
  assert.equal(s23.isRecommendedCandidate, false);
  assert.ok(s23.rejectionReasons.includes("missing_critical_query_tokens"));
  assert.equal(pro.isRecommendedCandidate, true);
  assert.equal(plus.isRecommendedCandidate, false);
  assert.ok(plus.rejectionReasons.includes("missing_critical_query_tokens"));
  assert.equal(wrongBrand.isRecommendedCandidate, false);
  assert.ok(wrongBrand.rejectionReasons.includes("missing_brand"));
});

test("exposes matched, missing, negative, and variant keyword signals", () => {
  const exact = classifyListingIntent(
    { title: "Apple iPhone 15 Pro 128GB", price: "2500 lei", priceRon: 2500 },
    "iphone 15 pro"
  );
  const accessory = classifyListingIntent(
    { title: "Husa iPhone 15 Pro Max silicon", price: "35 lei", priceRon: 35 },
    "iphone 15 pro"
  );

  assert.deepEqual(exact.keywordSignals.queryKeywords, ["iphone", "15", "pro"]);
  assert.ok(exact.keywordSignals.matchedKeywords.includes("iphone"));
  assert.ok(exact.keywordSignals.matchedKeywords.includes("15"));
  assert.ok(exact.keywordSignals.matchedKeywords.includes("pro"));
  assert.equal(exact.keywordSignals.missingKeywords.length, 0);
  assert.equal(accessory.isRecommendedCandidate, false);
  assert.ok(accessory.keywordSignals.negativeKeywords.includes("price_below_category_floor"));
  assert.equal(accessory.keywordSignals.variantMismatch, "pro_vs_pro_max");
});

test("rejects multi-model phone stock ads for exact iPhone searches", () => {
  const stockAd = classifyListingIntent(
    {
      title: "Stoc iPhone 16, iPhone 16 Pro, Sony PS5, iPhone 16e, iPhone 15, iPhone 17",
      price: "300 euro",
      priceRon: 1500
    },
    "iphone 15 pro"
  );
  const exact = classifyListingIntent(
    {
      title: "iPhone 15 Pro 128GB impecabil",
      price: "2500 lei",
      priceRon: 2500
    },
    "iphone 15 pro"
  );

  assert.equal(stockAd.isRecommendedCandidate, false);
  assert.ok(stockAd.rejectionReasons.includes("commercial"));
  assert.ok(stockAd.keywordSignals.negativeKeywords.includes("multi_model_catalog"));
  assert.equal(exact.isRecommendedCandidate, true);
});


test("requires structured size and spec tokens when they are part of the query", () => {
  const r16 = classifyListingIntent(
    { title: "Vand 4 cauciucuri iarna 205/55/R16", price: "500 lei", priceRon: 500 },
    "cauciucuri iarna 205/55/r16"
  );
  const r17 = classifyListingIntent(
    { title: "4 Anvelope IARNA 205.55.17 Hankook dot 2024", price: "600 lei", priceRon: 600 },
    "cauciucuri iarna 205/55/r16"
  );
  const washer8kg = classifyListingIntent(
    { title: "Masina de spalat rufe Beko 8kg 1400 rpm", price: "900 lei", priceRon: 900 },
    "masina de spalat Beko 8kg"
  );
  const washer7kg = classifyListingIntent(
    { title: "Masina de spalat Beko 7 kg WRE 70220", price: "650 lei", priceRon: 650 },
    "masina de spalat Beko 8kg"
  );

  assert.equal(r16.isRecommendedCandidate, true);
  assert.equal(r17.isRecommendedCandidate, false);
  assert.ok(r17.rejectionReasons.includes("missing_critical_query_tokens"));
  assert.equal(washer8kg.isRecommendedCandidate, true);
  assert.equal(washer7kg.isRecommendedCandidate, false);
  assert.ok(washer7kg.rejectionReasons.includes("missing_critical_query_tokens"));
});

test("requires contextual size phrases for marketplace size queries", () => {
  const size4 = classifyListingIntent(
    { title: "Scutece Pampers Premium Care marimea 4, 9-14kg", price: "80 lei", priceRon: 80 },
    "Scutece Pampers mărimea 4"
  );
  const size2 = classifyListingIntent(
    { title: "Scutece Pampers Premium Care XXL Pachet Lunar Marimea 2 pentru 4-8kg", price: "120 lei", priceRon: 120 },
    "Scutece Pampers mărimea 4"
  );

  assert.equal(size4.isRecommendedCandidate, true);
  assert.equal(size2.isRecommendedCandidate, false);
  assert.ok(size2.rejectionReasons.includes("missing_critical_query_tokens"));
});

test("laptop query rejects keyboard replacement parts", () => {
  const laptop = classifyListingIntent(
    {
      title: "Laptop Lenovo IdeaPad Slim 5 14IRL8 Intel i5 16GB 512GB",
      price: "2200 lei",
      priceRon: 2200
    },
    "Laptop Lenovo IdeaPad Slim 5"
  );
  const keyboard = classifyListingIntent(
    {
      title: "Tastatura Laptop Lenovo IdeaPad Slim 5 15IRH9R layout US",
      price: "180 lei",
      priceRon: 180
    },
    "Laptop Lenovo IdeaPad Slim 5"
  );
  const cooler = classifyListingIntent(
    {
      title: "Cooler Laptop Lenovo IdeaPad Slim 5 5F10S14193",
      price: "120 lei",
      priceRon: 120
    },
    "Laptop Lenovo IdeaPad Slim 5"
  );
  const memory = classifyListingIntent(
    {
      title: "Memorie RAM Laptop DDR4 8GB 3200MHz",
      price: "80 lei",
      priceRon: 80
    },
    "laptop"
  );
  const laptopWithRamSpec = classifyListingIntent(
    {
      title: "Laptop Dell Latitude i5 16GB RAM SSD 512GB",
      price: "1450 lei",
      priceRon: 1450
    },
    "laptop"
  );
  const memoryQuery = classifyListingIntent(
    {
      title: "Memorie RAM Laptop DDR4 8GB 3200MHz",
      price: "80 lei",
      priceRon: 80
    },
    "memorie ram laptop"
  );
  const wrongSeries = classifyListingIntent(
    {
      title: "Laptop Lenovo IdeaPad Slim 3 14ABR8 AMD Ryzen 5",
      price: "1800 lei",
      priceRon: 1800
    },
    "Laptop Lenovo IdeaPad Slim 5"
  );

  assert.equal(laptop.isRecommendedCandidate, true);
  assert.equal(keyboard.isRecommendedCandidate, false);
  assert.notEqual(keyboard.listingType, "main_product");
  assert.equal(cooler.isRecommendedCandidate, false);
  assert.notEqual(cooler.listingType, "main_product");
  assert.equal(memory.isRecommendedCandidate, false);
  assert.equal(memory.listingType, "spare_part");
  assert.equal(laptopWithRamSpec.isRecommendedCandidate, true);
  assert.equal(laptopWithRamSpec.listingType, "main_product");
  assert.equal(memoryQuery.isRecommendedCandidate, true);
  assert.equal(memoryQuery.queryType, "spare_part");
  assert.equal(memoryQuery.listingType, "spare_part");
  assert.equal(wrongSeries.isRecommendedCandidate, false);
  assert.ok(wrongSeries.rejectionReasons.includes("missing_critical_query_tokens"));
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

test("Passat CC model query rejects parts and keeps complete vehicles", () => {
  const query = "PASSAT CC";
  const wheelLiner = classifyListingIntent(
    {
      title: "Carenaj roata mic stanga fata Volkswagen Passat CC facelift 3C8805911D",
      price: "99 lei",
      priceRon: 99
    },
    query
  );
  const floorMats = classifyListingIntent(
    {
      title: "Presuri Passat CC",
      price: "70 lei",
      priceRon: 70
    },
    query
  );
  const vehicle = classifyListingIntent(
    {
      title: "Vw Passat cc R line 2010 dsg",
      description: "Autoturism 2.0 TDI, inmatriculat, acte la zi",
      price: "35 913 lei",
      priceRon: 35913
    },
    query
  );

  assert.notEqual(wheelLiner.listingType, "main_product");
  assert.equal(wheelLiner.isRecommendedCandidate, false);
  assert.ok(wheelLiner.rejectionReasons.includes("irrelevant:price_below_category_floor"));
  assert.equal(floorMats.listingType, "accessory");
  assert.equal(floorMats.isRecommendedCandidate, false);
  assert.equal(vehicle.listingType, "main_product");
  assert.equal(vehicle.isRecommendedCandidate, true);
  assert.ok(vehicle.relevanceScore > wheelLiner.relevanceScore);
});

test("generic car make query rejects parts, toys, and apparel", () => {
  const query = "bmw";
  const vehicle = classifyListingIntent(
    {
      title: "BMW Seria 3 320d 2015",
      description: "Autoturism diesel in stare buna",
      price: "35000 lei",
      priceRon: 35000
    },
    query
  );
  const steeringRack = classifyListingIntent(
    {
      title: "Caseta Directie Bmw E65/E66 Volan Stanga",
      price: "800 lei",
      priceRon: 800
    },
    query
  );
  const bodyPanel = classifyListingIntent(
    {
      title: "Fata completa / bot complet bmw x6 f16 pachet M",
      price: "23427 lei",
      priceRon: 23427
    },
    query
  );
  const toy = classifyListingIntent(
    {
      title: "Macheta BMW seria 5 F10 Welly 1/36",
      price: "70 lei",
      priceRon: 70
    },
    query
  );
  const apparel = classifyListingIntent(
    {
      title: "Sneakersy Puma BMW Motorsport r 36",
      price: "36105 lei",
      priceRon: 36105
    },
    query
  );

  assert.equal(vehicle.listingType, "main_product");
  assert.equal(vehicle.isRecommendedCandidate, true);
  assert.notEqual(steeringRack.listingType, "main_product");
  assert.notEqual(bodyPanel.listingType, "main_product");
  assert.notEqual(toy.listingType, "main_product");
  assert.notEqual(apparel.listingType, "main_product");
  assert.equal(steeringRack.isRecommendedCandidate, false);
  assert.equal(bodyPanel.isRecommendedCandidate, false);
  assert.equal(toy.isRecommendedCandidate, false);
  assert.equal(apparel.isRecommendedCandidate, false);
});

test("vehicle part query keeps tire and wheel listings instead of full cars", () => {
  const query = "anvelope audi";
  const tires = classifyListingIntent(
    {
      title: "Jante aliaj originale Audi 20 Q5 S-Line anvelope vara Nexen 255/45 R20",
      price: "4600 lei",
      priceRon: 4600
    },
    query
  );
  const vehicle = classifyListingIntent(
    {
      title: "Audi A7 50 TDI quattro Tiptronic MHEV",
      price: "258933 lei",
      priceRon: 258933
    },
    query
  );

  assert.equal(tires.listingType, "spare_part");
  assert.equal(tires.isRecommendedCandidate, true);
  assert.equal(vehicle.isRecommendedCandidate, false);
  assert.ok(vehicle.rejectionReasons.includes("type_mismatch:spare_part->main_product"));
});

test("padel Nox query keeps Nox racket models with padel synonyms", () => {
  const query = "padel nox";
  const model = classifyListingIntent(
    {
      title: "NOX AT Genius Luxury Series",
      price: "400 lei",
      priceRon: 400
    },
    query
  );
  const translatedRacket = classifyListingIntent(
    {
      title: "Rakieta do padla NOX hybrit lite",
      price: "400 lei",
      priceRon: 400
    },
    query
  );
  const otherBrand = classifyListingIntent(
    {
      title: "Babolat Defiance - padel racket",
      price: "300 lei",
      priceRon: 300
    },
    query
  );

  assert.equal(model.isRecommendedCandidate, true);
  assert.equal(translatedRacket.isRecommendedCandidate, true);
  assert.equal(otherBrand.isRecommendedCandidate, false);
  assert.ok(otherBrand.rejectionReasons.includes("missing_brand"));
});
