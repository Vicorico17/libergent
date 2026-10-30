import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import worker from './worker.js';

test('one-off sends reserve atomically in PostgreSQL and isolate owners and request content', async t => {
  const before = { ...process.env };
  const db = new PGlite();
  t.after(async () => {
    await db.close();
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  });
  const owner = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    insert into auth.users values('${owner}'),('${other}');`);
  const migration = await readFile(new URL('../supabase/deals.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  // Simulate the previous schema and verify the upgrade works in place.
  await db.exec('alter table deal_send_attempts alter column deal_id set not null; alter table deal_send_attempts drop column listing_url;');
  await db.exec(migration);
  let sends = 0; let unknown = false; let unavailable = false;
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = new URL(input);
    if (url.origin === 'https://bridge.test') {
      sends++;
      assert.ok(JSON.parse(init.body).idempotencyKey);
      return Response.json(unknown ? {} : { ok: true, messageId: `provider-${sends}` });
    }
    assert.equal(url.origin, 'https://db.test');
    if (url.pathname === '/auth/v1/user') return Response.json({ id: init.headers.authorization === 'Bearer other' ? other : owner });
    if (url.pathname.endsWith('/agent_entitlements')) return Response.json([{ status: 'active' }]);
    if (url.pathname.endsWith('/whatsapp_contact_stops')) return Response.json([]);
    if (url.pathname.endsWith('/whatsapp_messages')) return new Response(null, { status: 201 });
    assert.ok(url.pathname.endsWith('/deal_send_attempts'));
    if (unavailable) return Response.json({ message: 'missing migration' }, { status: 503 });
    const data = init.body ? JSON.parse(init.body) : null;
    if (init.method === 'POST') {
      const result = await db.query(`insert into deal_send_attempts
        (idempotency_key,deal_id,user_id,seller_phone,message,listing_url) values ($1,$2,$3,$4,$5,$6)
        on conflict(idempotency_key) do nothing returning *`,
      [data.idempotency_key, data.deal_id, data.user_id, data.seller_phone, data.message, data.listing_url]);
      return Response.json(result.rows);
    }
    const key = url.searchParams.get('idempotency_key').slice(3);
    const userId = url.searchParams.get('user_id').slice(3);
    if (init.method === 'PATCH') {
      const columns = Object.keys(data);
      assert.ok(columns.every(column => ['status','provider_message_id','delivery_status','history_saved','error','updated_at'].includes(column)));
      return Response.json((await db.query(`update deal_send_attempts set ${columns.map((column, i) => `${column}=$${i+3}`).join(',')}
        where idempotency_key=$1 and user_id=$2 returning *`, [key, userId, ...Object.values(data)])).rows);
    }
    return Response.json((await db.query('select * from deal_send_attempts where idempotency_key=$1 and user_id=$2', [key, userId])).rows);
  });
  const key = '33333333-3333-4333-8333-333333333333';
  const request = (changes = {}, token = 'owner') => worker.fetch(new Request('https://app.test/api/whatsapp/send', {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ idempotencyKey: key, target: '+40722123456', message: 'Hello', listing: { url: 'https://www.olx.ro/d/oferta/test.html' }, ...changes })
  }), { SUPABASE_URL: 'https://db.test', SUPABASE_SECRET_KEY: 'test', OPENCLAW_BRIDGE_URL: 'https://bridge.test', OPENCLAW_BRIDGE_TOKEN: 'test' });
  assert.equal((await request({ idempotencyKey: undefined })).status, 400);
  const concurrent = await Promise.all([request(), request()]);
  assert.ok(concurrent.some(response => response.status === 200));
  assert.ok(concurrent.every(response => [200, 409].includes(response.status)));
  assert.equal(sends, 1);
  const replay = await request();
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).deduplicated, true);
  for (const changes of [{ message: 'Different' }, { target: '+40722999999' }, { listing: { url: 'https://www.olx.ro/d/oferta/other.html' } }]) {
    assert.equal((await request(changes)).status, 409);
  }
  assert.equal((await request({}, 'other')).status, 409);
  assert.equal(sends, 1);
  unknown = true;
  const uncertain = { idempotencyKey: '44444444-4444-4444-8444-444444444444' };
  assert.equal((await request(uncertain)).status, 502);
  assert.equal((await request(uncertain)).status, 409);
  assert.equal(sends, 2);
  unavailable = true;
  assert.equal((await request({ idempotencyKey: '55555555-5555-4555-8555-555555555555' })).status, 503);
  assert.equal(sends, 2);
  await db.exec(migration);
  assert.equal((await db.query('select count(*)::int as count from deal_send_attempts')).rows[0].count, 2);
  assert.equal((await db.query("select has_table_privilege('authenticated','deal_send_attempts','SELECT') as allowed")).rows[0].allowed, false);
});
