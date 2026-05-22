import test from "node:test";
import assert from "node:assert/strict";
import { parseBoundedPositiveInteger } from "./api-params.js";

test("parseBoundedPositiveInteger clamps valid client values", () => {
  assert.equal(parseBoundedPositiveInteger("500", { name: "limit", max: 240 }), 240);
  assert.equal(parseBoundedPositiveInteger("3", { name: "pages", max: 4 }), 3);
  assert.equal(parseBoundedPositiveInteger(null, { name: "limit", max: 240 }), undefined);
});

test("parseBoundedPositiveInteger rejects invalid client values", () => {
  assert.throws(
    () => parseBoundedPositiveInteger("0", { name: "limit", max: 240 }),
    /Expected limit to be a positive integer/
  );
});
