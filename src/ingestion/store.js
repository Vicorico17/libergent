function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class InMemoryIngestionStore {
  constructor() {
    this.runs = new Map();
    this.listings = new Map();
    this.snapshots = new Map();
    this.dlq = [];
    this.metrics = {
      runs_total: 0,
      records_processed: 0,
      retries_total: 0,
      dlq_total: 0
    };
  }

  async createRun(run) {
    this.runs.set(run.id, clone(run));
    this.metrics.runs_total += 1;
    return clone(run);
  }

  async updateRun(runId, patch) {
    const current = this.runs.get(runId);
    if (!current) {
      throw new Error(`Unknown run: ${runId}`);
    }

    const updated = { ...current, ...clone(patch), id: runId };
    this.runs.set(runId, updated);
    return clone(updated);
  }

  async upsertListing({ source, externalId, payload }) {
    const key = `${source}:${externalId}`;
    const existing = this.listings.get(key);
    const listing = {
      id: key,
      source,
      externalId,
      ...clone(payload),
      updatedAt: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString()
    };

    this.listings.set(key, listing);
    return { listing: clone(listing), created: !existing };
  }

  async upsertPriceSnapshot({ idempotencyKey, listingId, source, amount, currency, capturedAt, payload }) {
    const existing = this.snapshots.get(idempotencyKey);
    if (existing) {
      return { snapshot: clone(existing), created: false };
    }

    const snapshot = {
      id: idempotencyKey,
      listingId,
      source,
      amount,
      currency,
      capturedAt,
      payload: clone(payload)
    };

    this.snapshots.set(idempotencyKey, snapshot);
    return { snapshot: clone(snapshot), created: true };
  }

  async insertDlqItem(item) {
    const row = { ...clone(item), id: `${item.runId}:${this.dlq.length + 1}` };
    this.dlq.push(row);
    this.metrics.dlq_total += 1;
    return clone(row);
  }

  async incrementMetric(name, value = 1) {
    if (!Object.hasOwn(this.metrics, name)) {
      this.metrics[name] = 0;
    }

    this.metrics[name] += value;
  }
}
