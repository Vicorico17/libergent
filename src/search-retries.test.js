import test from 'node:test';
import assert from 'node:assert/strict';
import { searchAcrossSites } from './app.js';

function configure(t) {
  const before = { ...process.env };
  process.env.LIBERGENT_MOCK_SEARCH = '0';
  process.env.LIBERGENT_MOCK_PROVIDER = '0';
  t.after(() => {
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  });
}
const search = site => searchAcrossSites({ query: 'iphone', siteKeys: [site], provider: 'direct', limit: 1, maxPages: 1 });

test('permanent HTML errors and throttling do not repeat through either retry layer', async t => {
  configure(t);
  for (const status of [400, 401, 403, 404, 406, 410, 429]) {
    let calls = 0;
    const mock = t.mock.method(globalThis, 'fetch', async () => {
      calls++; return new Response('Rejected', { status, headers: { 'retry-after': '120' } });
    });
    const { results: [result] } = await search('olx.ro');
    assert.equal(calls, 1, `HTTP ${status}`);
    assert.equal(result.ok, false);
    assert.equal(result.attempts, 1);
    assert.equal(result.upstreamStatus, status);
    mock.mock.restore();
  }
});

test('JSON source throttling is also returned without immediate retry', async t => {
  configure(t);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++; return new Response('Slow down', { status: 429 });
  });
  const { results: [result] } = await search('altex.ro');
  assert.equal(calls, 1);
  assert.equal(result.upstreamStatus, 429);
  assert.match(result.error, /Direct JSON fetch failed/);
});

test('Vinted challenge retry exception does not override HTTP 429', async t => {
  configure(t);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++; return new Response('Challenge', { status: 429, headers: { 'cf-mitigated': 'challenge' } });
  });
  const { results: [result] } = await search('vinted.ro');
  assert.equal(calls, 1);
  assert.equal(result.attempts, 1);
  assert.equal(result.upstreamStatus, 429);
});

test('temporary HTTP failures still recover through a bounded retry', async t => {
  configure(t);
  for (const status of [408, 425, 502, 503]) {
    let calls = 0;
    const mock = t.mock.method(globalThis, 'fetch', async () => {
      calls++;
      return calls === 1 ? new Response('Temporary', { status }) : new Response(`
        <div data-cy="l-card" data-testid="l-card">
          <a href="/d/oferta/iphone-IDtest.html"><h4>iPhone 15</h4></a>
          <p data-testid="ad-price">2000 lei</p>
        </div>`);
    });
    const { results: [result] } = await search('olx.ro');
    assert.equal(calls, 2, `HTTP ${status}`);
    assert.equal(result.ok, true);
    assert.equal(result.itemCount, 1);
    mock.mock.restore();
  }
});
