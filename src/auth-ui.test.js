import test from "node:test";
import assert from "node:assert/strict";
import { normalizedAuthEmail, friendlyAuthError, callbackProviderError, getSafeNextPath } from "../ui/src/lib/auth-flow.mjs";

test("email auth validates addresses and shows recoverable errors without leaking provider details", () => {
  assert.equal(normalizedAuthEmail(" Buyer@Example.RO "), "buyer@example.ro");
  for (const email of ["", "a@", "a@@b.ro", "a b@c.ro", "a@b", "a".repeat(255) + "@test.ro"]) assert.equal(normalizedAuthEmail(email), null);
  assert.match(friendlyAuthError(new TypeError("Failed to fetch")), /internetul/);
  assert.match(friendlyAuthError({ message: "email rate limit exceeded" }), /minut/);
  assert.ok(!friendlyAuthError("unexpected database error: private detail").includes("private detail"));
});

test("callback handles OAuth query errors and expired implicit-flow email links", () => {
  assert.match(callbackProviderError("?error=access_denied", ""), /anulată/);
  assert.match(callbackProviderError("?next=%2Faccount", "#error=access_denied&error_description=Email+link+is+invalid+or+has+expired"), /expirat/);
  assert.equal(callbackProviderError("?code=valid", ""), null);
  assert.equal(getSafeNextPath("?next=%2Fsearch%3Fq%3Diphone"), "/search?q=iphone");
  for (const next of ["https://evil.test", "//evil.test", "/\\evil.test", "/\n/evil.test", "/\t/evil.test"]) {
    assert.equal(getSafeNextPath(`?next=${encodeURIComponent(next)}`), "/");
  }
});
