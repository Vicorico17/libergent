import test from "node:test";
import assert from "node:assert/strict";
import { extractPhonesFromListing, extractRomanianPhones, normalizeRomanianMobilePhone, normalizeRomanianPhone } from "./phone-numbers.js";

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


test("normalizes only Romanian mobile numbers for WhatsApp", () => {
  assert.equal(normalizeRomanianMobilePhone("076 720 9070"), "+40767209070");
  assert.equal(normalizeRomanianMobilePhone("+40201100020"), null);
});

test("listing contact extraction skips fixed-line and support numbers", () => {
  assert.deepEqual(
    extractPhonesFromListing({ html: "support +40201100020 seller 076 720 9070" }),
    ["+40767209070"]
  );
});
