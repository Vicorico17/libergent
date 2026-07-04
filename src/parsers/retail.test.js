import test from "node:test";
import assert from "node:assert/strict";
import { parseRetailHtml } from "./retail.js";

test("parses retail JSON-LD products", () => {
  const html = `
    <script type="application/ld+json">
      {
        "@type": "Product",
        "name": "Apple iPhone 15 128GB",
        "url": "/apple-iphone-15/pd/test",
        "image": "/iphone.jpg",
        "offers": {
          "@type": "Offer",
          "price": "3999.99",
          "priceCurrency": "RON",
          "seller": { "name": "Retailer test" }
        }
      }
    </script>
  `;

  const parsed = parseRetailHtml(html, 10, { origin: "https://example.ro" });

  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].title, "Apple iPhone 15 128GB");
  assert.equal(parsed.items[0].price, "3999.99 RON");
  assert.equal(parsed.items[0].condition, "Nou");
  assert.equal(parsed.items[0].sellerType, "Retailer test");
  assert.equal(parsed.items[0].url, "https://example.ro/apple-iphone-15/pd/test");
});

test("parses retail anchor cards with nearby prices", () => {
  const html = `
    <article class="product">
      <a href="/telefon-samsung-galaxy-s24" title="Samsung Galaxy S24">Samsung Galaxy S24</a>
      <span class="price">3.299 lei</span>
      <img src="/s24.jpg" />
    </article>
  `;

  const parsed = parseRetailHtml(html, 10, { origin: "https://shop.example" });

  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].title, "Samsung Galaxy S24");
  assert.equal(parsed.items[0].price, "3.299 lei");
  assert.equal(parsed.items[0].currency, "RON");
  assert.equal(parsed.items[0].url, "https://shop.example/telefon-samsung-galaxy-s24");
});
