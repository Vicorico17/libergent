import test from "node:test";
import assert from "node:assert/strict";
import { ADULT_HEADER, hasAdultConfirmation, issueAdultConfirmation } from "./adult-access.js";
import { getSearchQueryError, isAdultProductQuery, isPublicSearchQuery } from "./search-policy.js";
import { buildHistoryPayloadFromEntries } from "./history-base.js";
import { normalizeSavedSearchPayload } from "./saved-searches.js";
import { normalizeAlertProfile } from "./alerts.js";
import { isEligibleProbeQuery } from "./discovery-probes.js";
import { aggregateMarketplaceResults } from "./aggregate.js";
import worker from "./worker.js";
import { searchAcrossSites } from "./app.js";

const env = { ADULT_CONFIRMATION_SECRET: "local-test-secret-not-for-production-123456", LIBERGENT_MOCK_SEARCH: "1" };
const request = (path, token = "") => new Request(`https://libergent.test${path}`, { headers: { [ADULT_HEADER]: token } });

test("adult product classification preserves ordinary searches and rejects pornography", () => {
  for (const query of ["Lovense Lush 3", "LOVENSE", "lo-vense", "Ｌｏｖｅｎｓｅ", "vibrator", "vibratoare", "jucării erotice", "We-Vibe", "sexual wellness", "dildo"]) {
    assert.equal(isAdultProductQuery(query), true, query);
    assert.equal(isPublicSearchQuery(query), false, query);
    assert.equal(isEligibleProbeQuery(query), false, query);
  }
  assert.equal(isPublicSearchQuery("iphone 16"), true);
  assert.equal(getSearchQueryError("Lovense Lush 3"), null);
  assert.ok(getSearchQueryError("porn videos"));
});

test("confirmation is signed, expires exactly, and fails closed without a server secret", async () => {
  const now = Date.now();
  const issued = await issueAdultConfirmation(env, now);
  assert.equal(await hasAdultConfirmation(request("/", issued.token), env, now), true);
  assert.equal(await hasAdultConfirmation(request("/", issued.token), env, issued.expiresAt), false);
  assert.equal(await hasAdultConfirmation(request("/", issued.token + "x"), env, now), false);
  assert.equal(await hasAdultConfirmation(request("/", issued.token.replace(/^\d/, "9")), env, now), false);
  assert.equal(await hasAdultConfirmation(request("/", "true"), env, now), false);
  assert.equal(await hasAdultConfirmation(request("/", issued.token), {}, now), false);
  assert.equal(await issueAdultConfirmation({}), null);
});

test("only explicit boolean confirmation issues access; refusal and cross-origin requests do not", async () => {
  for (const confirm of [false, "true", 1, null]) {
    const response = await worker.fetch(new Request("https://libergent.test/api/adult-access", {
      method: "POST", body: JSON.stringify({ confirm, category: "adult" })
    }), env);
    const payload = await response.json();
    assert.equal(payload.required, true);
    assert.equal(payload.confirmed, false);
    assert.equal(payload.token, undefined);
  }
  const response = await worker.fetch(new Request("https://libergent.test/api/adult-access", {
    method: "POST", body: JSON.stringify({ confirm: true }), headers: { origin: "https://other.test" }
  }), env);
  assert.equal(response.status, 403);
  const accepted = await worker.fetch(new Request("https://libergent.test/api/adult-access", {
    method: "POST", body: JSON.stringify({ confirm: true })
  }), env);
  assert.ok((await accepted.json()).token);
  assert.equal(accepted.headers.get("cache-control"), "no-store");
  const devOrigin = await worker.fetch(new Request("http://localhost:8787/api/adult-access", {
    method: "POST", body: JSON.stringify({ confirm: true }), headers: { origin: "http://localhost:3000" }
  }), { ...env, LIBERGENT_PUBLIC_URL: "http://localhost:3000" });
  assert.equal(devOrigin.status, 200);
});

test("direct free, alias, premium, trailing-slash and category paths gate before providers or caches", async (t) => {
  const originalCaches = globalThis.caches;
  t.after(() => { globalThis.caches = originalCaches; });
  let reads = 0;
  globalThis.caches = { default: { match: async () => { reads++; throw Error("must not read cache"); } } };
  const expired = await issueAdultConfirmation(env, Date.now() - 31 * 60 * 1000);
  for (const path of ["/api/search?q=Lovense", "/api/search/free/?q=Lovense", "/api/search/premium?q=Lovense", "/api/search/free?q=Lush&category=adult"]) {
    for (const token of ["", "true", expired.token]) {
      const response = await worker.fetch(request(path, token), env);
      assert.equal(response.status, 403, path);
      assert.equal((await response.json()).code, "adult_confirmation_required");
    }
  }
  assert.equal(reads, 0);
});

test("confirmed product search bypasses caches and persistence even for unclassified category queries", async (t) => {
  const originalCaches = globalThis.caches;
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.caches = originalCaches; globalThis.fetch = originalFetch; });
  globalThis.caches = { default: { match: () => assert.fail("adult cache read"), put: () => assert.fail("adult cache write") } };
  globalThis.fetch = () => assert.fail("adult history/provider network call in mocked search");
  const { token } = await issueAdultConfirmation(env);
  for (const query of ["Lovense Lush 3", "Lush"]) {
    const response = await worker.fetch(request(`/api/search/free?q=${encodeURIComponent(query)}&category=adult&site=olx.ro`, token), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.ok((await response.json()).results);
  }
});

test("unrelated search results cannot leak adult offers through recommendations", () => {
  const payload = aggregateMarketplaceResults([{ ok: true, site: "olx.ro", query: "iphone", items: [
    { title: "Lovense Lush", url: "https://example.test/lovense", priceRon: 100, condition: "nou" }
  ] }]);
  assert.equal(JSON.stringify(payload).includes("Lovense"), false);
  assert.equal(payload.summary.bestOffer, null);
});

test("historical adult entries and their keywords/offers are removed from public history", () => {
  const history = buildHistoryPayloadFromEntries([
    { query: "Lovense Lush", searchedAt: "2026-10-26" },
    { query: "iphone", searchedAt: "2026-10-26" },
    { query: "massager", bestOffer: { title: "Lovense" }, searchedAt: "2026-10-26" }
  ]);
  assert.equal(history.totals.searches, 1);
  assert.deepEqual(history.topKeywords, [{ value: "iphone", count: 1 }]);
  assert.throws(() => normalizeSavedSearchPayload({ email: "test@example.test", query: "Lovense" }), /cannot be saved/);
  assert.throws(() => normalizeAlertProfile({ query: "Lovense" }), /background alerts/);
});

test("background and CLI callers fail before adult provider work without explicit authorization", async () => {
  await assert.rejects(searchAcrossSites({ query: "Lovense", siteKeys: ["olx.ro"] }), /Adult confirmation required/);
});

test("confirmed aggregation retains sexual-wellness products but never pornography", () => {
  const payload = aggregateMarketplaceResults([{ ok: true, site: "olx.ro", query: "Lovense Lush 3", items: [
    { title: "Lovense Lush 3", url: "https://example.test/lush", priceRon: 499, condition: "nou" },
    { title: "Lovense porn video", url: "https://example.test/video", priceRon: 1, condition: "nou" }
  ] }], { allowAdult: true });
  assert.ok(JSON.stringify(payload).includes("Lovense Lush 3"));
  assert.equal(JSON.stringify(payload).includes("porn video"), false);
});

test("legacy adult cache contents cannot leak into an ordinary search", async (t) => {
  const originalCaches = globalThis.caches;
  t.after(() => { globalThis.caches = originalCaches; });
  let reads = 0;
  globalThis.caches = { default: {
    match: async () => { reads++; return new Response(JSON.stringify({ summary: { bestOffer: { title: "Lovense" } }, results: [] })); },
    put: async () => {}
  } };
  const response = await worker.fetch(request("/api/search/free?q=iphone&site=olx.ro"), env);
  assert.equal(response.status, 200);
  assert.equal(reads, 1);
  assert.equal((await response.text()).includes("Lovense"), false);
});
