import crypto from "node:crypto";
import { INGESTION_ACTIONS, mapFailureToAction } from "./errors.js";

export const INGEST_RUN_STATUS = {
  queued: "queued",
  running: "running",
  partialSuccess: "partial_success",
  failed: "failed",
  completed: "completed"
};

function createRunId() {
  return crypto.randomUUID();
}

function stableHash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function buildSnapshotIdempotencyKey(source, record) {
  const rawKey = record.snapshotIdempotencyKey || `${source}|${record.externalId || ""}|${record.url || ""}|${record.price || ""}|${record.currency || ""}|${record.postedAt || ""}`;
  return stableHash(rawKey);
}

function normalizeRecord(record) {
  if (!record || typeof record !== "object") {
    throw new Error("Record must be an object.");
  }

  const externalId = String(record.externalId || record.url || "").trim();
  if (!externalId) {
    throw new Error("Record is missing externalId/url.");
  }

  return {
    externalId,
    title: record.title || "",
    url: record.url || "",
    location: record.location || null,
    postedAt: record.postedAt || null,
    condition: record.condition || null,
    sellerType: record.sellerType || null,
    currency: record.currency || null,
    price: record.price ?? null,
    raw: record.raw || null,
    snapshotIdempotencyKey: record.snapshotIdempotencyKey || null
  };
}

export async function runIngestionOrchestration({ source, records, store, logger = console, runId = createRunId(), now = new Date().toISOString() }) {
  if (!source) {
    throw new Error("source is required");
  }
  if (!Array.isArray(records)) {
    throw new Error("records must be an array");
  }
  if (!store) {
    throw new Error("store is required");
  }

  const run = await store.createRun({
    id: runId,
    source,
    status: INGEST_RUN_STATUS.queued,
    listingCount: records.length,
    successCount: 0,
    failureCount: 0,
    startedAt: now,
    finishedAt: null
  });

  await store.updateRun(run.id, { status: INGEST_RUN_STATUS.running });

  let successCount = 0;
  let failureCount = 0;
  const failures = [];

  for (const rawRecord of records) {
    try {
      const record = normalizeRecord(rawRecord);
      const { listing } = await store.upsertListing({
        source,
        externalId: record.externalId,
        payload: record
      });

      const snapshotKey = buildSnapshotIdempotencyKey(source, record);
      await store.upsertPriceSnapshot({
        idempotencyKey: snapshotKey,
        listingId: listing.id,
        source,
        amount: record.price,
        currency: record.currency,
        capturedAt: now,
        payload: record
      });

      await store.incrementMetric("records_processed", 1);
      successCount += 1;
    } catch (error) {
      failureCount += 1;
      failures.push(error instanceof Error ? error.message : String(error));
      const failureStrategy = mapFailureToAction(error);

      if (rawRecord?.nonRetriable || failureStrategy.action === INGESTION_ACTIONS.deadLetter) {
        await store.insertDlqItem({
          runId,
          source,
          externalId: rawRecord?.externalId || rawRecord?.url || null,
          reason: error instanceof Error ? error.message : String(error),
          payload: rawRecord,
          occurredAt: now
        });
      } else if (failureStrategy.action === INGESTION_ACTIONS.retry) {
        await store.incrementMetric("retries_total", 1);
      }
    }
  }

  const status = successCount === 0
    ? INGEST_RUN_STATUS.failed
    : failureCount > 0
      ? INGEST_RUN_STATUS.partialSuccess
      : INGEST_RUN_STATUS.completed;

  const updatedRun = await store.updateRun(run.id, {
    status,
    successCount,
    failureCount,
    finishedAt: new Date().toISOString(),
    failures
  });

  logger.info({
    event: "ingestion_run_completed",
    run_id: run.id,
    source,
    listing_count: records.length,
    failure_count: failureCount,
    status
  });

  return {
    run: updatedRun,
    successCount,
    failureCount,
    failures
  };
}
