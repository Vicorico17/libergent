import test from "node:test";
import assert from "node:assert/strict";
import { SNAPSHOT_MAX_AGE_MS, searchSnapshotKey, readSearchSnapshot, writeSearchSnapshot, describeSnapshotChange } from "../ui/src/lib/search-snapshot.mjs";

function storage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key: i => [...values.keys()][i] ?? null,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
}
const key = searchSnapshotKey({ query: "iphone 15", tier: "premium", userId: "buyer" });
function snapshot() {
  return { id: "stable-id", savedAt: Date.now(), payload: { summary: { searchedAt: "2026-09-25T10:00:00Z", bestUsedOffer: { url: "/one" } }, results: [{ site: "olx.ro", ok: true }] }, mapped: [{ id: "one", url: "/one", price: 100, rank: 1 }, { id: "two", url: "/two", price: 200, rank: 2 }], exclusions: [{ listingId: "two", signatureTokens: ["iphone"], reason: "wrong_model" }] };
}

test("reload restores exact order, recommendation, collection time and rejected matches beyond API cache expiry", () => {
  const tab = storage();
  const original = snapshot();
  assert.equal(writeSearchSnapshot(tab, key, original), true);
  assert.deepEqual(readSearchSnapshot(tab, key, original.savedAt + 3600000), original);
  assert.deepEqual(readSearchSnapshot(tab, key, original.savedAt + 2 * 3600000), original);
});

test("snapshot keys isolate accounts, tiers, locations and request bounds", () => {
  const input = { query: "iphone 15", tier: "premium", userId: "buyer", near: "Cluj", limit: 100, pages: 2 };
  assert.equal(searchSnapshotKey(input), searchSnapshotKey({ ...input, query: " IPHONE 15 " }));
  for (const change of [{ userId: "other" }, { userId: "" }, { tier: "free" }, { near: "Bucuresti" }, { limit: 10 }, { pages: 1 }, { query: "iphone 16" }]) {
    assert.notEqual(searchSnapshotKey(input), searchSnapshotKey({ ...input, ...change }));
  }
});

test("retention expires after 24 hours without extending on restore or feedback updates", () => {
  const tab = storage();
  const original = snapshot();
  writeSearchSnapshot(tab, key, original);
  const restored = readSearchSnapshot(tab, key, original.savedAt + SNAPSHOT_MAX_AGE_MS - 1);
  restored.exclusions = [];
  writeSearchSnapshot(tab, key, restored);
  assert.equal(readSearchSnapshot(tab, key, original.savedAt + SNAPSHOT_MAX_AGE_MS), null);
});

test("empty successful snapshots are preserved and malformed or blocked storage fails safely", () => {
  const tab = storage();
  const empty = { ...snapshot(), mapped: [], exclusions: [] };
  writeSearchSnapshot(tab, key, empty);
  assert.deepEqual(readSearchSnapshot(tab, key), empty);
  tab.setItem(key, "broken json");
  assert.equal(readSearchSnapshot(tab, key), null);
  tab.setItem(key, JSON.stringify({ savedAt: Date.now() }));
  assert.equal(readSearchSnapshot(tab, key), null);
  const blocked = { getItem() { throw Error("Denied"); }, setItem() { throw Error("Quota"); }, length: 0 };
  assert.equal(readSearchSnapshot(blocked, key), null);
  assert.equal(writeSearchSnapshot(blocked, key, empty), false);
});

test("storage retains at most five snapshots and leaves unrelated state untouched", () => {
  const tab = storage();
  tab.setItem("other-feature", "value");
  for (let i = 0; i < 8; i++) writeSearchSnapshot(tab, searchSnapshotKey({ query: `phone ${i}` }), { ...snapshot(), savedAt: Date.now() - 100 + i });
  assert.equal(tab.length, 6);
  assert.equal(tab.getItem("other-feature"), "value");
  assert.equal(readSearchSnapshot(tab, searchSnapshotKey({ query: "phone 0" })), null);
  assert.ok(readSearchSnapshot(tab, searchSnapshotKey({ query: "phone 7" })));
});

test("new-scan summary explains changed inventory, prices, recommendation and source failure", () => {
  const previous = snapshot();
  const next = snapshot();
  next.mapped = [{ id: "one", url: "/one", price: 90 }, { id: "three", url: "/three", price: 80 }];
  next.payload.summary.bestUsedOffer.url = "/three";
  next.payload.results.push({ site: "vinted.ro", ok: false });
  const description = describeSnapshotChange(previous, next);
  assert.match(description, /1 oferte noi, 1 oferte lipsă.*1 prețuri schimbate/);
  assert.match(description, /Recomandarea s-a schimbat/);
  assert.match(description, /vinted.ro/);
  assert.match(description, /nu sunt neapărat vândute/);
  assert.match(describeSnapshotChange(previous, previous), /Recomandarea principală s-a păstrat/);
});
