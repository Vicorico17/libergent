import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { isSellerStopRequest } from './contact-stop.js';
import worker from './worker.js';

test('recognizes explicit seller stop requests without treating ordinary product replies as stops', () => {
  for (const text of ['STOP', 'please stop!', 'Nu mai trimite mesaje', 'Nu mai îmi scrie', 'Oprește mesajele', "Don't contact me", 'Do not message me']) {
    assert.equal(isSellerStopRequest(text), true, text);
  }
  for (const text of ['Este disponibil', 'Magazin non-stop', "Please don't stop", 'stopwatch', 'Are sistem start-stop']) {
    assert.equal(isSellerStopRequest(text), false, text);
  }
});

test('seller stops persist before attribution and block all buyers/listings without provider calls', async t => {
  const db = new PGlite(); const before = { ...process.env };
  t.after(async () => {
    await db.close();
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  });
  await db.exec('create role anon; create role authenticated; create role service_role;');
  const migration = await readFile(new URL('../supabase/whatsapp_messages.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  // Backfill historical stop messages, preserving the normal-message case.
  const examples = ['STOP', 'Nu mai îmi scrie', 'OPREȘTE mesajele', "Don't contact me", 'Magazin non-stop'];
  for (let i = 0; i < examples.length; i++) {
    await db.query(`insert into whatsapp_messages(message_id,direction,from_number,text,received_at)
      values($1,'inbound',$2,$3,now())`, [`old-${i}`, `+4072200000${i}`, examples[i]]);
  }
  await db.exec(migration);
  assert.equal((await db.query('select count(*)::int as count from whatsapp_contact_stops')).rows[0].count, 4);
  let failLookup = true; let failPreferences = false; let unexpected = 0;
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = new URL(input);
    assert.equal(url.origin, 'https://db.test', 'Never contact a seller/provider');
    if (url.pathname.endsWith('/auth/v1/user')) return Response.json({ id: init.headers.authorization === 'Bearer buyer2' ? 'buyer2' : 'buyer1' });
    if (url.pathname.endsWith('/agent_entitlements')) return Response.json([{ status: 'active' }]);
    if (url.pathname.endsWith('/whatsapp_contact_stops')) {
      if (failPreferences) return Response.json({}, { status: 503 });
      if (init.method === 'POST') {
        await db.query('insert into whatsapp_contact_stops(seller_phone) values($1) on conflict do nothing', [JSON.parse(init.body).seller_phone]);
        return new Response(null, { status: 201 });
      }
      return Response.json((await db.query('select seller_phone from whatsapp_contact_stops where seller_phone=$1', [url.searchParams.get('seller_phone').slice(3)])).rows);
    }
    if (url.pathname.endsWith('/whatsapp_messages')) {
      if (init.method === 'POST') return new Response(null, { status: 201 });
      if (failLookup) return Response.json({}, { status: 503 });
      return Response.json([]); // No unambiguous account is needed to store a stop.
    }
    unexpected++;
    throw Error('No attempt reservation or provider call expected');
  });
  const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SECRET_KEY: 'test', OPENCLAW_INBOUND_TOKEN: 'inbound',
    OPENCLAW_BRIDGE_URL: 'https://bridge.test', OPENCLAW_BRIDGE_TOKEN: 'test' };
  const inbound = text => worker.fetch(new Request('https://app.test/api/openclaw/inbound', {
    method: 'POST', headers: { authorization: 'Bearer inbound', 'content-type': 'application/json' },
    body: JSON.stringify({ from: '+40722999999', text, messageId: 'stop-1' })
  }), env);
  assert.equal((await inbound('STOP')).status, 500); // Ownership is down, but stop is already durable.
  assert.equal((await db.query("select count(*)::int as count from whatsapp_contact_stops where seller_phone='+40722999999'")).rows[0].count, 1);
  failLookup = false;
  assert.equal((await inbound('STOP')).status, 200);
  assert.equal((await inbound('Mulțumesc')).status, 200); // Ordinary replies cannot re-enable contact.
  const send = (buyer, listing) => worker.fetch(new Request('https://app.test/api/whatsapp/send', {
    method: 'POST', headers: { authorization: `Bearer ${buyer}`, 'content-type': 'application/json' },
    body: JSON.stringify({ target: '0722999999', message: 'Hello', listing: { url: listing }, idempotencyKey: crypto.randomUUID() })
  }), env);
  for (const buyer of ['buyer1', 'buyer2']) {
    const response = await send(buyer, `https://listing.test/${buyer}`);
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, 'seller_contact_stopped');
  }
  failPreferences = true;
  assert.equal((await send('buyer1', 'https://listing.test/new')).status, 503);
  assert.equal(unexpected, 0);
  // Retaining stops independently avoids accidentally opting sellers back in
  // when conversation history is deleted.
  await db.exec('delete from whatsapp_messages');
  await db.exec(migration);
  assert.equal((await db.query('select count(*)::int as count from whatsapp_contact_stops')).rows[0].count, 5);
  assert.equal((await db.query("select has_table_privilege('authenticated','whatsapp_contact_stops','SELECT') as allowed")).rows[0].allowed, false);
});
