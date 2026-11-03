import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';
import { buildConversationHistory } from './conversations.js';

const phone = '+40722123456';
const outbound = (owner, url) => ({ direction: 'outbound', to_number: phone, raw: { userId: owner, listing: { url } } });
const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SECRET_KEY: 'test', OPENCLAW_INBOUND_TOKEN: 'inbound-test' };
const request = () => new Request('https://app.test/api/openclaw/inbound', {
  method: 'POST', headers: { authorization: 'Bearer inbound-test', 'content-type': 'application/json' },
  body: JSON.stringify({ from: phone, text: 'Reply', messageId: 'incoming-1', raw: {
    userId: 'forged-owner', listing: { url: 'https://forged.test' }, providerField: 'kept'
  } })
});

test('inbound account/listing ownership is derived only from unambiguous outbound history', async t => {
  const before = { ...process.env };
  t.after(() => { for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key]; Object.assign(process.env, before); });
  for (const rows of [[], [outbound('owner', 'https://listing.test/a'), outbound('other', 'https://listing.test/a')],
    [outbound('owner', 'https://listing.test/a'), outbound('owner', 'https://listing.test/b')],
    [outbound('owner', 'https://listing.test/a')]]) {
    let stored;
    const mock = t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
      assert.equal(new URL(url).origin, 'https://db.test');
      if (init.method === 'POST') { stored = JSON.parse(init.body); return new Response(null, { status: 201 }); }
      return Response.json(rows);
    });
    assert.equal((await worker.fetch(request(), env)).status, 200);
    assert.equal(stored.raw.providerField, 'kept');
    if (rows.length === 1) {
      assert.equal(stored.raw.userId, 'owner');
      assert.equal(stored.raw.listing.url, 'https://listing.test/a');
    } else {
      assert.equal(stored.raw.userId, undefined);
      assert.equal(stored.raw.listing, undefined);
      assert.deepEqual(buildConversationHistory([stored], { userId: 'forged-owner' }), []);
    }
    mock.mock.restore();
  }
});

test('ownership lookup failure is retryable and does not acknowledge or store an unassigned message', async t => {
  const before = { ...process.env };
  t.after(() => { for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key]; Object.assign(process.env, before); });
  let writes = 0;
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (init.method === 'POST') writes++;
    return Response.json({ message: 'Database unavailable' }, { status: 503 });
  });
  assert.equal((await worker.fetch(request(), env)).status, 500);
  assert.equal(writes, 0);
  assert.equal((await worker.fetch(request(), { OPENCLAW_INBOUND_TOKEN: 'inbound-test' })).status, 503);
});

test('unlabelled replies stay separate when a seller has multiple listings', () => {
  const rows = [outbound('owner', 'https://listing.test/a'), outbound('owner', 'https://listing.test/b')]
    .map((row, index) => ({ ...row, message_id: `out-${index}`, received_at: `2026-10-30T10:0${index}:00Z` }));
  for (let i = 0; i < 2; i++) rows.push({ direction: 'inbound', from_number: phone, message_id: `reply-${i}`,
    text: 'S-a vândut', received_at: `2026-10-30T10:0${i+2}:00Z`, raw: { userId: 'owner' } });
  const conversations = buildConversationHistory(rows, { userId: 'owner' });
  assert.equal(conversations.length, 3);
  for (const conversation of conversations.filter(item => item.listingUrl)) {
    assert.equal(conversation.messages.length, 1);
    assert.notEqual(conversation.status, 'unavailable');
  }
  assert.equal(conversations.find(item => !item.listingUrl).messages.length, 2);
});

test('quoted provider message IDs identify the exact owner/listing and never fall back to another seller', async t => {
  const before = { ...process.env };
  t.after(() => { for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key]; Object.assign(process.env, before); });
  for (const match of [outbound('owner', 'https://listing.test/a'), outbound('other', 'https://listing.test/b'),
    { ...outbound('wrong', 'https://listing.test/c'), to_number: '+40722999999' }, null]) {
    let stored; let lookups = 0;
    const mock = t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
      const url = new URL(input);
      if (init.method === 'POST') { stored = JSON.parse(init.body); return new Response(null, { status: 201 }); }
      lookups++;
      assert.equal(url.searchParams.get('message_id'), 'eq.provider-original');
      assert.equal(url.searchParams.get('to_number'), `eq.${phone}`);
      return Response.json(match ? [{ ...match, message_id: 'provider-original' }] : []);
    });
    const input = await request().json();
    const response = await worker.fetch(new Request('https://app.test/api/openclaw/inbound', {
      method: 'POST', headers: { authorization: 'Bearer inbound-test', 'content-type': 'application/json' },
      body: JSON.stringify({ ...input, replyToMessageId: 'provider-original' })
    }), env);
    assert.equal(response.status, 200);
    assert.equal(lookups, 1);
    assert.equal(stored.raw.userId, match?.to_number === phone ? match.raw.userId : undefined);
    assert.equal(stored.raw.listing?.url, match?.to_number === phone ? match.raw.listing.url : undefined);
    mock.mock.restore();
  }
});

test('malformed quoted message references reject before database work', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('No database call expected'));
  for (const reference of ['', {}, 'x'.repeat(513), 'bad\nreference']) {
    const response = await worker.fetch(new Request('https://app.test/api/openclaw/inbound', {
      method: 'POST', headers: { authorization: 'Bearer inbound-test', 'content-type': 'application/json' },
      body: JSON.stringify({ from: phone, text: 'Reply', messageId: 'incoming-test', replyToMessageId: reference })
    }), env);
    assert.equal(response.status, 400);
  }
});

test('inbound messages require stable IDs before storage or stop handling', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('No database call expected'));
  for (const messageId of [undefined, {}, '', 'x'.repeat(513), 'bad\nID']) {
    const response = await worker.fetch(new Request('https://app.test/api/openclaw/inbound', {
      method: 'POST', headers: { authorization: 'Bearer inbound-test', 'content-type': 'application/json' },
      body: JSON.stringify({ from: phone, text: 'Reply', messageId })
    }), env);
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /stable provider messageId/);
  }
});
