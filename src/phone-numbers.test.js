import test from "node:test";
import assert from "node:assert/strict";
import { extractRomanianPhones, normalizeRomanianPhone } from "./phone-numbers.js";

test("normalizes Romanian phone numbers to E.164", () => {
  assert.equal(normalizeRomanianPhone("0722 123 456"), "+40722123456");
  assert.equal(normalizeRomanianPhone("0040 722 123 456"), "+40722123456");
  assert.equal(normalizeRomanianPhone("+40 (722) 123-456"), "+40722123456");
  assert.equal(normalizeRomanianPhone("123"), null);
});

test("extracts and deduplicates Romanian phones from text", () => {
  assert.deepEqual(
    extractRomanianPhones("Sună la 0722 123 456 sau +40 722 123 456; email ignored."),
    ["+40722123456"]
  );
});
