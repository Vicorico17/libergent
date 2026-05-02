import test from "node:test";
import assert from "node:assert/strict";

import { parseVintedHtml, parseVintedMarkdown } from "../src/parsers/vinted.js";

test("extracts postedAt from Vinted HTML card metadata", () => {
  const html = `
    <div data-testid="grid-item">
      <a href="/items/123-test" title="iPhone 15 Pro, stare: Foarte bună, 4500 Lei">
        <img src="https://images.vinted.net/123.jpg" alt="iPhone 15 Pro">
      </a>
      <p>București · Acum 2 ore</p>
    </div>
  `;

  const result = parseVintedHtml(html, 10);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].postedAt, "Acum 2 ore");
});

test("extracts postedAt from Vinted markdown metadata", () => {
  const markdown = `
Rezultate căutare
![iPhone](https://images.vinted.net/abc.jpg)
[iPhone 15 Pro, stare: Foarte bună, 4500 RON](https://www.vinted.ro/items/123-test)
4.500 RON
București, România
Azi
`;

  const result = parseVintedMarkdown(markdown, 10);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].postedAt, "Azi");
});
