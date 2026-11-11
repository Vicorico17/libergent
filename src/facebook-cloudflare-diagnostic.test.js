import test from 'node:test';
import assert from 'node:assert/strict';
import { probeFacebookOnCloudflare } from './facebook-cloudflare-diagnostic.js';
import worker from '../scripts/facebook-diagnostic-worker.js';

test('Cloudflare browser closes after navigation failure without leaking error text', async () => {
  let closed = false;
  const report = await probeFacebookOnCloudflare({}, { location: 'bucharest', query: 'phone' }, async () => ({
    newPage: async () => ({ setViewport: async () => {}, goto: async () => { throw new Error('secret cookie'); } }),
    close: async () => { closed = true; },
  }));
  assert.equal(closed, true);
  assert.equal(report.status, 'browser_command_failed');
  assert.equal(report.cleanup, 'completed');
  assert.ok(!JSON.stringify(report).includes('secret cookie'));
});
test('Cloudflare reports status and cleanup on successful extraction', async () => {
  const report = await probeFacebookOnCloudflare({}, { location: 'bucharest', query: 'phone', engine: 'kitesurf' }, async (_, options) => {
    assert.equal(options.browser, 'kitesurf');
    assert.equal(options.keep_alive, 60000);
    return {
      newPage: async () => ({ setViewport: async () => {}, goto: async () => ({ status: () => 200 }),
        waitForFunction: async () => {}, evaluate: async () => ({ url: 'https://www.facebook.com/marketplace/bucharest/search/?query=phone', scripts: [] }) }),
      close: async () => {},
    };
  });
  assert.equal(report.httpStatus, 200);
  assert.equal(report.cleanup, 'completed');
  assert.equal(report.locationVerified, false);
});
test('invalid inputs never launch a paid browser', async () => {
  let launched = false;
  await assert.rejects(probeFacebookOnCloudflare({}, { location: 'category', query: 'phone' }, async () => { launched = true; }));
  assert.equal(launched, false);
});
test('test page rejects public hosts, foreign origins and invalid requests', async () => {
  for (const [url, options, status] of [
    ['https://diagnostic.example/', {}, 403],
    ['http://127.0.0.1:8791/probe', { method: 'POST', headers: { Origin: 'https://example.com' } }, 403],
    ['http://127.0.0.1:8791/probe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"location":"../login","query":"phone"}' }, 400],
    ['http://127.0.0.1:8791/', {}, 200],
  ]) assert.equal((await worker.fetch(new Request(url, options), {})).status, status);
});
