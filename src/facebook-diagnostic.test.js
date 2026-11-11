import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFacebookSearchUrl, inspectFacebookPage, runFacebookDiagnostic } from './facebook-diagnostic.js';

const url = buildFacebookSearchUrl({ location: 'bucharest', query: 'iphone 15' });
const feed = (edges) => JSON.stringify({ require: [{ data: { marketplace_search: { feed_units: { edges } } } }] });
const listing = { id: '123', marketplace_listing_title: 'iPhone 15', listing_price: { amount: '2000', formatted_amount: '2.000 lei', currency: 'RON' }, secret: 'do-not-return' };
test('normalizes nested JSON, deduplicates and keeps location unverified', () => {
  const result = inspectFacebookPage({ url, scripts: [feed([{ node: { listing } }, { node: { listing } }])] }, url);
  assert.equal(result.listings.length, 1);
  assert.equal(result.listings[0].price, 2000);
  assert.equal(result.listings[0].currency, 'RON');
  assert.equal(result.locationVerified, false);
  assert.equal(result.status, 'extracted_unverified_location');
  assert.ok(!JSON.stringify(result).includes('do-not-return'));
});
test('unknown prices and currencies stay unknown; zero remains zero', () => {
  const result = inspectFacebookPage({ url, scripts: [feed([
    { node: { listing: { ...listing, listing_price: {} } } },
    { node: { listing: { ...listing, id: '456', listing_price: { amount: '0' } } } },
  ])] }, url);
  assert.equal(result.listings[0].price, null);
  assert.equal(result.listings[0].currency, null);
  assert.equal(result.listings[1].price, 0);
});
test('redirects, login and consent do not expose feed results', () => {
  for (const [override, status] of [
    [{ url: 'https://www.facebook.com/marketplace/category/search/' }, 'location_resolution_failed'],
    [{ dialogs: 'Log in to Facebook' }, 'login_required'],
    [{ url: 'https://www.facebook.com/login/' }, 'login_required'],
    [{ dialogs: 'Allow all cookies' }, 'consent_required'],
    [{ url: 'https://example.com/' }, 'unexpected_redirect'],
  ]) {
    const result = inspectFacebookPage({ url, scripts: [feed([{ node: { listing } }])], ...override }, url);
    assert.equal(result.status, status);
    assert.deepEqual(result.listings, []);
  }
});
test('malformed or absent payload is not a successful empty search', () => {
  assert.equal(inspectFacebookPage({ url, scripts: ['{'] }, url).status, 'unrecognized_payload');
  assert.equal(inspectFacebookPage({ url, scripts: [feed([])] }, url).status, 'empty_unverified');
  assert.throws(() => buildFacebookSearchUrl({ location: '../login', query: 'phone' }));
  assert.throws(() => buildFacebookSearchUrl({ location: 'category', query: 'phone' }));
});
test('browser failure always attempts cleanup without leaking errors', async () => {
  const calls = [];
  const report = await runFacebookDiagnostic({ requestedUrl: url, mode: 'remote', session: 'test', run: async (args) => {
    calls.push(args);
    if (args[0] === 'open') throw new Error('secret credential');
  } });
  assert.deepEqual(calls.map(c => c[0]), ['open', 'stop']);
  assert.equal(report.cleanup, 'completed');
  assert.ok(!JSON.stringify(report).includes('secret credential'));
});
test('cleanup failure is visible even when extraction succeeds', async () => {
  const report = await runFacebookDiagnostic({ requestedUrl: url, mode: 'local', session: 'test', run: async (args) => {
    if (args[0] === 'stop') throw new Error('cleanup failed');
    return JSON.stringify({ status: 'extracted_unverified_location', listings: [] });
  } });
  assert.equal(report.cleanup, 'failed');
});
