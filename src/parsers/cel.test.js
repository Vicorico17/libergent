import test from "node:test";
import assert from "node:assert/strict";
import { parseCelHtml } from "./cel.js";

test("CEL parser reads the price, title, and image from product cards", () => {
  const html = '<div data-pid_prod="123" class="product_data productListing-tot">'
    + '<div class="productListing-poza"><img src="https://s1.cel.ro/ssd.jpg"></div>'
    + '<span class="price" content="1016">1016</span><span class="moneda">lei</span>'
    + '<h2 class="productTitle"><a href="https://www.cel.ro/ssd/" class="product_link"><span>SSD Samsung 1TB</span></a></h2>';
  assert.deepEqual(parseCelHtml(html).items, [{
    title: "SSD Samsung 1TB", price: "1016 RON", currency: "RON", condition: "Nou",
    url: "https://www.cel.ro/ssd/", imageUrl: "https://s1.cel.ro/ssd.jpg"
  }]);
});
