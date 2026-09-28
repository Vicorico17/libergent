import test from "node:test";
import assert from "node:assert/strict";
import { parseRedGoblinHtml } from "./redgoblin.js";

test("Red Goblin parser uses product titles and current prices, excluding filter links", () => {
  const html = '<a href="/search?filter=lego&q=lego">LEGO (10)</a>'
    + '<li class="productgrid--item productitem--sale"><img src="//redgoblin.ro/cdn/shop/files/lego.jpg" data-rimg="noscript">'
    + '<span class="money price__compare-at--single">559,00 lei</span>'
    + '<span class="money" data-price>447,20 lei</span>'
    + '<h2 class="productitem--title"><a href="/products/lego-castle">Lego Castle</a></h2>';
  assert.deepEqual(parseRedGoblinHtml(html).items, [{
    title: "Lego Castle", price: "447,20 lei", currency: "RON", condition: "Nou",
    url: "https://redgoblin.ro/products/lego-castle", imageUrl: "https://redgoblin.ro/cdn/shop/files/lego.jpg"
  }]);
});
