import test from "node:test";
import assert from "node:assert/strict";

import { parseOkaziiHtml } from "../src/parsers/okazii.js";

test("parses standard Okazii listing wrappers", () => {
  const html = `
    <link rel="next" href="/cautare/iphone+15+pro.html?page=2" />
    <meta name="description" content="2931 oferte pentru Iphone 15 pro" />
    <div class="lising-old-li ">
      <div class="list-item">
        <img src="/img-1.jpg" />
        <div class="item-title">
          <a href="/produs-1" title="Apple iPhone 15 Pro">Apple iPhone 15 Pro</a>
        </div>
        <div>2.499,00 Lei</div>
      </div>
    </div>
  `;

  const parsed = parseOkaziiHtml(html, 10);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].title, "Apple iPhone 15 Pro");
  assert.equal(parsed.items[0].url, "https://www.okazii.ro/produs-1");
  assert.equal(parsed.totalResults, 2931);
  assert.equal(parsed.hasNextPage, true);
});

test("falls back to item-title extraction when wrapper class drifts", () => {
  const html = `
    <h1>Iphone 15 pro</h1><span>(2931 oferte)</span>
    <section class="result-card">
      <div class="item-media"><img data-src="/img-2.jpg" /></div>
      <div class="item-title">
        <a href="/produs-2" title="iPhone 15 Pro Max">iPhone 15 Pro Max</a>
      </div>
      <div>3.099,00 Lei</div>
    </section>
  `;

  const parsed = parseOkaziiHtml(html, 10);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].title, "iPhone 15 Pro Max");
  assert.equal(parsed.items[0].url, "https://www.okazii.ro/produs-2");
  assert.equal(parsed.items[0].price, "3.099,00 Lei");
  assert.equal(parsed.items[0].imageUrl, "https://www.okazii.ro/img-2.jpg");
});
