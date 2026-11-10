import { listingIdentity } from './listing-identity.js';

export function summarizeScrapeCase(payload, { query, site, durationMs, labels = {} }) {
  const results = payload.results || [];
  const items = results.filter(r => r.ok).flatMap(r => r.items || []);
  const unique = [...new Map(items.map(item => [listingIdentity(item, site), item])).values()];
  const judged = unique.slice(0, 10).map(item => labels[listingIdentity(item, site)]).filter(label => typeof label?.relevant === 'boolean');
  const priceJudgments = unique.map(item => ({ item, label: labels[listingIdentity(item, site)] })).filter(({ label }) => Number.isFinite(label?.expectedPriceRon));
  const metrics = results.map(result => result.fetchMetrics);
  return {
    query, site, durationMs,
    sourceSucceeded: results.length > 0 && results.every(result => result.ok),
    outcomes: results.map(result => result.outcome || (result.ok ? 'results' : 'unknown_failure')),
    uniqueListings: unique.length,
    pricedListings: unique.filter(item => Number.isFinite(item.priceRon) && item.priceRon > 0).length,
    pagesUsed: results.reduce((sum, result) => sum + (result.pagesUsed || 0), 0),
    originRequests: metrics.length && metrics.every(Boolean) ? metrics.reduce((sum, metric) => sum + metric.originRequests, 0) : null,
    cacheHit: Boolean(payload.summary?.cacheHit),
    judgedTop10: judged.length,
    precisionAt10: judged.length === Math.min(10, unique.length) && judged.length > 0 ? judged.filter(label => label.relevant).length / judged.length : null,
    priceAccuracy: priceJudgments.length ? priceJudgments.filter(({ item, label }) => Math.abs(item.priceRon - label.expectedPriceRon) < 0.01).length / priceJudgments.length : null,
    judgedPrices: priceJudgments.length,
    sample: unique.slice(0, 10).map(item => ({ identity: listingIdentity(item, site), title: item.title, url: item.url, price: item.price, priceRon: item.priceRon })),
    errors: results.filter(result => !result.ok || result.pageError).map(result => result.error || result.pageError)
  };
}

export function summarizeBenchmark(cases) {
  const durations = cases.map(entry => entry.durationMs).sort((a, b) => a - b);
  return {
    cases: cases.length,
    successfulSources: cases.filter(entry => entry.sourceSucceeded).length,
    uniqueListings: cases.reduce((sum, entry) => sum + entry.uniqueListings, 0),
    p50Ms: durations.length ? durations[Math.ceil(durations.length * 0.5) - 1] : null,
    p95Ms: durations.length ? durations[Math.ceil(durations.length * 0.95) - 1] : null,
    fullyJudgedCases: cases.filter(entry => entry.precisionAt10 !== null).length
  };
}
