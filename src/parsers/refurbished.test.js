import test from "node:test";
import assert from "node:assert/strict";
import { parseFlipHtml, parseKlapHtml } from "./refurbished.js";

test("parses Flip final prices instead of monthly installments", () => {
  const html = `
    <script id="__NEXT_DATA__" type="application/json">
      {"props":{"products":[{
        "naming":{"title":"Apple iPhone 15 Pro, Blue Titanium, 128 GB, Ca nou"},
        "spec":{"storage":"128 GB","shape":"CA_NOU"},
        "currency":"RON","price":3199.99,"installmentsFrom":267,
        "imagePath":"https://cdn.flip.ro/iphone.jpg",
        "pdpUrl":"https://flip.ro/magazin/apple/iphone-15-pro/123/?shape=Ca%20nou"
      }]}}
    </script>
  `;

  const parsed = parseFlipHtml(html, 10, { query: "iphone 15 pro" });

  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].price, "3199.99 RON");
  assert.equal(parsed.items[0].condition, "Ca nou");
  assert.equal(parsed.items[0].url, "https://flip.ro/magazin/apple/iphone-15-pro/123/?shape=Ca%20nou");
});

test("filters the Flip catalog locally for the requested product", () => {
  const html = `
    <script id="__NEXT_DATA__" type="application/json">
      {"products":[
        {"naming":{"title":"Apple iPhone 15 Pro 128 GB"},"spec":{"shape":"EXCELENT"},"currency":"RON","price":3000,"pdpUrl":"/magazin/iphone-15-pro","imagePath":"/iphone.jpg"},
        {"naming":{"title":"Samsung Galaxy S24 256 GB"},"spec":{"shape":"CA_NOU"},"currency":"RON","price":2800,"pdpUrl":"/magazin/galaxy-s24","imagePath":"/s24.jpg"}
      ]}
    </script>
  `;

  const parsed = parseFlipHtml(html, 10, { query: "galaxy s24" });

  assert.equal(parsed.rawItemCount, 2);
  assert.equal(parsed.items.length, 1);
  assert.match(parsed.items[0].title, /Galaxy S24/);
});

test("parses Klap sale price instead of crossed-out price", () => {
  const html = `
    <ul class="products products-lister">
      <li class="product type-product instock">
        <a class="woocommerce-LoopProduct-link woocommerce-loop-product__link" href="https://klap.ro/produs/iphone-15-pro/">
          <img src="/iphone.jpg" />
          <h2 class="woocommerce-loop-product__title">Apple iPhone 15 Pro 128GB, Ca nou</h2>
        </a>
        <div class="product-price-cart-redesign">
          <del><span class="woocommerce-Price-amount amount"><bdi>3.499,00&nbsp;<span>lei</span></bdi></span></del>
          <ins><span class="woocommerce-Price-amount amount"><bdi>3.199,00&nbsp;<span>lei</span></bdi></span></ins>
        </div>
      </li>
    </ul>
  `;

  const parsed = parseKlapHtml(html, 10);

  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].price, "3.199,00 lei");
  assert.equal(parsed.items[0].condition, "Ca nou");
  assert.equal(parsed.items[0].imageUrl, "https://klap.ro/iphone.jpg");
});
