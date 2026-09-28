import test from "node:test";
import assert from "node:assert/strict";
import { parsePhotoSetupHtml } from "./photosetup.js";

test("PhotoSetup parser keeps the product card title, current price, and image", () => {
  const html = '<li class="js-pagination-result"><product-card>'
    + '<img srcset="//www.photosetup.ro/sony.jpg?width=400 400w" class="card__main-image">'
    + '<p class="card__title"><a href="/products/sony-a7">Sony A7 IV</a></p>'
    + '<span class="price__current"><span class="js-value">10.499,00 lei</span></span>'
    + '</product-card>';
  assert.deepEqual(parsePhotoSetupHtml(html).items, [{
    title: "Sony A7 IV", price: "10.499,00 lei", currency: "RON", condition: "Nou",
    url: "https://www.photosetup.ro/products/sony-a7", imageUrl: "https://www.photosetup.ro/sony.jpg?width=400"
  }]);
});
