import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMarketplaceQuery } from "./query-normalization.js";

test("normalizes common marketplace query typos before searching", () => {
  assert.equal(normalizeMarketplaceQuery("anveolpe audi"), "anvelope audi");
  assert.equal(normalizeMarketplaceQuery("Anvelpe BMW"), "anvelope BMW");
});
