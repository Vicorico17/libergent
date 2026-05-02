import test from "node:test";
import assert from "node:assert/strict";

import { createSearchTelemetry } from "../src/search-telemetry.js";

test("createSearchTelemetry logs success latency event", () => {
  const nowValues = [100, 148];
  const originalNow = Date.now;
  const originalInfo = console.info;
  const events = [];

  Date.now = () => nowValues.shift() ?? 148;
  console.info = (...args) => {
    events.push(args);
  };

  try {
    const telemetry = createSearchTelemetry({
      route: "/api/search",
      query: "iphone 15",
      condition: "any",
      provider: "auto",
      site: "all"
    });

    const durationMs = telemetry.logSuccess({ marketplaces: 2 });
    assert.equal(durationMs, 48);
    assert.equal(events.length, 1);
    assert.equal(events[0][0], "search_latency");
    assert.equal(events[0][1].event, "search_latency");
    assert.equal(events[0][1].durationMs, 48);
    assert.equal(events[0][1].marketplaces, 2);
    assert.equal(events[0][1].query, "iphone 15");
  } finally {
    Date.now = originalNow;
    console.info = originalInfo;
  }
});

test("createSearchTelemetry logs error signal with latency", () => {
  const nowValues = [50, 90];
  const originalNow = Date.now;
  const originalError = console.error;
  const events = [];

  Date.now = () => nowValues.shift() ?? 90;
  console.error = (...args) => {
    events.push(args);
  };

  try {
    const telemetry = createSearchTelemetry({
      route: "/api/search/scored",
      query: "guitar",
      condition: "used",
      provider: "direct",
      site: "olx"
    });

    const durationMs = telemetry.logError(new Error("boom"));
    assert.equal(durationMs, 40);
    assert.equal(events.length, 1);
    assert.equal(events[0][0], "search_error");
    assert.equal(events[0][1].event, "search_error");
    assert.equal(events[0][1].durationMs, 40);
    assert.equal(events[0][1].error, "boom");
    assert.equal(events[0][1].route, "/api/search/scored");
  } finally {
    Date.now = originalNow;
    console.error = originalError;
  }
});
