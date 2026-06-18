import test from "node:test";
import assert from "node:assert/strict";
import { parseAnuntulHtml } from "./anuntul.js";

test("parseAnuntulHtml extracts classified cards", () => {
  const html = `
    <div class="h4 mb-1">Am gasit <small> - 88 anunturi</small></div>
    <link rel="next" href="/anunturi/?q=iphone&amp;page=2">
    <div class="pb-2 bg-white itm">
      <div id="aid-66573221" class="card impression pt-1 py-1">
        <img src="//stor0.anuntul.ro/media/foto/landscape/iphone.jpg" class="img-fluid">
        <div class="card-title h5">
          <a href="/anunt-iphone-15-pro-max-256gb#qoQvka ">iPhone 15 Pro Max 256GB</a>
        </div>
        <div class="card-text fs-5 fw-bold text-red-at">4.700 RON</div>
        <div class="anunt-etichete">
          <span>Telefoane mobile</span>
          <span>Apple</span>
          <span>Nou</span>
        </div>
        <span class="float-end mt-1 d-inline-block text-end"> Bucuresti, azi; 07:41 </span>
      </div>
    </div>
    <div class="pb-2 bg-white itm">
      <div id="aid-66573222" class="card impression pt-1 py-1">
        <img src="/build/no-photo/landscape.svg" class="img-fluid">
        <div class="card-title h5">
          <a href="/anunt-iphone-14">Apple iPhone 14</a>
        </div>
        <div class="card-text fs-5 fw-bold text-red-at">350 €</div>
        <div class="anunt-etichete">
          <span>Telefoane mobile</span>
          <span>Utilizat</span>
        </div>
        <span class="float-end mt-1 d-inline-block text-end"> Cluj-Napoca, 16 Iunie '26 </span>
      </div>
    </div>
  `;

  const parsed = parseAnuntulHtml(html, 10);
  assert.equal(parsed.totalResults, 88);
  assert.equal(parsed.rawItemCount, 2);
  assert.equal(parsed.hasNextPage, true);
  assert.equal(parsed.items.length, 2);
  assert.deepEqual(parsed.items[0], {
    title: "iPhone 15 Pro Max 256GB",
    price: "4.700 RON",
    currency: "RON",
    location: "Bucuresti",
    postedAt: "azi; 07:41",
    condition: "Nou",
    sellerType: "Telefoane mobile, Apple",
    url: "https://www.anuntul.ro/anunt-iphone-15-pro-max-256gb#qoQvka",
    imageUrl: "https://stor0.anuntul.ro/media/foto/landscape/iphone.jpg",
    imageUrls: ["https://stor0.anuntul.ro/media/foto/landscape/iphone.jpg"]
  });
  assert.equal(parsed.items[1].currency, "EUR");
  assert.equal(parsed.items[1].imageUrl, "");
});
