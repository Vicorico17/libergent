import test from "node:test";
import assert from "node:assert/strict";

import { buildSearchIndex } from "../src/indexing/pipeline.js";

test("buildSearchIndex transforms all valid canonical listings and upserts them", async () => {
  const listings = [
    {
      id: "listing-1",
      title: "iPhone 13",
      description: "Stare foarte buna",
      priceAmount: "2500",
      priceCurrency: "ron",
      condition: "folosit",
      location: "Bucuresti",
      updatedAt: "2026-04-30T10:00:00.000Z"
    },
    {
      id: "listing-2",
      title: "PS5 Slim",
      description: "Nou, sigilat",
      priceAmount: 2100,
      priceCurrency: "RON",
      condition: "nou",
      location: "Cluj",
      updatedAt: "2026-04-30T11:00:00.000Z"
    }
  ];

  const upserted = [];
  const source = {
    async listCanonicalListings() {
      return listings;
    }
  };

  const store = {
    async getLastIndexedAt() {
      return "2026-04-29T00:00:00.000Z";
    },
    async upsertDocuments(documents) {
      upserted.push(...documents);
    }
  };

  const result = await buildSearchIndex({ source, store, logger: { info() {}, error() {} } });

  assert.equal(result.readCount, 2);
  assert.equal(result.indexedCount, 2);
  assert.equal(result.failureCount, 0);
  assert.equal(upserted.length, 2);
  assert.equal(upserted[0].condition, "used");
  assert.equal(upserted[0].priceAmount, 2500);
  assert.equal(upserted[1].condition, "new");
  assert.match(upserted[0].searchableText, /iphone 13/i);
  assert.equal(upserted[0].listingId, "listing-1");
  assert.equal(upserted[0].sourceUpdatedAt, "2026-04-30T10:00:00.000Z");
  assert.match(upserted[0].indexedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(upserted[0].title, "iPhone 13");
  assert.equal(upserted[0].description, "Stare foarte buna");
  assert.equal(upserted[0].location, "Bucuresti");
});

test("buildSearchIndex records transform failures and continues", async () => {
  const source = {
    async listCanonicalListings() {
      return [
        { id: "ok-1", title: "Bicicleta", priceAmount: 900 },
        { id: "bad-1", title: "   ", priceAmount: 10 }
      ];
    }
  };

  const upserted = [];
  const errors = [];

  const store = {
    async upsertDocuments(documents) {
      upserted.push(...documents);
    }
  };

  const result = await buildSearchIndex({
    source,
    store,
    logger: {
      info() {},
      error(message, payload) {
        errors.push({ message, payload });
      }
    },
    mode: "full"
  });

  assert.equal(result.readCount, 2);
  assert.equal(result.indexedCount, 1);
  assert.equal(result.failureCount, 1);
  assert.equal(result.failures[0].listingId, "bad-1");
  assert.equal(upserted.length, 1);
  assert.equal(errors.length, 1);
});
