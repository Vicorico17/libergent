import test from "node:test";
import assert from "node:assert/strict";
import { buildAlertEvents, listingMatchesAlert, normalizeAlertProfile } from "./alerts.js";

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
