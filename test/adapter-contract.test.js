import test from "node:test";
import assert from "node:assert/strict";

import { executeAdapter, validateAdapterMetadata } from "../src/ingestion/adapter-contract.js";
import {
  INGESTION_ACTIONS,
  IgnoreRecordIngestionError,
  NonRetriableIngestionError,
  RateLimitedIngestionError,
  mapFailureToAction
} from "../src/ingestion/failures.js";
import { createOlxStubAdapter } from "../src/ingestion/adapters/olx-stub.js";

const SAMPLE_OLX_MARKDOWN = `
[![img](https://img.example/1.jpg)](https://www.olx.ro/d/oferta/jeep-compass-ID1.html)
[**Jeep Compass 2019**](https://www.olx.ro/d/oferta/jeep-compass-ID1.html)
45 000 lei
Utilizat
Bucuresti - azi
`;

test("executeAdapter enforces contract with fake adapter", async () => {
  const fakeAdapter = {
    source: "fake",
    async discover() {
      return [{ id: "1" }];
    },
    async fetch_listing(handle) {
      return { handle, title: "Example" };
    },
    async normalize(raw) {
      return {
        listing: {
          externalId: "fake-1",
          title: raw.title,
          url: "https://example.test/listing/fake-1",
          price: 100,
          currency: "RON"
        },
        metadata: {
          source: "fake",
          crawl_ts: "2026-04-30T12:00:00.000Z",
          observed_ts: "2026-04-30T11:59:00.000Z",
          reliability_score: 0.9,
          raw_payload_pointer: "fixture://fake/1"
        }
      };
    },
    async emit(record) {
      return record;
    }
  };

  const results = await executeAdapter(fakeAdapter, { query: "jeep compass" });
  assert.equal(results.length, 1);
  assert.equal(results[0].metadata.source, "fake");
  assert.equal(results[0].metadata.reliability_score, 0.9);
  assert.equal(results[0].listing.externalId, "fake-1");
});

test("executeAdapter passes with one real-source adapter stub", async () => {
  const adapter = createOlxStubAdapter({ markdown: SAMPLE_OLX_MARKDOWN, crawlTs: "2026-04-30T12:00:00.000Z" });

  const results = await executeAdapter(adapter, { query: "jeep compass" });
  assert.equal(results.length, 1);
  assert.equal(results[0].metadata.source, "olx");
  assert.equal(results[0].metadata.raw_payload_pointer, "fixture://olx-markdown");
  assert.match(results[0].listing.url, /olx\.ro\/d\/oferta\//);
});

test("metadata validator enforces required fields", () => {
  assert.throws(
    () => validateAdapterMetadata({ source: "olx", crawl_ts: "invalid", observed_ts: "2026-04-30T12:00:00.000Z", reliability_score: 1, raw_payload_pointer: "x" }),
    NonRetriableIngestionError
  );
});

test("failure taxonomy maps to orchestration actions", () => {
  const rateLimit = mapFailureToAction(new RateLimitedIngestionError("slow down"));
  assert.equal(rateLimit.action, INGESTION_ACTIONS.retry);
  assert.equal(rateLimit.retriable, true);

  const ignore = mapFailureToAction(new IgnoreRecordIngestionError("duplicate"));
  assert.equal(ignore.action, INGESTION_ACTIONS.ignore);

  const deadLetter = mapFailureToAction(new NonRetriableIngestionError("bad payload"));
  assert.equal(deadLetter.action, INGESTION_ACTIONS.deadLetter);
});
