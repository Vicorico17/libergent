import test from "node:test";
import assert from "node:assert/strict";
import { runShopValidation } from "./shop-validation.js";

test("source validation counts final accepted offers instead of preliminary accessory matches", async () => {
  const queries = [];
  const report = await runShopValidation({ siteKeys: ["olx.ro"], search: async ({ query }) => {
    queries.push(query);
    return { rawItemCount: 1, itemCount: 1, items: [{ title: `Husa ${query}`, price: "30 lei", url: "https://www.olx.ro/d/oferta/test.html" }] };
  }});
  assert.equal(new Set(queries).size, 2);
  assert.equal(report.sources[0].repeatedNoUsefulResults, true);
  assert.equal(report.sources[0].verdict, "needs_query_or_parser");
  assert.ok(report.sources[0].checks.every(check => check.includedItemCount === 0 && check.rawItemCount === 1));
});

test("source validation chooses vehicles for car marketplaces and parts for automotive retailers", async () => {
  const report = await runShopValidation({ siteKeys: ["autovit.ro", "epiesa.ro"], search: async () => ({ items: [] }) });
  assert.equal(report.sources.find(s => s.site === "autovit.ro").checks[0].query, "bmw x5");
  assert.equal(report.sources.find(s => s.site === "epiesa.ro").checks[0].query, "anvelope 205 55 r16");
});
