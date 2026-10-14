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
