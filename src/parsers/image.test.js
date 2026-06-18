import test from "node:test";
import assert from "node:assert/strict";
import { extractImageCandidate } from "./image.js";
import { parseOlxHtml } from "./olx.js";

test("extractImageCandidate prefers lazy-load attributes and parses srcset", () => {
  const htmlWithDataSrc = '<img class="photo" data-src="//cdn.example.com/a.webp" src="/placeholder.jpg" />';
  assert.equal(extractImageCandidate(htmlWithDataSrc), "//cdn.example.com/a.webp");

  const htmlWithSrcset = '<img srcset="https://img.example.com/pic-640.webp 640w, https://img.example.com/pic-1200.webp 1200w" />';
  assert.equal(extractImageCandidate(htmlWithSrcset), "https://img.example.com/pic-1200.webp");

  const htmlWithDataPlaceholder = '<img src="data:image/gif;base64,abc" data-src="https://img.example.com/actual.webp" />';
  assert.equal(extractImageCandidate(htmlWithDataPlaceholder), "https://img.example.com/actual.webp");
});

test("extractImageCandidate prefers the displayed img src over responsive alternates", () => {
  const html = '<img src="https://frankfurt.apollo.olxcdn.com:443/v1/files/item-RO/image;s=216x152;q=50" srcSet="https://frankfurt.apollo.olxcdn.com:443/v1/files/item-RO/image;s=150x200;q=50 150w, https://frankfurt.apollo.olxcdn.com:443/v1/files/item-RO/image;s=510x680;q=50 600w" />';

  assert.equal(
    extractImageCandidate(html),
    "https://frankfurt.apollo.olxcdn.com:443/v1/files/item-RO/image;s=216x152;q=50"
  );
});

test("extractImageCandidate skips marketplace placeholder thumbnails", () => {
  const html = `
    <img src="https://www.olx.ro/app/static/media/no_thumbnail.15f456ec5.svg" />
    <img src="https://frankfurt.apollo.olxcdn.com:443/v1/files/item-RO/image;s=216x152;q=50" />
  `;

  assert.equal(
    extractImageCandidate(html),
    "https://frankfurt.apollo.olxcdn.com:443/v1/files/item-RO/image;s=216x152;q=50"
  );
  assert.equal(extractImageCandidate('<img src="https://www.olx.ro/app/static/media/no_thumbnail.15f456ec5.svg" />'), "");
});

test("parseOlxHtml keeps image when card uses lazy-loaded img attributes", () => {
  const html = `
    <div data-cy="l-card" data-testid="l-card">
      <a href="/d/oferta/test-1">
        <h4>Telefon Apple iPhone</h4>
      </a>
      <p data-testid="ad-price">2 450 lei</p>
      <p data-testid="location-date">Bucuresti - Azi</p>
      <img data-src="//images.olxcdn.com/item1.webp" src="/placeholder.png" />
    </div>
    <div data-cy="l-card" data-testid="l-card">
      <a href="/d/oferta/test-2">
        <h4>Telefon Samsung</h4>
      </a>
      <p data-testid="ad-price">1 900 lei</p>
      <p data-testid="location-date">Cluj - Ieri</p>
      <img srcset="https://images.olxcdn.com/item2-400.webp 400w, https://images.olxcdn.com/item2-800.webp 800w" />
    </div>
  `;

  const parsed = parseOlxHtml(html, 5);
  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.items[0].imageUrl, "https://images.olxcdn.com/item1.webp");
  assert.equal(parsed.items[1].imageUrl, "https://images.olxcdn.com/item2-800.webp");
});

test("parseOlxHtml infers RON currency for bare numeric OLX prices", () => {
  const html = `
    <div data-cy="l-card" data-testid="l-card">
      <a href="/d/oferta/test-price">
        <h4>Telefon Apple iPhone</h4>
      </a>
      <p data-testid="ad-price">849</p>
      <p data-testid="location-date">Timisoara - Azi</p>
    </div>
    <div data-cy="l-card" data-testid="l-card">
      <a href="/d/oferta/test-swap">
        <h4>Schimb iPhone</h4>
      </a>
      <p data-testid="ad-price">Schimb</p>
      <p data-testid="location-date">Bucuresti - Azi</p>
    </div>
  `;

  const parsed = parseOlxHtml(html, 5);
  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.items[0].price, "849");
  assert.equal(parsed.items[0].currency, "lei");
  assert.equal(parsed.items[1].price, "Schimb");
  assert.equal(parsed.items[1].currency, "");
});

test("parseOlxHtml recovers OLX images from embedded config when card has no thumbnail", () => {
  const html = String.raw`
    <script id="olx-init-config">
      window.__INIT_CONFIG__ = "{\"ads\":[{\"photos\":[\"https:\\u002F\\u002Ffrankfurt.apollo.olxcdn.com:443\\u002Fv1\\u002Ffiles\\u002Fdetail-RO\\u002Fimage;s=1500x2000\"],\"photosSet\":[\"https:\\u002F\\u002Ffrankfurt.apollo.olxcdn.com:443\\u002Fv1\\u002Ffiles\\u002Fdetail-RO\\u002Fimage;s=389x272 1x,https:\\u002F\\u002Ffrankfurt.apollo.olxcdn.com:443\\u002Fv1\\u002Ffiles\\u002Fdetail-RO\\u002Fimage;s=1000x700 3x\"],\"urlPath\":\"\\u002Fd\\u002Foferta\\u002Fdisplay-iphone-IDabc.html\"}]}";
    </script>
    <div data-cy="l-card" data-testid="l-card">
      <a href="/d/oferta/display-iphone-IDabc.html?search_reason=search%7Corganic">
        <img src="/app/static/media/no_thumbnail.15f456ec5.svg" />
        <h4>Display iPhone</h4>
      </a>
      <p data-testid="ad-price">700 lei</p>
      <p data-testid="location-date">Bucuresti - Azi</p>
    </div>
  `;

  const parsed = parseOlxHtml(html, 5);
  assert.equal(parsed.items.length, 1);
  assert.equal(
    parsed.items[0].imageUrl,
    "https://frankfurt.apollo.olxcdn.com:443/v1/files/detail-RO/image;s=1000x700"
  );
});

test("parseOlxHtml unwraps OLX optimized thumbnail URLs", () => {
  const target = "https://ireland.apollo.olxcdn.com/v1/files/item-RO/image;s=216x152;q=50";
  const optimized = `/_next/image?url=${encodeURIComponent(target)}&w=384&q=75`;
  const html = `
    <div data-cy="l-card" data-testid="l-card">
      <a href="/d/oferta/test-optimized">
        <h4>Telefon Apple iPhone</h4>
      </a>
      <p data-testid="ad-price">2 450 lei</p>
      <p data-testid="location-date">Bucuresti - Azi</p>
      <img src="${optimized}" />
    </div>
  `;

  const parsed = parseOlxHtml(html, 5);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].imageUrl, target);
});
