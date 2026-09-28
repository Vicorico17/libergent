import test from "node:test";
import assert from "node:assert/strict";
import { parseTheHomeHtml } from "./thehome.js";

test("The Home parser reads each product price and image from its own card", () => {
  const html = [
    '<div class="product product--grid"><img data-src="https://example.com/sofa.jpg" class="grid-image__image lazyload">',
    '<h2><a class="product__name" href="/sofa">Canapea extensibila</a></h2>',
    '<span class="product__info product__info--price-gross"><span>10.999&nbsp;RON</span></span>',
    '<div class="grid-image__badge">50%</div>',
    '<div class="product product--grid"><img data-src="https://example.com/table.jpg" class="grid-image__image lazyload">',
    '<h2><a class="product__name" href="/table">Masa dining</a></h2>',
    '<span class="product__info product__info--price-gross"><span>1.299 RON</span></span>'
  ].join("");
  const { items } = parseTheHomeHtml(html);
  assert.deepEqual(items.map(({ title, price, url, imageUrl }) => ({ title, price, url, imageUrl })), [
    { title: "Canapea extensibila", price: "10.999 RON", url: "https://www.thehome.ro/sofa", imageUrl: "https://example.com/sofa.jpg" },
    { title: "Masa dining", price: "1.299 RON", url: "https://www.thehome.ro/table", imageUrl: "https://example.com/table.jpg" }
  ]);
});
