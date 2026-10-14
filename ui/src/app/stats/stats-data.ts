export type History = {
  totals: { searches: number; uniqueQueries: number; uniqueKeywords: number };
  dailyTrend: { date: string; count: number }[];
  recentSearches: { searchedAt?: string; totalListings?: number; successfulMarketplaces?: number; marketplaces?: number }[];
};
export type Source = { domain: string; tier: string };
export type Probe = { id: string; source_site: string; outcome: string; results_count: number; searched_at: string };
export type Radar = { runs: Probe[]; sources: { site: string; coolingDown: boolean }[] };
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
