import test from "node:test";
import assert from "node:assert/strict";
import { parseNemiraHtml } from "./nemira.js";

test("Nemira parser reads final price from each book card", () => {
  const html = '<form class="product_addtocart_form"><img class="product-image-photo" src="https://nemira.ro/dune.jpg">'
    + '<div class="product-info"><a href="https://nemira.ro/dune">Dune</a></div><div class="flex">'
    + '<span data-price-amount="99" data-price-type="oldPrice">99 lei</span>'
    + '<span data-price-amount="69.3" data-price-type="finalPrice">69,30 lei</span></form>';
  assert.deepEqual(parseNemiraHtml(html).items, [{
    title: "Dune", price: "69.3 RON", currency: "RON", condition: "Nou",
    url: "https://nemira.ro/dune", imageUrl: "https://nemira.ro/dune.jpg"
  }]);
});
