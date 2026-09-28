import test from "node:test";
import assert from "node:assert/strict";
import { parseRegatulJocurilorHtml } from "./regatuljocurilor.js";

test("returns product cards rather than LEGO category navigation", () => {
  const html = `<a href="/ro/lego-city">LEGO City</a><span>449,00 RON</span>
    <div class="product-miniature js-product-miniature" data-id-product="12">
      <img data-src="https://img.example/lego.jpg"/>
      <h3 class="h3 product-title"><a href="https://regatuljocurilor.ro/ro/acasa/lego-city-set">LEGO City Set</a></h3>
      <span class="price">199,00&nbsp;RON</span></div>`;
  const result = parseRegatulJocurilorHtml(html, 20);
  assert.equal(result.rawItemCount, 1);
  assert.equal(result.items[0].title, "LEGO City Set");
  assert.equal(result.items[0].price, "199,00 RON");
  assert.equal(result.items[0].url, "https://regatuljocurilor.ro/ro/acasa/lego-city-set");
});
