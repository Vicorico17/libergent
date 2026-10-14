import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleStats, recentProbes, latestTimestamp } from './stats-data.ts';

test('unavailable and empty histories do not fabricate zero outcomes', () => {
  assert.equal(sampleStats(null).listings, null);
  assert.equal(sampleStats({ recentSearches: [] }).withResults, null);
  assert.equal(sampleStats({ recentSearches: [{}] }).sourceSuccess, null);
});
test('sample rates use valid observations and weighted source attempts', () => {
  const stats = sampleStats({ recentSearches: [
    { totalListings: 10, successfulMarketplaces: 2, marketplaces: 4 },
    { totalListings: 0, successfulMarketplaces: 1, marketplaces: 1 },
    {},
  ] });
  assert.equal(stats.listings, 10);
  assert.equal(stats.withResults, 50);
  assert.equal(stats.sourceSuccess, 60);
  assert.equal(stats.size, 3);
});
test('recent agent activity excludes old, future and invalid timestamps', () => {
  const now = Date.parse('2026-10-14T12:00:00Z');
  const runs = ['2026-10-14T11:45:00Z', '2026-10-14T11:59:00Z', '2026-10-14T11:44:59Z', '2026-10-14T12:01:00Z', 'invalid'].map(searched_at => ({ searched_at }));
  assert.equal(recentProbes(runs, now).length, 2);
});
test('last activity sorts timestamps chronologically rather than textually', () => {
  assert.equal(latestTimestamp(['invalid', undefined]), null);
  assert.equal(latestTimestamp(['2026-10-14T12:00:00+03:00', '2026-10-14T10:00:00Z']), '2026-10-14T10:00:00Z');
});

test('agent metrics use measured outcomes and durations, preserving missing data', async () => {
  const { agentStats } = await import('./stats-data.ts');
  const stats = agentStats({ runs: [
    { source_site: 'olx', outcome: 'results', results_count: 5, parsed_count: 12, elapsed_ms: 2000, searched_at: '2026-10-14T12:00:00Z' },
    { source_site: 'olx', outcome: 'empty', results_count: 0, parsed_count: 3, elapsed_ms: 4000, searched_at: '2026-10-14T11:00:00Z' },
    { source_site: 'vinted', outcome: 'error', elapsed_ms: 9000, searched_at: '2026-10-14T10:00:00Z' },
  ], sources: [{ site: 'olx', coolingDown: true }, { site: 'unobserved', coolingDown: false }], repairQueue: [{ state: 'open', site: 'vinted' }, { state: 'recovered', site: 'olx' }] });
  assert.equal(stats.runs, 3);
  assert.equal(stats.withOffers, 1);
  assert.equal(stats.empty, 1);
  assert.equal(stats.errors, 1);
  assert.equal(stats.offers, 5);
  assert.equal(stats.parsed, 15);
  assert.equal(stats.medianMs, 4000);
  assert.equal(stats.openRepairs, 1);
  assert.equal(stats.recovered, 1);
  const olx = stats.sourceRows.find(row => row.site === 'olx');
  assert.equal(olx.outcome, 'results');
  assert.equal(olx.coolingDown, true);
  assert.equal(olx.errors, 0);
  assert.equal(olx.checks, 2);
  assert.equal(stats.sourceRows.find(row => row.site === 'unobserved').outcome, null);
});
test('no measured timings or outcomes remain unavailable instead of zero', async () => {
  const { agentStats } = await import('./stats-data.ts');
  const stats = agentStats(null);
  assert.equal(stats.medianMs, null);
  assert.equal(stats.offers, null);
  assert.equal(stats.parsed, null);
  assert.equal(stats.openRepairs, null);
  const even = agentStats({ runs: [{ elapsed_ms: 1000 }, { elapsed_ms: 3000 }, { elapsed_ms: -1 }, {}], sources: [] });
  assert.equal(even.medianMs, 2000);
});
