import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWhatsAppSendReceipt } from './whatsapp-receipt.js';
import worker from './worker.js';
import { buildConversationHistory } from './conversations.js';

test('message acceptance requires a real provider ID and a recognized outcome', () => {
  for (const payload of [null, [], 'ok', {}, { ok: true }, { messageId: {} }, { messageId: ' ' },
    { messageId: 'x'.repeat(513) }, { messageId: 'id', status: 'unknown' }]) {
    assert.deepEqual(parseWhatsAppSendReceipt(payload), { accepted: false, status: 'unknown', messageId: null });
  }
  assert.deepEqual(parseWhatsAppSendReceipt({ ok: true, messageId: ' id ' }), { accepted: true, status: 'queued', messageId: 'id' });
  assert.deepEqual(parseWhatsAppSendReceipt({ result: { messageId: 'nested', deliveryStatus: 'read' } }),
    { accepted: true, status: 'delivered', messageId: 'nested' });
});

test('provider rejection takes precedence over a message ID', () => {
  for (const payload of [{ ok: false }, { result: { ok: false } }, { status: 'failed' }, { status: 'unavailable' },
    { result: { deliveryStatus: 'failed' } }, { status: 'queued', result: { status: 'failed' } }]) {
    assert.deepEqual(parseWhatsAppSendReceipt({ messageId: 'id', ...payload }), { accepted: false, status: 'failed', messageId: null });
  }
});

test('ambiguous bridge responses never create successful outbound history', async t => {
  const before = { ...process.env };
  t.after(() => {
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  });
  const env = { SUPABASE_URL: 'https://supabase.example', SUPABASE_SECRET_KEY: 'test',
    OPENCLAW_BRIDGE_URL: 'https://bridge.example', OPENCLAW_BRIDGE_TOKEN: 'test' };
  for (const body of ['', 'not json', 'null', '{}', '{"ok":true}', '{"messageId":{}}', 'network-error']) {
    let sends = 0; let historyWrites = 0;
    const mock = t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
      if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: 'buyer' });
      if (String(url).includes('/agent_entitlements')) return Response.json([{ status: 'active' }]);
      if (String(url).includes('/deal_send_attempts')) return Response.json([JSON.parse(init.body)]);
      if (String(url).includes('/rest/')) { historyWrites++; return Response.json([]); }
      sends++;
      if (body === 'network-error') throw Error('private-bridge-detail');
      return new Response(body, { status: 200 });
    });
    const response = await worker.fetch(new Request('https://libergent.test/api/whatsapp/send', {
      method: 'POST', headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: '22222222-2222-4222-8222-222222222222', target: '+40722000000', message: 'test' })
    }), env);
    assert.equal(response.status, 502);
    const payload = await response.json();
    assert.equal(payload.code, 'send_outcome_unknown');
    assert.equal(payload.messageId, undefined);
    assert.doesNotMatch(JSON.stringify(payload), /private-bridge-detail/);
    assert.equal(historyWrites, 0);
    assert.equal(sends, 1);
    mock.mock.restore();
  }
});

test('an uncertain deal send remains reserved and replay cannot send it twice', async t => {
  const before = { ...process.env };
  t.after(() => {
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  });
  const dealId = '11111111-1111-4111-8111-111111111111';
  const key = '22222222-2222-4222-8222-222222222222';
  const listing = { url: 'https://www.olx.ro/d/oferta/test.html' };
  const target = '+40722123456';
  const row = { message_id: 'original', direction: 'outbound', to_number: target, text: 'Hello',
    received_at: '2026-10-30T10:00:00Z', raw: { userId: 'buyer', listing } };
  const [conversation] = buildConversationHistory([row], { userId: 'buyer' });
  let attempt; let sends = 0; let historyWrites = 0;
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    const path = new URL(url).pathname;
    if (path.endsWith('/auth/v1/user')) return Response.json({ id: 'buyer' });
    if (path.endsWith('/agent_entitlements')) return Response.json([{ status: 'active' }]);
    if (path.endsWith('/deal_cases')) return Response.json([{ id: dealId, listing_url: listing.url, stage: 'negotiating' }]);
    if (path.endsWith('/whatsapp_messages')) {
      if (init.method === 'POST') historyWrites++;
      return Response.json([row]);
    }
    if (path.endsWith('/deal_send_attempts')) {
      if (init.method === 'POST') {
        if (attempt) return Response.json([]);
        attempt = { ...JSON.parse(init.body), status: 'pending' };
      } else if (init.method === 'PATCH') Object.assign(attempt, JSON.parse(init.body));
      return Response.json([attempt]);
    }
    if (path === '/whatsapp/send') { sends++; return Response.json({ ok: true }); }
    throw Error('Unexpected request');
  });
  const send = () => worker.fetch(new Request('https://libergent.test/api/whatsapp/send', {
    method: 'POST', headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify({ target, message: 'Reply', listing, dealId, conversationId: conversation.id, idempotencyKey: key })
  }), { SUPABASE_URL: 'https://supabase.example', SUPABASE_SECRET_KEY: 'test',
    OPENCLAW_BRIDGE_URL: 'https://bridge.example', OPENCLAW_BRIDGE_TOKEN: 'test' });
  assert.equal((await send()).status, 502);
  assert.equal(attempt.status, 'unknown');
  const replay = await send();
  assert.equal(replay.status, 409);
  assert.equal((await replay.json()).code, 'send_attempt_exists');
  assert.equal(sends, 1);
  assert.equal(historyWrites, 0);
});
