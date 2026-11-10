import { canCompareRetailOffers } from "../../../../src/market-segment.js"
import type { SearchResultItem } from "./search-data"

export type BuyingKind = "new" | "refurbished" | "used"
type Offer = Pick<SearchResultItem, "id" | "title" | "price" | "source" | "sourceKind" | "condition">
const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

export function buyingKind(item: Offer): BuyingKind | null {
  const condition = normalize(`${item.condition} ${item.title}`)
  // Open-box stock is not refurbished and must not inherit a new-product label.
  if (/\b(resigilat\w*|open[ -]?box)\b/.test(condition)) return null
  if (/\b(reconditionat\w*|refurbished|renewed)\b/.test(condition) || /^(flip|klap)(\.ro)?$/i.test(item.source)) return "refurbished"
  return item.sourceKind === "new" ? "new" : item.sourceKind === "used" ? "used" : null
}

function eligible(item: Offer) {
  return item.price !== null && Number.isFinite(item.price) && item.price > 0
    && !/\b(husa|carcasa|folie|incarcator|cablu|pentru|compatibil|defect\w*|piese|case|cover|charger|for)\b/.test(normalize(item.title))
}

/** Prices are already normalized to RON by search-data. Never compare query-wide minima. */
export function buildBuyingComparison<T extends Offer>(reference: T, candidates: T[]) {
  const offers: Record<BuyingKind, T | null> = { new: null, refurbished: null, used: null }
  const counts: Record<BuyingKind, number> = { new: 0, refurbished: 0, used: 0 }
  const seen = new Set<string>()
  for (const item of [reference, ...candidates]) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    const kind = buyingKind(item)
    if (!kind || !eligible(reference) || !eligible(item)) continue
    if (item.id !== reference.id && !canCompareRetailOffers(reference, item)) continue
    counts[kind]++
    if (!offers[kind] || item.price! < offers[kind]!.price!) offers[kind] = item
  }
  const saving = (baseline: T | null, alternative: T | null) => baseline && alternative
    ? { amount: baseline.price! - alternative.price!, percent: Math.round((baseline.price! - alternative.price!) / baseline.price! * 100) }
    : null
  return { offers, counts, usedVsNew: saving(offers.new, offers.used), usedVsRefurbished: saving(offers.refurbished, offers.used) }
}
