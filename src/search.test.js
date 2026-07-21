import test from "node:test";
import assert from "node:assert/strict";
import { __testables } from "./search.js";

const { filterRelevantItems, shouldRetryDirectFetchStatus } = __testables;

test("single-token query keeps only titles that match the token", () => {
  const items = [
    { title: "Samsung Galaxy S23 Ultra", url: "https://x/1" },
    { title: "Apple iPhone 14", url: "https://x/2" }
  ];

  const filtered = filterRelevantItems(items, "samsung");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].url, "https://x/1");
});

test("matching tolerates one-character typo for longer query tokens", () => {
  const items = [
    { title: "Aspirator Rowenta Silence Force", url: "https://x/1" },
    { title: "Aspirator Philips PowerPro", url: "https://x/2" }
  ];

  const filtered = filterRelevantItems(items, "aspirator rowneta");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].url, "https://x/1");
});

test("numeric query token remains mandatory for multi-token searches", () => {
  const items = [
    { title: "Apple iPhone 13 Pro 128GB", url: "https://x/1" },
    { title: "Apple iPhone Pro Max", url: "https://x/2" }
  ];

  const filtered = filterRelevantItems(items, "iphone 13");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].url, "https://x/1");
});

test("retries transient Cloudflare origin errors with the alternate header profile", () => {
  for (const status of [520, 521, 522, 523, 524]) {
    assert.equal(shouldRetryDirectFetchStatus(status), true);
  }
});
