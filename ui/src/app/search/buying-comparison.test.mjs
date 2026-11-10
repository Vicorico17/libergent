import test from "node:test"
import assert from "node:assert/strict"
import { buildBuyingComparison, buyingKind } from "./buying-comparison.ts"

const offer = (id, price, extra = {}) => ({ id, price, title: "iPhone 15 128GB", source: "OLX", sourceKind: "used", condition: "folosit", ...extra })
const retail = (id, price, extra = {}) => offer(id, price, { source: "ALTEX", sourceKind: "new", condition: "nou", ...extra })

test("selects matching minima by condition and calculates both savings without duplicate counts", () => {
  const used = offer("used", 2250)
  const refurbished = offer("refurb", 2400, { source: "FLIP", condition: "recondiționat" })
  const result = buildBuyingComparison(used, [used, retail("new", 3000), retail("expensive", 3200), refurbished])
  assert.equal(result.offers.new.id, "new")
  assert.equal(result.offers.refurbished.id, "refurb")
  assert.deepEqual(result.counts, { used: 1, new: 2, refurbished: 1 })
  assert.deepEqual(result.usedVsNew, { amount: 750, percent: 25 })
  assert.equal(result.usedVsRefurbished.amount, 150)
})

test("rejects other models, capacities, accessories, broken devices and invalid prices", () => {
  const used = offer("used", 2000)
  const candidates = [
    retail("capacity", 1000, { title: "iPhone 15 256GB" }),
    retail("model", 1000, { title: "iPhone 15 Pro 128GB" }),
    retail("unknown", 1000, { title: "iPhone 15" }),
    retail("case", 30, { title: "Husa pentru iPhone 15 128GB" }),
    retail("broken", 100, { title: "iPhone 15 128GB defect" }),
    ...[null, 0, -1, Infinity, NaN].map((price, i) => retail(`invalid-${i}`, price)),
  ]
  const result = buildBuyingComparison(used, candidates)
  assert.equal(result.offers.new, null)
  assert.equal(result.usedVsNew, null)
})

test("refurbished and open-box offers never inflate the new-price baseline", () => {
  assert.equal(buyingKind(retail("refurb", 2400, { condition: "recondiționat" })), "refurbished")
  assert.equal(buyingKind(retail("open", 2400, { condition: "resigilat" })), null)
  assert.equal(buyingKind(offer("unknown", 2400, { sourceKind: "mixed" })), null)
})

test("reports when new is cheaper and does not invent a saving for missing used stock", () => {
  const result = buildBuyingComparison(offer("used", 3100), [retail("new", 3000)])
  assert.equal(result.usedVsNew.amount, -100)
  assert.equal(buildBuyingComparison(retail("new", 3000), []).usedVsNew, null)
})

test("an ambiguous reference can be displayed but cannot match another listing", () => {
  const reference = offer("used", 2000, { title: "iPhone 15" })
  assert.equal(buildBuyingComparison(reference, [retail("new", 3000)]).offers.new, null)
})
