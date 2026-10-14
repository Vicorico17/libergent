export type History = {
  totals: { searches: number; uniqueQueries: number; uniqueKeywords: number };
  dailyTrend: { date: string; count: number }[];
  recentSearches: { searchedAt?: string; totalListings?: number; successfulMarketplaces?: number; marketplaces?: number }[];
};
export type Source = { domain: string; tier: string };
export type Probe = { id: string; source_site: string; outcome: string; results_count: number; searched_at: string; elapsed_ms?: number; parsed_count?: number };
export type Radar = { runs: Probe[]; sources: { site: string; coolingDown: boolean; status?: string; retryAt?: string | null }[]; repairQueue?: { state: string; site: string }[] };
export function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}
export function validCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
export function sampleStats(history: History | null) {
  const entries = history?.recentSearches || [];
  const withResults = entries.filter(entry => validCount(entry.totalListings));
  const checks = entries.filter(entry => validCount(entry.marketplaces) && validCount(entry.successfulMarketplaces));
  const attempted = checks.reduce((sum, entry) => sum + count(entry.marketplaces), 0);
  return {
    size: entries.length,
    listings: withResults.length ? withResults.reduce((sum, entry) => sum + count(entry.totalListings), 0) : null,
    withResults: withResults.length ? Math.round(withResults.filter(entry => count(entry.totalListings) > 0).length / withResults.length * 100) : null,
    sourceSuccess: attempted ? Math.round(checks.reduce((sum, entry) => sum + Math.min(count(entry.successfulMarketplaces), count(entry.marketplaces)), 0) / attempted * 100) : null,
  };
}
export function recentProbes(runs: Probe[], now: number) {
  return runs.filter(run => {
    const age = now - Date.parse(run.searched_at);
    return Number.isFinite(age) && age >= 0 && age <= 15 * 60 * 1000;
  });
}
export function latestTimestamp(values: (string | undefined)[]): string | null {
  return values.filter((value): value is string => Boolean(value) && Number.isFinite(Date.parse(value!)))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] || null;
}

export function agentStats(radar: Radar | null) {
  const runs = radar?.runs || [];
  const durations = runs.map(run => run.elapsed_ms).filter(validCount).sort((a, b) => a - b);
  const middle = Math.floor(durations.length / 2);
  const medianMs = durations.length ? durations.length % 2 ? durations[middle] : (durations[middle - 1] + durations[middle]) / 2 : null;
  const sumField = (field: 'parsed_count' | 'results_count') => runs.some(run => validCount(run[field])) ? runs.reduce((sum, run) => sum + count(run[field]), 0) : null;
  const sites = new Set([...runs.map(run => run.source_site), ...(radar?.sources || []).map(source => source.site)]);
  const sourceRows = [...sites].sort().map(site => {
    const history = runs.filter(run => run.source_site === site).sort((a, b) => (Date.parse(b.searched_at) || 0) - (Date.parse(a.searched_at) || 0));
    const state = radar?.sources.find(source => source.site === site);
    return { site, checks: history.length, withOffers: history.filter(run => run.outcome === 'results').length,
      errors: history.filter(run => run.outcome === 'error').length,
      latest: latestTimestamp(history.map(run => run.searched_at)),
      outcome: history[0]?.outcome || null, coolingDown: state?.coolingDown ?? false, retryAt: state?.retryAt || null };
  });
  return { runs: runs.length, withOffers: runs.filter(run => run.outcome === 'results').length,
    empty: runs.filter(run => run.outcome === 'empty').length, errors: runs.filter(run => run.outcome === 'error').length,
    medianMs, parsed: sumField('parsed_count'), offers: sumField('results_count'), sourceRows,
    openRepairs: radar?.repairQueue ? radar.repairQueue.filter(entry => entry.state === 'open').length : null,
    recovered: radar?.repairQueue ? radar.repairQueue.filter(entry => entry.state === 'recovered').length : null };
}
