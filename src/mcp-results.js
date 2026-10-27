// Transport projection only: search, eligibility, ranking, and decisions belong
// to Libergent's shared engine. Never choose an offer or invent a fallback here.
export function compactOffer(item) {
  if (!item) return null;
  return {
    title: item.title || "",
    url: item.url || "",
    marketplace: item.site || item.marketplace || "",
    priceRon: Number.isFinite(item.priceRon) ? item.priceRon : null,
    condition: item.offerKind || item.condition || "unknown",
    location: item.location || null,
    rank: item.rank ?? null,
    recommendationScore: item.recommendationScore ?? null,
    recommendation: item.recommendation ?? null,
    evidenceConfidence: item.evidenceConfidence ?? null,
    dealQuality: item.dealQuality ?? null,
    priceInsight: item.priceInsight ?? null,
    proximity: item.proximity ?? null,
    jevDecision: item.jevDecision ?? null,
    reasons: item.recommendation?.reasons || item.whyThisDeal || [],
    whyThisDeal: item.whyThisDeal || [],
    risks: item.riskFlags || []
  };
}

export function buildConnectorSearchResult(payload, { query, city, limit = 10 }) {
  const summary = payload.summary || {};
  const failed = (summary.failedMarketplaces || []).map((source) => source.site);
  return {
    query,
    searchTier: payload.searchTier || "free",
    decisionAuthority: "libergent",
    filters: { condition: summary.condition || "any", maxPriceRon: summary.maxPriceRon ?? null, city: city || null, locationMode: "preference" },
    status: summary.successfulMarketplaces === 0 ? "unavailable" : failed.length ? "partial" : "complete",
    searchedAt: summary.searchedAt || null,
    cacheHit: Boolean(summary.cacheHit),
    locationResolved: summary.viewerLocation || null,
    offers: (summary.rankedOffers || []).slice(0, limit).map(compactOffer),
    // Preserve distinct decisions, including Jev selections and explicit nulls.
    recommendedOffer: compactOffer(summary.bestOffer),
    bestUsedOffer: compactOffer(summary.bestUsedOffer),
    closestUsedOffer: compactOffer(summary.closestUsedOffer),
    newPriceBenchmark: compactOffer(summary.bestNewBenchmark),
    recommendedOffers: (summary.recommendedOffers || []).map(compactOffer),
    recommendationMode: summary.recommendationMode || null,
    queryUnderstanding: summary.queryUnderstanding || null,
    priceIntelligence: summary.priceIntelligence || null,
    jevDecision: summary.jevDecision || null,
    coverage: { attempted: summary.marketplaces || 0, successful: summary.successfulMarketplaces || 0, failedSources: failed },
    notes: [
      "Recommendations, rankings, risks, confidence, and price analysis are Libergent decisions. Present them as returned; do not replace them with an assistant-selected winner.",
      "Results cover retrieved listings, not all marketplace inventory. Prices and availability require verification at the source.",
      "The new-price benchmark is a comparison reference and may exceed the budget. Use Libergent's price intelligence for savings claims.",
      ...(city ? ["City is a ranking preference, not a strict city or distance filter."] : []),
      ...(city && !summary.viewerLocation ? ["The supplied city could not be resolved; no proximity preference was applied."] : []),
      ...(summary.maxPriceRon != null ? ["Budget applies to known item prices in RON; shipping and other fees may be extra. Unknown prices are excluded."] : [])
    ]
  };
}
