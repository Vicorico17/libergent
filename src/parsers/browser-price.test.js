import test from "node:test";
import assert from "node:assert/strict";
import { parseIkeaHtml } from "./ikea.js";
import { parseBookzoneHtml } from "./bookzone.js";
import { parseF64Html } from "./retail.js";

test("IKEA uses each card's own price and canonical product instead of a nearby variant", () => {
  const html = `<div data-price="999" data-currency="RON" data-testid="plp-product-card" class="plp-mastercard">
    <a href="https://www.ikea.com/ro/ro/p/fridhult-knisa-gri-70351725/" class="plp-product__image-link"><img src="https://ikea.test/sofa.jpg" alt="FRIDHULT sofa"></a>
    <a aria-label="FRIDHULT, Canapea extensibilă, Knisa gri" class="plp-price-module__product-link"></a>
    <a href="https://www.ikea.com/ro/ro/p/fridhult-galben-00575446/" class="plp-product-variant__link"></a>
  </div><div data-price="2398" data-currency="RON" data-testid="plp-product-card" class="plp-mastercard">
    <a href="https://www.ikea.com/ro/ro/p/friheten-gri-39216754/" class="plp-product__image-link"><img src="https://ikea.test/sofa2.jpg" alt="FRIHETEN sofa"></a>
    <a aria-label="FRIHETEN, Coltar extensibil" class="plp-price-module__product-link"></a>
  </div>`;
  const result = parseIkeaHtml(html, 10);
  assert.deepEqual(result.items.map(({ price, url }) => [price, url]), [
    ["999 RON", "https://www.ikea.com/ro/ro/p/fridhult-knisa-gri-70351725/"],
    ["2398 RON", "https://www.ikea.com/ro/ro/p/friheten-gri-39216754/"]
  ]);
});

test("F64 reads the structured offer for the same product", () => {
  const html = `<script type="application/ld+json">${JSON.stringify({
    "@type": "ItemList", itemListElement: [{ "@type": "ListItem", item: {
      "@type": "Product", "@id": "https://www.f64.ro/sony-a7-iv-body-mirrorless/p",
      name: "Sony A7 IV Camera Foto", offers: { "@type": "AggregateOffer", lowPrice: 10499.99, priceCurrency: "RON" }
    } }]
  })}</script><a href="/sony-a7-iv-body-mirrorless/p">Sony A7 IV</a><span>1000 lei</span>`;
  const result = parseF64Html(html, 10, { origin: "https://www.f64.ro" });
  assert.equal(result.items[0].price, "10499.99 RON");
});

test("Bookzone uses the current card price and skips unavailable books", () => {
  const html = `<div class="cat-content__item"><a href="/carte/harry-potter" class="pi-a" title="Harry Potter"></a>
    <img class="pi-img" src="https://bookzone.test/book.jpg"><span class="pi-o-price">PRP: 78.78 Lei</span>
    <span class="pi-price">70.9 Lei</span><button title="Adauga in cos"></button></div>
    <div class="cat-content__item"><a href="/carte/other" class="pi-a" title="Other"></a>
    <span class="pi-price">42 Lei</span><button title="Produs indisponibil"></button></div>`;
  const result = parseBookzoneHtml(html, 10, { origin: "https://bookzone.ro" });
  assert.deepEqual(result.items.map(({ title, price }) => [title, price]), [["Harry Potter", "70.9 Lei"]]);
});
