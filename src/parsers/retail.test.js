import test from "node:test";
import assert from "node:assert/strict";
import { parseEmagHtml, parseRetailHtml } from "./retail.js";

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


test("parses eMAG product metadata prices instead of promo installment text", () => {
  const html = `
    <div class="card-v2">
      <button data-product="{&quot;product_name&quot;:&quot;Telefon mobil Apple iPhone 15, 128GB, 5G, Black&quot;,&quot;currency&quot;:&quot;RON&quot;,&quot;price&quot;:3499.99}"></button>
      <a href="https://www.emag.ro/telefon-mobil-apple-iphone-15/pd/test/" class="card-v2-title js-product-url">Telefon mobil Apple iPhone 15, 128GB, 5G, Black</a>
      <div>Easy BuyBack 50 lei BONUS</div>
      <p class="product-new-price">3&#46;499<sup><small class="mf-decimal">&#44;</small>99</sup> <span>Lei</span></p>
    </div>
  `;

  const parsed = parseEmagHtml(html, 10, { origin: "https://www.emag.ro" });

  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].title, "Telefon mobil Apple iPhone 15, 128GB, 5G, Black");
  assert.equal(parsed.items[0].price, "3499.99 RON");
  assert.equal(parsed.items[0].url, "https://www.emag.ro/telefon-mobil-apple-iphone-15/pd/test/");
});
