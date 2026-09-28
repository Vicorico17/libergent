import test from "node:test";
import assert from "node:assert/strict";
import { parseLibrisHtml } from "./libris.js";

test("Libris parser takes the sale price and book link from each card", () => {
  const html = '<li class="categ-prod-item gtmContainer"><img src="https://cdn.libris.ro/dune.jpg" alt="Coperta cărții Dune">'
    + '<a href="/carte/dune/123"><h3 class="pr-title-categ-pg">Dune</h3></a>'
    + '<p class="box-pr-price-prp">PRP: 89.99 Lei</p><p class="price-reduced">71.99 Lei</p>'
    + '<a href="/preview/dune/123">Rasfoieste</a>';
  assert.deepEqual(parseLibrisHtml(html).items, [{
    title: "Dune", price: "71.99 Lei", currency: "RON", condition: "Nou",
    url: "https://www.libris.ro/carte/dune/123", imageUrl: "https://cdn.libris.ro/dune.jpg"
  }]);
});
