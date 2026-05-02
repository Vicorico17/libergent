import test from "node:test";
import assert from "node:assert/strict";

import { runIngestionOrchestration, INGEST_RUN_STATUS } from "../src/ingestion/orchestrator.js";
import { InMemoryIngestionStore } from "../src/ingestion/store.js";

test("re-running same payload does not duplicate snapshots", async () => {
  const store = new InMemoryIngestionStore();
  const records = [
    {
      externalId: "olx-1",
      url: "https://olx.ro/1",
      title: "Item",
      price: 100,
      currency: "RON",
      postedAt: "today"
    }
  ];

  await runIngestionOrchestration({ source: "olx", records, store, now: "2026-04-30T12:00:00.000Z", logger: { info() {} } });
  await runIngestionOrchestration({ source: "olx", records, store, now: "2026-04-30T12:00:00.000Z", logger: { info() {} } });

  assert.equal(store.listings.size, 1);
  assert.equal(store.snapshots.size, 1);
});

test("partial failures preserve successes and push non-retriable to DLQ", async () => {
  const store = new InMemoryIngestionStore();
  const records = [
    {
      externalId: "ok-1",
      url: "https://site/ok-1",
      title: "Good",
      price: 50,
      currency: "RON"
    },
    {
      title: "bad payload",
      nonRetriable: true
    }
  ];

  const result = await runIngestionOrchestration({ source: "vinted", records, store, logger: { info() {} } });

  assert.equal(result.run.status, INGEST_RUN_STATUS.partialSuccess);
  assert.equal(result.successCount, 1);
  assert.equal(result.failureCount, 1);
  assert.equal(store.listings.size, 1);
  assert.equal(store.dlq.length, 1);
});

test("all failures produce failed run status", async () => {
  const store = new InMemoryIngestionStore();
  const records = [{ foo: "bar", nonRetriable: true }];

  const result = await runIngestionOrchestration({ source: "publi24", records, store, logger: { info() {} } });

  assert.equal(result.run.status, INGEST_RUN_STATUS.failed);
  assert.equal(store.dlq.length, 1);
});
