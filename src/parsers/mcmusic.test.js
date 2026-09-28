import test from "node:test";
import assert from "node:assert/strict";
import { parseMcMusicHtml } from "./mcmusic.js";

test("M&C Music parser reads product cards without search sort links", () => {
  const html = '<a href="/cautare?order=price.asc">Pret - crescator</a>'
    + '<div class="js-product-miniature"><img data-src="https://www.mcmusic.ro/guitar.jpg">'
    + '<div class="product_name"><a href="/guitar.html">Chitara electrica Fender</a></div>'
    + '<span class="price">6.400&nbsp;lei</span>';
  assert.deepEqual(parseMcMusicHtml(html).items, [{
    title: "Chitara electrica Fender", price: "6.400 lei", currency: "RON", condition: "Nou",
    url: "https://www.mcmusic.ro/guitar.html", imageUrl: "https://www.mcmusic.ro/guitar.jpg"
  }]);
});
