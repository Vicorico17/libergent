import test from "node:test";
import assert from "node:assert/strict";
import { extractImageCandidate } from "./image.js";
import { parseOlxHtml } from "./olx.js";

test("extractImageCandidate prefers lazy-load attributes and parses srcset", () => {
  const htmlWithDataSrc = '<img class="photo" data-src="//cdn.example.com/a.webp" src="/placeholder.jpg" />';
  assert.equal(extractImageCandidate(htmlWithDataSrc), "//cdn.example.com/a.webp");

  const htmlWithSrcset = '<img srcset="https://img.example.com/pic-640.webp 640w, https://img.example.com/pic-1200.webp 1200w" />';
  assert.equal(extractImageCandidate(htmlWithSrcset), "https://img.example.com/pic-640.webp");

  const htmlWithDataPlaceholder = '<img src="data:image/gif;base64,abc" data-src="https://img.example.com/actual.webp" />';
  assert.equal(extractImageCandidate(htmlWithDataPlaceholder), "https://img.example.com/actual.webp");
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
  assert.equal(parsed.items[1].imageUrl, "https://images.olxcdn.com/item2-400.webp");
});
