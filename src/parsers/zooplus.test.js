import test from "node:test";
import assert from "node:assert/strict";
import { parseZooplusHtml } from "./zooplus.js";

test("extracts a Zooplus product card instead of navigation prices", () => {
  const html = `<a href="/shipping">Livrare gratis peste 199 lei</a>
    <div data-zta="product-card" id="12"><a data-zta="product-info" href="/shop/caini/hrana/12" title="Royal Canin Adult 5 kg"><h2>Royal Canin Adult</h2></a>
    <meta itemProp="price" content="129.9"/><img src="https://img.example/food.jpg" data-zta="product-slider-image"/></div>`;
  const result = parseZooplusHtml(html, 20);
  assert.equal(result.rawItemCount, 1);
  assert.deepEqual(result.items[0], {
    title: "Royal Canin Adult 5 kg", price: "129.9 RON", currency: "RON", condition: "Nou",
    url: "https://www.zooplus.ro/shop/caini/hrana/12", imageUrl: "https://img.example/food.jpg"
  });
});
