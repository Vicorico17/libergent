import test from "node:test";
import assert from "node:assert/strict";
import { parseForitHtml } from "./forit.js";

test("extracts priced ForIT product data without navigation links", () => {
  const product = '{&quot;id&quot;:12,&quot;title&quot;:&quot;SSD Samsung 1TB&quot;,&quot;price&quot;:499.9,&quot;img&quot;:&quot;https://img.example/ssd.webp&quot;,&quot;href&quot;:&quot;/ssd-samsung-bp12&quot;}';
  const html = `<a href="/livrarea-produselor/mi3">Livrare gratuită peste 300 lei</a><button data-product='${product}'></button><button data-product='${product}'></button>`;
  const result = parseForitHtml(html, 20);
  assert.equal(result.rawItemCount, 1);
  assert.deepEqual(result.items[0], {
    title: "SSD Samsung 1TB", price: "499.9 RON", currency: "RON", condition: "Nou",
    url: "https://www.forit.ro/ssd-samsung-bp12", imageUrl: "https://img.example/ssd.webp"
  });
});
