import test from "node:test";
import assert from "node:assert/strict";
import { buildAlertEvents, listingMatchesAlert, normalizeAlertProfile, validateAlertScan } from "./alerts.js";

const listing = {
  title: "BMW 320d 2019 automat",
  condition: "145.000 km • Diesel • 2019",
  priceRon: 85000,
  location: "București",
  url: "https://www.autovit.ro/autoturisme/anunt/bmw-320-ID1.html",
  site: "autovit.ro",
  recommendationScore: 78,
  dealQuality: { score: 81 },
  evidenceConfidence: { score: 72 },
  riskFlags: []
};

test("normalizes structured premium alert criteria", () => {
  const profile = normalizeAlertProfile({ query: " BMW 320d ", criteria: { priceMaxRon: "90000", yearFrom: "2018", mileageMaxKm: "180000" }, frequency: "immediate" });
  assert.equal(profile.query, "BMW 320d");
  assert.equal(profile.criteria.priceMaxRon, 90000);
  assert.equal(profile.criteria.yearFrom, 2018);
  assert.equal(profile.frequency, "immediate");
});

test("matches vehicle facts against alert criteria", () => {
  const profile = normalizeAlertProfile({ query: "BMW 320d", criteria: { priceMaxRon: 90000, yearFrom: 2018, mileageMaxKm: 180000, location: "București" } });
  assert.equal(listingMatchesAlert(listing, profile), true);
  assert.equal(listingMatchesAlert({ ...listing, priceRon: 95000 }, profile), false);
});

test("creates deduplicatable new-match and price-drop events", () => {
  const profile = { id: "alert-1", ...normalizeAlertProfile({ query: "BMW 320d" }) };
  const first = buildAlertEvents(profile, [listing], new Map());
  assert.equal(first.events[0].type, "new_strong_match");

  const previous = new Map([[listing.url, { latest_price_ron: 92000, snapshot: listing }]]);
  const dropped = buildAlertEvents(profile, [listing], previous);
  assert.equal(dropped.events[0].type, "price_drop");
  assert.equal(dropped.events[0].payload.dropRon, 7000);
});

test('new-match thresholds, disabled events and unchanged inventory stay quiet', () => {
  const profile = { id: 'alert-1', ...normalizeAlertProfile({ query: 'BMW' }) };
  assert.equal(buildAlertEvents(profile, [{ ...listing, recommendationScore: 64 }]).events.length, 0);
  assert.equal(buildAlertEvents(profile, [{ ...listing, evidenceConfidence: { score: 39 } }]).events.length, 0);
  assert.equal(buildAlertEvents(profile, [{ ...listing, recommendationScore: 65, evidenceConfidence: { score: 40 } }]).events[0].type, 'new_strong_match');
  const prior = new Map([[listing.url, { latest_price_ron: listing.priceRon, snapshot: listing }]]);
  assert.equal(buildAlertEvents(profile, [listing], prior).events.length, 0);
  const disabled = { ...profile, events: { newStrongMatch: false, priceDrop: false, betterThanShortlist: false } };
  assert.equal(buildAlertEvents(disabled, [listing]).events.length, 0);
  assert.equal(buildAlertEvents(disabled, [{ ...listing, priceRon: 70000 }], prior).events.length, 0);
});

test('better offer takes precedence over new match and has a stable event key', () => {
  const profile = { id: 'alert-1', ...normalizeAlertProfile({ query: 'BMW' }) };
  const prior = new Map([['https://example.test/old', { latest_price_ron: 90000, snapshot: { recommendationScore: 60 } }]]);
  const first = buildAlertEvents(profile, [listing], prior).events;
  assert.equal(first.length, 1);
  assert.equal(first[0].type, 'better_than_shortlist');
  assert.equal(buildAlertEvents(profile, [listing], prior).events[0].eventKey, first[0].eventKey);
});

test('price drop triggers at either 1000 RON or five percent', () => {
  const profile = { id: 'alert-1', ...normalizeAlertProfile({ query: 'BMW' }) };
  for (const [oldPrice, priceRon, expected] of [[100000, 99001, 0], [100000, 99000, 1], [10000, 9500, 1], [10000, 11000, 0]]) {
    const prior = new Map([[listing.url, { latest_price_ron: oldPrice, snapshot: listing }]]);
    assert.equal(buildAlertEvents(profile, [{ ...listing, priceRon }], prior).events.length, expected);
  }
});

test('vehicle criteria reject missing facts, wrong location and invalid prices', () => {
  const profile = normalizeAlertProfile({ query: 'BMW', criteria: { yearFrom: 2018, mileageMaxKm: 180000, location: 'București' } });
  for (const item of [
    { ...listing, title: 'BMW', condition: '' },
    { ...listing, condition: '190000 km' },
    { ...listing, location: 'Cluj' },
    { ...listing, priceRon: 'unknown' },
    { ...listing, url: '' }
  ]) assert.equal(listingMatchesAlert(item, profile), false);
  assert.throws(() => normalizeAlertProfile({ query: ' ' }), /query/);
});


test('product notifications require relevance and deduplicate repeated listing URLs', () => {
  const profile = { id: 'product-alert', ...normalizeAlertProfile({ query: 'iphone', events: { newProducts: true, newStrongMatch: false } }) };
  const product = { ...listing, relevanceScore: 80 };
  assert.equal(buildAlertEvents(profile, [product, product]).events.length, 1);
  assert.equal(buildAlertEvents(profile, [product]).events[0].type, 'new_match');
  assert.equal(buildAlertEvents(profile, [{ ...product, relevanceScore: 20 }]).events.length, 0);
  for (const price of ['', ' ', null, -1, 0]) assert.equal(listingMatchesAlert({ ...listing, priceRon: price }, profile), false);
  assert.equal(listingMatchesAlert({ ...listing, url: 'javascript:alert(1)' }, profile), false);
});

test('source failures cannot establish baseline; successful empty inventory can', () => {
  for (const payload of [{}, { results: [] }, { results: [{ ok: false }] }, { results: [{ ok: true, items: [], pageError: 'timeout' }] }]) assert.throws(() => validateAlertScan(payload));
  const good = { ok: true, site: 'olx.ro', items: [] };
  assert.deepEqual(validateAlertScan({ results: [good, { ok: false, site: 'okazii.ro' }] }), [good]);
});
