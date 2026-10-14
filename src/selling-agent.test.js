import test from 'node:test';
import assert from 'node:assert/strict';
import { runSellingAgent } from './selling-agent.js';

const env = { LIBERGENT_URL: 'https://example.com', LIBERGENT_ACCESS_TOKEN: 'test-token' };
const id = '11111111-1111-4111-8111-111111111111';
test('agent saves without publishing and forwards owner credential without redirects', async () => {
  const calls = [];
  await runSellingAgent('save', { id, listing: { title: 'Test product' } }, { env, fetcher: async (url, options) => {
    calls.push(url.pathname);
    assert.equal(options.headers.authorization, 'Bearer test-token');
    assert.equal(options.redirect, 'error');
    assert.equal(JSON.parse(options.body).id, id);
    return Response.json({ draft: { id } });
  } });
  assert.deepEqual(calls, ['/api/selling/drafts']);
});
test('agent rejects unsupported destinations and missing authentication before network', async () => {
  const fetcher = () => { throw new Error('Unexpected network call'); };
  await assert.rejects(runSellingAgent('publish', { id, platforms: ['facebook'] }, { env, fetcher }), /only olx and okazii/);
  await assert.rejects(runSellingAgent('status', {}, { env: {}, fetcher }), /secure environment/);
  await assert.rejects(runSellingAgent('status', {}, { env: { ...env, LIBERGENT_URL: 'http://example.com' }, fetcher }), /HTTPS/);
});
test('agent preserves partial and uncertain receipts and stable draft ID', async () => {
  const results = [{ platform: 'olx', status: 'unknown' }, { platform: 'okazii', status: 'feed_ready' }];
  const result = await runSellingAgent('publish', { id, platforms: ['olx', 'okazii'] }, { env, fetcher: async (url, options) => {
    assert.equal(url.pathname, '/api/selling/publish');
    assert.equal(JSON.parse(options.body).id, id);
    return Response.json({ results });
  } });
  assert.deepEqual(result, { results });
});
test('agent surfaces authentication failure without continuing to publish', async () => {
  await assert.rejects(runSellingAgent('get', { id }, { env, fetcher: async () => Response.json({ error: 'Session expired' }, { status: 401 }) }), /Session expired/);
});
