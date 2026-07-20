import test from "node:test";
import assert from "node:assert/strict";
import { parsePubli24Html } from "./publi24.js";

test("reuses Publi24-family cards with the BestAuto origin", () => {
  const html = `
    <div class="article-item">
      <div class="article-txt-wrap">
        <h2 class="article-title"><a href="/anunturi/auto-moto/masini-second-hand/bmw/anunt/bmw-x5/test.html">BMW X5 2020 xDrive</a></h2>
        <span class="article-price"><span class="new-price">32 500 EUR</span></span>
        <img src="/images/bmw-x5.jpg" alt="BMW X5" />
        <p class="article-location"><span>București</span></p>
      </div>
    </div>
  `;

  const parsed = parsePubli24Html(html, 10, { origin: "https://www.bestauto.ro" });

  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].title, "BMW X5 2020 xDrive");
  assert.equal(parsed.items[0].price, "32 500 EUR");
  assert.equal(parsed.items[0].url, "https://www.bestauto.ro/anunturi/auto-moto/masini-second-hand/bmw/anunt/bmw-x5/test.html");
  assert.equal(parsed.items[0].imageUrl, "https://www.bestauto.ro/images/bmw-x5.jpg");
});
