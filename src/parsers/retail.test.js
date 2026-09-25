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

test("ignores zero-price retail cards", () => {
  const parsed = parseRetailHtml(`
    <a href="/product-zero"><span>Product with unavailable price</span></a>
    <span>0 lei</span>
  `, 10, { origin: "https://example.ro" });

  assert.equal(parsed.items.length, 0);
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

test("malformed and empty JSON-LD offers do not hide valid products", () => {
  const html = `<script type="application/ld+json">${JSON.stringify([
    { '@type': 'Product', name: 'Empty', offers: [] },
    { '@type': 'Product', name: 'Bad', offers: [null, 'bad'] },
    { '@type': 'Product', name: 'Valid phone', url: '/valid', image: { url: '/valid.jpg' }, offers: [null, { price: 2000, priceCurrency: 'RON' }] }
  ])}</script>`;
  const { items } = parseRetailHtml(html, 10, { origin: 'https://shop.example' });
  assert.equal(items.length, 1);
  assert.equal(items[0].price, '2000 RON');
  assert.equal(items[0].imageUrl, 'https://shop.example/valid.jpg');
});

test("adjacent retail cards keep their own prices and photos", () => {
  const html = `<article class="product"><a href="/one">iPhone 15 128GB</a><span class="price">2000 lei</span><img src="/one.jpg"></article>
    <article class="product"><a href="/two">iPhone 15 256GB</a><span class="price">3000 lei</span><img src="/two.jpg"></article>
    <article class="product"><a href="/missing">iPhone 15 no price</a></article>
    <article class="product"><a href="/three">iPhone 15 512GB</a><span class="price">4000 lei</span><img src="/three.jpg"></article>`;
  const { items } = parseRetailHtml(html, 10, { origin: 'https://shop.example' });
  assert.deepEqual(items.map(item => item.price), ['2000 lei', '3000 lei', '4000 lei']);
  assert.deepEqual(items.map(item => item.imageUrl), ['https://shop.example/one.jpg', 'https://shop.example/two.jpg', 'https://shop.example/three.jpg']);
});

test("current product price beats shipping, installments, crossed-out prices and vouchers", () => {
  const html = `<article class="product"><a href="/phone">iPhone 15</a>
    <span class="shipping-price">Transport 19 lei</span>
    <span class="monthly-price">100 lei / luna</span>
    <div class="price-box"><del class="old-price">4.999 lei</del><span class="current-price">3.299,99 lei</span></div>
    <span class="voucher-price">Voucher 200 lei</span></article>`;
  assert.equal(parseRetailHtml(html, 10, { origin: 'https://shop.example' }).items[0].price, '3.299,99 lei');
});

test("shipping and monthly-only cards are not payable-price offers", () => {
  const html = `<article class="product"><a href="/shipping">iPhone 15</a><span>Transport 19 lei</span></article>
    <article class="product"><a href="/monthly">iPhone 16</a><span>100 lei / luna</span></article>`;
  assert.equal(parseRetailHtml(html, 10, { origin: 'https://shop.example' }).items.length, 0);
});

test("structured price wins over a card guess and sold-out structured products stay excluded", () => {
  const html = `<script type="application/ld+json">${JSON.stringify([
    { '@type': 'Product', name: 'iPhone 15', url: '/one', offers: { price: 2000, priceCurrency: 'RON' } },
    { '@type': 'Product', name: 'iPhone 16', url: '/sold', offers: { price: 3000, priceCurrency: 'RON', availability: 'https://schema.org/OutOfStock' } }
  ])}</script><article><a href="/one">iPhone 15</a><span class="price">2500 lei</span></article>
    <article><a href="/sold">iPhone 16</a><span class="price">3000 lei</span></article>`;
  const { items } = parseRetailHtml(html, 10, { origin: 'https://shop.example' });
  assert.equal(items.length, 1);
  assert.equal(items[0].price, '2000 RON');
});

test("structured used and refurbished stock is not labeled new", () => {
  for (const condition of ['UsedCondition', 'RefurbishedCondition']) {
    const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: 'iPhone 15', url: '/one', offers: { price: 2000, priceCurrency: 'RON', itemCondition: `https://schema.org/${condition}` } })}</script>`;
    assert.equal(parseRetailHtml(html, 10, { origin: 'https://shop.example' }).items[0].condition, 'Recondiționat / folosit');
  }
});

test("title anchors and surrounding product lists do not become product card boundaries", () => {
  const html = `<div class="product-list"><div class="product-card"><a class="product-title" href="/one">iPhone 15 128GB</a>
    <div class="price"><span class="shipping">19 lei</span><span>2500 lei</span></div></div>
    <div class="product-card"><a class="product-title" href="/two">iPhone 15 256GB</a><span class="price">3000 lei</span></div></div>`;
  assert.deepEqual(parseRetailHtml(html, 10, { origin: 'https://shop.example' }).items.map(item => item.price), ['2500 lei', '3000 lei']);
});
