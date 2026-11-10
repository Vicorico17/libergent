import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { runCreditSearch } from './search-credits.js';
import { createCreditCheckout, fulfillCreditPack, fulfillMonthlyCredits } from './credit-billing.js';
import worker from './worker.js';

const user = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const env = { SEARCH_CREDITS_ENABLED: '1', SUPABASE_URL: 'https://db.test', SUPABASE_SECRET_KEY: 'secret',
  STRIPE_SECRET_KEY: 'sk_test_test', STRIPE_WEBHOOK_SECRET: 'whsec_test', LIBERGENT_PUBLIC_URL: 'https://app.test',
  STRIPE_MONTHLY_PRICE_ID: 'price_monthly', STRIPE_CREDITS_10_PRICE_ID: 'price_ten', STRIPE_CREDITS_30_PRICE_ID: 'price_thirty' };
async function database(t) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec('create role anon; create role authenticated; create role service_role;');
  const sql = await readFile(new URL('../supabase/search_credits.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  const wallet = async (action, fields = {}, owner = user) => {
    const args = [owner, action, fields.p_reference ?? null, fields.p_amount ?? null, fields.p_expires_at ?? null,
      fields.p_request_id ?? null, fields.p_fingerprint ?? null, fields.p_response == null ? null : JSON.stringify(fields.p_response)];
    return (await db.query('select search_credit_wallet($1,$2,$3,$4,$5,$6,$7,$8) as result', args)).rows[0].result;
  };
  return { db, wallet, sql };
}
function stubFetch(t, callback) {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; }); globalThis.fetch = callback;
}

test('wallet grants are idempotent, expire correctly, spend monthly first, and cannot be mutated by clients', async t => {
  const { db, wallet, sql } = await database(t);
  assert.equal((await wallet('status')).balance, 0);
  await wallet('grant', { p_reference: 'checkout:one', p_amount: 10 });
  assert.equal((await wallet('grant', { p_reference: 'checkout:one', p_amount: 10 })).balance, 10);
  await assert.rejects(wallet('grant', { p_reference: 'checkout:one', p_amount: 10 }, other), /conflict/);
  const expiry = new Date(Date.now() + 3600000).toISOString();
  await wallet('grant', { p_reference: 'invoice:one', p_amount: 2, p_expires_at: expiry });
  const id = crypto.randomUUID();
  const reserved = await wallet('reserve', { p_request_id: id, p_amount: 3, p_fingerprint: 'query' });
  assert.equal(reserved.balance, 9); assert.equal(reserved.included, 0); assert.equal(reserved.purchased, 9);
  const duplicate = await wallet('reserve', { p_request_id: id, p_amount: 3, p_fingerprint: 'query' });
  assert.equal(duplicate.code, 'search_in_progress'); assert.equal(duplicate.balance, 9);
  assert.equal((await wallet('reserve', { p_request_id: id, p_amount: 3, p_fingerprint: 'different' })).code, 'request_conflict');
  assert.equal((await wallet('refund', { p_request_id: id })).balance, 12);
  assert.equal((await wallet('refund', { p_request_id: id })).balance, 12);
  await wallet('grant', { p_reference: 'invoice:expired', p_amount: 40, p_expires_at: new Date(Date.now() - 1000).toISOString() });
  assert.equal((await wallet('status')).balance, 12);
  await db.exec(sql);
  for (const role of ['anon', 'authenticated']) {
    assert.equal((await db.query(`select has_function_privilege('${role}', 'search_credit_wallet(uuid,text,text,integer,timestamptz,uuid,text,jsonb)', 'execute') as allowed`)).rows[0].allowed, false);
    assert.equal((await db.query(`select has_table_privilege('${role}', 'search_credit_grants', 'update') as allowed`)).rows[0].allowed, false);
  }
});

test('simultaneous reservations never overspend; crashed searches recover; completed results replay without charge', async t => {
  const { db, wallet } = await database(t);
  await wallet('grant', { p_reference: 'pack', p_amount: 1 });
  const ids = [crypto.randomUUID(), crypto.randomUUID()];
  const results = await Promise.all(ids.map(id => wallet('reserve', { p_request_id: id, p_amount: 1, p_fingerprint: 'same' })));
  assert.equal(results.filter(result => result.reserved).length, 1);
  assert.equal(results.filter(result => result.code === 'insufficient_credits').length, 1);
  await db.exec("update search_credit_usage set created_at = now() - interval '11 minutes'");
  assert.equal((await wallet('status')).balance, 1);
  assert.equal((await wallet('complete', { p_request_id: ids[0], p_response: {} })).code, 'request_expired');
  const id = crypto.randomUUID();
  await wallet('reserve', { p_request_id: id, p_amount: 1, p_fingerprint: 'next' });
  await wallet('complete', { p_request_id: id, p_response: { results: [{ ok: true }] } });
  const replay = await wallet('reserve', { p_request_id: id, p_amount: 1, p_fingerprint: 'next' });
  assert.deepEqual(replay.replay, { results: [{ ok: true }] }); assert.equal(replay.balance, 0);
  assert.equal((await wallet('refund', { p_request_id: id })).balance, 0);
  assert.equal((await wallet('status', {}, other)).balance, 0);
});

test('search execution refunds outages, charges usable empty results, and replays successful requests', async t => {
  const { wallet } = await database(t);
  stubFetch(t, async (url, init) => {
    assert.match(String(url), /rpc\/search_credit_wallet$/);
    const { p_user_id, p_action, ...fields } = JSON.parse(init.body);
    return Response.json(await wallet(p_action, fields, p_user_id));
  });
  await wallet('grant', { p_reference: 'pack', p_amount: 2 });
  const options = { userId: user, requestId: crypto.randomUUID(), fingerprint: 'search', env };
  await assert.rejects(runCreditSearch({ ...options, execute: async () => ({ results: [{ ok: false }] }) }), /returnat/);
  assert.equal((await wallet('status')).balance, 2);
  const next = { ...options, requestId: crypto.randomUUID() };
  const response = await runCreditSearch({ ...next, execute: async () => ({ results: [{ ok: true, items: [] }] }) });
  assert.equal(response.credits.spent, 1); assert.equal(response.credits.balance, 1);
  const replay = await runCreditSearch({ ...next, execute: () => { throw new Error('must not execute'); } });
  assert.equal(replay.credits.spent, 0); assert.equal(replay.credits.balance, 1);
  await assert.rejects(runCreditSearch({ ...next, requestId: '', execute: () => {} }), /request ID/);
});

test('checkout validates prices and creates monthly or one-time sessions without a trial', async t => {
  const created = [];
  stubFetch(t, async (url, init) => {
    if (String(url).endsWith('/prices/price_monthly')) return Response.json({ active: true, currency: 'ron', unit_amount: 4900, recurring: { interval: 'month', interval_count: 1 } });
    if (String(url).endsWith('/prices/price_ten')) return Response.json({ active: true, currency: 'ron', unit_amount: 1900 });
    if (String(url).endsWith('/checkout/sessions')) { created.push(new URLSearchParams(init.body)); return Response.json({ url: 'https://checkout.stripe.com/session' }); }
    throw new Error(`Unexpected ${url}`);
  });
  for (const plan of ['monthly', 'credits10']) await createCreditCheckout({ user: { id: user }, plan, requestUrl: 'https://app.test', returnTo: '/search?q=bike', env });
  assert.equal(created[0].get('mode'), 'subscription'); assert.equal(created[1].get('mode'), 'payment');
  assert.equal(created[0].has('subscription_data[trial_period_days]'), false);
  assert.match(created[1].get('success_url'), /\/search\?q=bike&checkout=success/);
  await assert.rejects(createCreditCheckout({ user: { id: user }, plan: 'madeup', env }), /not available/);
});

test('paid top-ups validate ownership, amount and price, and duplicate events only grant once', async t => {
  const { wallet } = await database(t);
  const session = { id: 'cs_test_one', mode: 'payment', payment_status: 'unpaid', currency: 'ron', amount_total: 1900,
    client_reference_id: user, metadata: { user_id: user, credit_offer: 'credits10' },
    line_items: { data: [{ quantity: 1, price: { id: 'price_ten' } }] } };
  stubFetch(t, async (url, init) => {
    if (String(url).includes('/checkout/sessions/')) return Response.json(session);
    const { p_user_id, p_action, ...fields } = JSON.parse(init.body);
    return Response.json(await wallet(p_action, fields, p_user_id));
  });
  await fulfillCreditPack(session, env); assert.equal((await wallet('status')).balance, 0);
  session.payment_status = 'paid';
  await fulfillCreditPack(session, env); await fulfillCreditPack(session, env);
  assert.equal((await wallet('status')).balance, 10);
  session.amount_total = 1; await assert.rejects(fulfillCreditPack(session, env), /Invalid paid/);
  session.amount_total = 1900; session.metadata.user_id = other; await assert.rejects(fulfillCreditPack(session, env), /Invalid paid/);
});

test('only a paid monthly cycle grants 40 expiring credits; duplicate invoices and proration do not add extra credits', async t => {
  const { wallet } = await database(t);
  const invoice = { id: 'in_one', status: 'paid', subscription: 'sub_one', billing_reason: 'subscription_cycle',
    lines: { data: [{ price: { id: 'price_monthly' }, quantity: 1, period: { end: Math.floor(Date.now()/1000) + 3600 } }] } };
  stubFetch(t, async (url, init) => {
    if (String(url).includes('/invoices/')) return Response.json(invoice);
    const { p_user_id, p_action, ...fields } = JSON.parse(init.body);
    return Response.json(await wallet(p_action, fields, p_user_id));
  });
  const event = { type: 'invoice.paid', data: { object: { id: invoice.id } } };
  await fulfillMonthlyCredits(event, { id: 'sub_one' }, user, env);
  await fulfillMonthlyCredits(event, { id: 'sub_one' }, user, env);
  assert.equal((await wallet('status')).included, 40);
  invoice.id = 'in_two'; invoice.billing_reason = 'subscription_update';
  await fulfillMonthlyCredits({ ...event, data: { object: { id: invoice.id } } }, { id: 'sub_one' }, user, env);
  assert.equal((await wallet('status')).included, 40);
});

test('premium endpoint requires explicit POST and cannot bypass credits through cached results', async t => {
  stubFetch(t, async (url, init) => {
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: user });
    if (String(url).endsWith('/rpc/search_credit_wallet')) {
      assert.equal(JSON.parse(init.body).p_action, 'reserve');
      return Response.json({ code: 'insufficient_credits', balance: 0 });
    }
    throw new Error(`Unexpected ${url}`);
  });
  const url = 'https://app.test/api/search/premium?q=bike&site=all';
  const headers = { authorization: 'Bearer token', 'x-search-request-id': crypto.randomUUID() };
  assert.equal((await worker.fetch(new Request(url, { headers }), { ...env, BROWSER: {} })).status, 405);
  const denied = await worker.fetch(new Request(url, { method: 'POST', headers }), { ...env, BROWSER: {} });
  assert.equal(denied.status, 402); assert.equal((await denied.json()).code, 'insufficient_credits');
});
