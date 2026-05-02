import { NonRetriableIngestionError } from "./failures.js";

export const ADAPTER_METHODS = ["discover", "fetch_listing", "normalize", "emit"];

function toIsoString(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function assertSource(source) {
  if (typeof source !== "string" || !source.trim()) {
    throw new NonRetriableIngestionError("metadata.source must be a non-empty string");
  }
}

export function validateAdapterMetadata(metadata = {}) {
  assertSource(metadata.source);

  const crawlTs = toIsoString(metadata.crawl_ts);
  const observedTs = toIsoString(metadata.observed_ts || metadata.crawl_ts);
  if (!crawlTs || !observedTs) {
    throw new NonRetriableIngestionError("metadata.crawl_ts and metadata.observed_ts must be valid ISO timestamps");
  }

  const reliability = Number(metadata.reliability_score);
  if (!Number.isFinite(reliability) || reliability < 0 || reliability > 1) {
    throw new NonRetriableIngestionError("metadata.reliability_score must be a number between 0 and 1");
  }

  if (typeof metadata.raw_payload_pointer !== "string" || !metadata.raw_payload_pointer.trim()) {
    throw new NonRetriableIngestionError("metadata.raw_payload_pointer must be a non-empty string");
  }

  return {
    source: metadata.source,
    crawl_ts: crawlTs,
    observed_ts: observedTs,
    reliability_score: reliability,
    raw_payload_pointer: metadata.raw_payload_pointer
  };
}

export function assertAdapterContract(adapter) {
  if (!adapter || typeof adapter !== "object") {
    throw new NonRetriableIngestionError("Adapter must be an object");
  }

  for (const method of ADAPTER_METHODS) {
    if (typeof adapter[method] !== "function") {
      throw new NonRetriableIngestionError(`Adapter is missing required method: ${method}`);
    }
  }
}

export async function executeAdapter(adapter, { query, context = {} } = {}) {
  assertAdapterContract(adapter);

  const handles = await adapter.discover({ query, context });
  if (!Array.isArray(handles)) {
    throw new NonRetriableIngestionError("discover() must return an array of handles");
  }

  const emitted = [];

  for (const handle of handles) {
    const rawListing = await adapter.fetch_listing(handle, { query, context });
    const normalized = await adapter.normalize(rawListing, { query, context, handle });
    const metadata = validateAdapterMetadata({
      ...normalized?.metadata,
      source: normalized?.metadata?.source || adapter.source || context.source
    });

    const record = await adapter.emit({
      listing: normalized?.listing || {},
      metadata,
      raw: rawListing,
      handle
    }, { query, context });

    emitted.push({
      listing: record?.listing || {},
      metadata: validateAdapterMetadata(record?.metadata || metadata),
      raw: record?.raw ?? rawListing
    });
  }

  return emitted;
}
