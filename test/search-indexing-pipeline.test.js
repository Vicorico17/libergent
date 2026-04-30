import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSearchIndexDocument,
  InMemorySearchIndexStore,
  runListingsToSearchIndexing
} from "../src/indexing/pipeline.js";

test("buildSearchIndexDocument maps canonical listing fields", () => {
  const doc = buildSearchIndexDocument({
    sourceKey: "olx.ro",
    sourceName: "OLX",
    listing: {
      id: "listing-1",
      canonical_url: "https://olx.ro/d/oferta/listing-1",
      current_status: "active",
      seller: { location: "Bucuresti" },
      updated_at: "2026-04-30T10:00:00.000Z"
    },
    itemSnapshot: {
      title: "iPhone 15 Pro 256GB",
      description: "Like new, box included",
      listing_condition: "like_new",
      category: "phones",
      observed_at: "2026-04-30T09:00:00.000Z"
    },
    priceSnapshot: {
      amount_minor: 450000,
      currency_code: "RON"
    }
  });

  assert.equal(doc.listing_id, "listing-1");
  assert.equal(doc.title, "iPhone 15 Pro 256GB");
  assert.equal(doc.normalized_price_minor, 450000);
  assert.equal(doc.normalized_currency_code, "RON");
  assert.match(doc.searchable_text, /iphone 15 pro/);
  assert.match(doc.searchable_text, /bucuresti/);
});

test("incremental indexing filters by since and upserts docs", async () => {
  const seed = [
    {
      source: { source_key: "olx.ro", source_name: "OLX" },
      listing: {
        id: "old-1",
        canonical_url: "https://olx.ro/old-1",
        current_status: "active",
        seller: { location: "Cluj" },
        updated_at: "2026-04-28T00:00:00.000Z"
      },
      itemSnapshot: { title: "Old listing", observed_at: "2026-04-28T00:00:00.000Z" },
      priceSnapshot: { amount_minor: 120000, currency_code: "RON" }
    },
    {
      source: { source_key: "olx.ro", source_name: "OLX" },
      listing: {
        id: "new-1",
        canonical_url: "https://olx.ro/new-1",
        current_status: "active",
        seller: { location: "Iasi" },
        updated_at: "2026-04-30T11:00:00.000Z"
      },
      itemSnapshot: { title: "New listing", observed_at: "2026-04-30T11:00:00.000Z" },
      priceSnapshot: { amount_minor: 220000, currency_code: "RON" }
    }
  ];

  const store = new InMemorySearchIndexStore(seed);
  const result = await runListingsToSearchIndexing({
    store,
    mode: "incremental",
    since: "2026-04-30T00:00:00.000Z",
    logger: { info() {} }
  });

  assert.equal(result.listingsSeen, 1);
  assert.equal(result.upsertedCount, 1);
  assert.equal(result.failureCount, 0);
  assert.equal(store.index.size, 1);
  assert.ok(store.index.has("new-1"));
});
