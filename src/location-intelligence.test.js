import test from "node:test";
import assert from "node:assert/strict";

import {
  buildListingProximity,
  calculateDistanceKm,
  publicViewerLocation,
  resolveRomanianPlace,
  resolveViewerLocation
} from "./location-intelligence.js";

test("resolves Romanian listing locations with and without diacritics", () => {
  assert.equal(resolveRomanianPlace("Cluj-Napoca, Cluj")?.city, "Cluj-Napoca");
  assert.equal(resolveRomanianPlace("București, Sector 2")?.city, "București");
});

test("uses city-level coordinates instead of exposing an IP-derived precise position", () => {
  const location = resolveViewerLocation({
    cf: { city: "Bucharest", country: "RO", latitude: "44.40123", longitude: "26.05123" },
    overrideCity: "Bucuresti"
  });
  assert.equal(location.city, "București");
  assert.equal(location.latitude, 44.4268);
  assert.deepEqual(publicViewerLocation(location), {
    city: "București",
    region: "",
    countryCode: "RO",
    source: "manual",
    isApproximate: true
  });
});

test("calculates approximate proximity without changing listing identity", () => {
  const viewer = resolveViewerLocation({ overrideCity: "Bucuresti" });
  const proximity = buildListingProximity({ location: "Voluntari (Ilfov)" }, viewer);
  assert.ok(proximity.distanceKm < 20);
  assert.equal(proximity.listingCity, "Voluntari");
  assert.ok(calculateDistanceKm(viewer, resolveRomanianPlace("Cluj")) > 300);
});
