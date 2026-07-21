import test from "node:test";
import assert from "node:assert/strict";
import { parseListingDetailsHtml } from "./listing-details.js";

test("extracts description, location, delivery, seller, rating and attributes from product JSON-LD", () => {
  const html = `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: "iPhone 15 Pro",
    description: "Telefon verificat, cu garanție.",
    image: ["https://img.test/one.jpg", "https://img.test/two.jpg"],
    brand: { "@type": "Brand", name: "Apple" },
    additionalProperty: [{ "@type": "PropertyValue", name: "Memorie", value: "256 GB" }],
    aggregateRating: { "@type": "AggregateRating", ratingValue: "4.8", reviewCount: 21 },
    offers: {
      "@type": "Offer",
      price: 3000,
      priceCurrency: "RON",
      areaServed: { "@type": "City", name: "Cluj-Napoca" },
      seller: { "@type": "Organization", name: "Seller Test" },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: { "@type": "MonetaryAmount", value: 20, currency: "RON" },
        deliveryTime: { transitTime: { minValue: 1, maxValue: 3 } }
      }
    }
  })}</script>`;

  const result = parseListingDetailsHtml(html, { url: "https://example.ro/item" });
  assert.equal(result.description, "Telefon verificat, cu garanție.");
  assert.equal(result.location, "Cluj-Napoca");
  assert.deepEqual(result.seller, { name: "Seller Test", rating: null, reviewCount: null, ratingScale: 5 });
  assert.equal(result.productRating.rating, 4.8);
  assert.equal(result.pricing.deliveryPrice, 20);
  assert.equal(result.pricing.totalPrice, 3020);
  assert.deepEqual(result.attributes.slice(0, 2), [{ label: "Memorie", value: "256 GB" }, { label: "Brand", value: "Apple" }]);
});

test("extracts Vinted seller reputation and buyer-protection amount without assuming delivery", () => {
  const html = `
    <script type="application/ld+json">{"@type":"Product","name":"Telefon","description":"Descriere seller","offers":{"@type":"Offer","price":2300,"priceCurrency":"RON"}}</script>
    <script>self.__next_f.push([1,"{\\"name\\":\\"user_info_header\\",\\"data\\":{\\"name\\":\\"ana_shop\\",\\"feedback_count\\":42,\\"feedback_reputation\\":0.96}}"])</script>
    <script>self.__next_f.push([1,"{\\"totalAmount\\":{\\"amount\\":\\"2425.50\\",\\"currencyCode\\":\\"RON\\"}}"])</script>
  `;
  const result = parseListingDetailsHtml(html, { url: "https://www.vinted.ro/items/123-test" });
  assert.equal(result.seller.name, "ana_shop");
  assert.equal(result.seller.rating, 4.8);
  assert.equal(result.seller.reviewCount, 42);
  assert.equal(result.pricing.buyerProtectionFee, 125.5);
  assert.equal(result.pricing.buyerProtectionTotal, 2425.5);
  assert.equal(result.pricing.deliveryPrice, null);
  assert.equal(result.pricing.totalPrice, null);
  assert.equal(result.delivery.status, "unknown");
  assert.equal(result.extraction.browserUsed, false);
});
