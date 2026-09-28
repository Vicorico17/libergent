import test from "node:test";
import assert from "node:assert/strict";
import { parseFootshopHtml } from "./footshop.js";
import { parseMobexpertHtml } from "./mobexpert.js";
import { parseMakeupHtml } from "./makeup.js";
import { parseFashionDaysHtml } from "./fashiondays.js";
import { parsePlaybikeHtml } from "./playbike.js";
import { SITES } from "../sites.js";

test("Footshop reads the current price from its listing payload", () => {
  const payload = { data: { state: { products: { items: [
    { name: "adidas Samba OG", url: "sneakers/123-adidas-samba.html", price: { value: 390, currency_code: "RON" }, image: "https://example.test/a.jpg", in_stock: true },
    { name: "Sold out", url: "sneakers/456-sold-out.html", price: { value: 200, currency_code: "RON" }, sold_out: true }
  ] } } } };
  const html = `<script data-hypernova-key="ProductListing"><!--${JSON.stringify(payload)}--></script>`;
  const result = parseFootshopHtml(html, 10);
  assert.deepEqual(result.items.map(({ price, url }) => [price, url]),
    [["390 RON", "https://www.footshop.ro/ro/sneakers/123-adidas-samba.html"]]);
  assert.match(SITES["footshop.ro"].searchUrl("adidas samba"), /controller=search&search_query=adidas%20samba/);
});

test("Mobexpert converts Shopify cents and keeps the matching product handle", () => {
  const html = `<script>searchResult.push(${JSON.stringify({ title: "Canapea extensibila", handle: "canapea-test", price: 617190, available: true, featured_image: "//mobexpert.ro/a.jpg" })});</script>`;
  const result = parseMobexpertHtml(html, 10);
  assert.equal(result.items[0].price, "6171.9 RON");
  assert.equal(result.items[0].url, "https://mobexpert.ro/products/canapea-test");
  assert.match(SITES["mobexpert.ro"].searchUrl("canapea extensibila"), /search\?q=canapea%20extensibila&type=product/);
});

test("MAKEUP uses the current product-card price", () => {
  const html = `<div class="ProductCard__cardContainer"><a class="ProductCard__title" href="/product/123/">Dama Bianca</a>
    <div class="ProductCard__subTitle">Apă de parfum</div><span class="Price__priceOld">699 lei</span>
    <span class="Price__priceCurrent">589 lei</span><img src="https://makeup.test/a.jpg"></div>`;
  const result = parseMakeupHtml(html, 10);
  assert.equal(result.items[0].price, "589 RON");
  assert.equal(result.items[0].url, "https://makeup.ro/product/123/");
});

test("Fashion Days uses each card's current tracking price", () => {
  const html = `<li class="product-card"><a href="https://www.fashiondays.ro/p/samba-p123/?gtm_data=1" data-gtm-price="269.99"
    data-gtm-name="Pantofi Samba" data-gtm-brand-name="adidas Originals" data-gtm-status="limited_quantity"></a>
    <img data-original="https://example.test/samba.jpg"></li>`;
  const result = parseFashionDaysHtml(html, 10);
  assert.equal(result.items[0].price, "269.99 RON");
  assert.equal(result.items[0].url, "https://www.fashiondays.ro/p/samba-p123/");
  assert.match(SITES["fashiondays.ro"].searchUrl("adidas samba"), /\/search\/\?q=adidas%20samba/);
});

test("PlayBike converts bani and excludes unavailable products", () => {
  const products = { productList: { items: [
    { name: "Bicicleta MTB", url: "https://www.playbike.ro/produs/bicicleta-mtb-123", price: 559600, availabilityStatus: "green" },
    { name: "Bicicleta epuizata", url: "https://www.playbike.ro/produs/bicicleta-456", price: 430000, availabilityStatus: "red" }
  ] } };
  const html = `<script>window['plyPageData'] = ${JSON.stringify(products)};</script>`;
  const result = parsePlaybikeHtml(html, 10);
  assert.deepEqual(result.items.map(({ price, url }) => [price, url]),
    [["5596 RON", "https://www.playbike.ro/produs/bicicleta-mtb-123"]]);
  assert.match(SITES["playbike.ro"].searchUrl("bicicleta mtb"), /cautare\?cautare=bicicleta%20mtb/);
  assert.match(SITES["itgalaxy.ro"].searchUrl("lenovo v15"), /cauta\/\?search=lenovo%20v15/);
  assert.match(SITES["kondela.ro"].searchUrl("canapea extensibila"), /rezultatele-cautarii\/\?term=canapea%20extensibila/);
});
