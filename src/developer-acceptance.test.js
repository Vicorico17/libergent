import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { checkDeveloperAcceptance, AcceptanceError } from './developer-acceptance.js';
import { IntegrationGateway } from './integration.js';
import worker from './worker.js';

const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
const keyId = '33333333-3333-4333-8333-333333333333';
const secret = `lg_test_${'a'.repeat(32)}.${'b'.repeat(64)}`;
const options = { origin: 'https://staging.test', sessionToken: 'first-session', secondSessionToken: 'second-session' };

test('acceptance checker exercises real Worker, PostgreSQL ownership and gateway flows for two accounts', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
      create table auth.users(id uuid primary key, email_confirmed_at timestamptz, banned_until timestamptz);
      insert into auth.users values('${first}',now(),null),('${second}',now(),null);`);
    await db.exec(await readFile(new URL('../supabase/developer-api.sql', import.meta.url), 'utf8'));
    const gateways = new Map();
    const env = { LIBERGENT_INTEGRATIONS_ENABLED: '1', LIBERGENT_DEVELOPER_API_ENABLED: '1', SUPABASE_URL: 'https://db.test', SUPABASE_SECRET_KEY: 'sb_secret_test' };
    env.INTEGRATION_GATEWAY = { idFromName: name => name, get: id => {
      if (!gateways.has(id)) {
        const values = new Map();
        const storage = { get: async key => values.get(key), put: async (key, value) => values.set(key, value), list: async ({ prefix }) => new Map([...values].filter(([key]) => key.startsWith(prefix))), delete: async keys => { for (const key of Array.isArray(keys) ? keys : [keys]) values.delete(key); }, transaction: async fn => fn(storage) };
        const gateway = new IntegrationGateway({ storage }, env);
        gateway.search = () => { throw Error('Acceptance must never use live search'); };
        gateways.set(id, gateway);
      }
      return gateways.get(id);
    } };
    t.mock.method(globalThis, 'fetch', async (input, init) => {
      const url = new URL(input);
      assert.equal(url.origin, 'https://db.test', 'Only local database fixture calls allowed');
      if (url.pathname === '/auth/v1/user') {
        const owner = init.headers.authorization === 'Bearer first-session' ? first : init.headers.authorization === 'Bearer second-session' ? second : null;
        return owner ? Response.json({ id: owner, email_confirmed_at: '2026-01-01T00:00:00Z' }) : Response.json({}, { status: 401 });
      }
      if (url.pathname === '/rest/v1/developer_api_keys') {
        const owner = url.searchParams.get('owner_id').slice(3);
        return Response.json((await db.query('select id,name,prefix,mode,scopes,created_at,expires_at,revoked_at from developer_api_keys where owner_id=$1', [owner])).rows);
      }
      const body = JSON.parse(init.body);
      switch (url.pathname.split('/').at(-1)) {
        case 'create_developer_key': return Response.json((await db.query('select * from create_developer_key($1,$2,$3,$4,$5,$6,$7)', [body.p_owner, body.p_id, body.p_name, body.p_mode, body.p_scopes, body.p_prefix, body.p_hash])).rows);
        case 'lookup_developer_key': return Response.json((await db.query('select * from lookup_developer_key($1)', [body.p_hash])).rows);
        case 'revoke_developer_key': return Response.json((await db.query('select revoke_developer_key($1,$2) as revoked', [body.p_owner, body.p_id])).rows[0].revoked);
        default: throw Error('Unexpected database request');
      }
    });
    const report = await checkDeveloperAcceptance({ ...options, fetcher: (url, init) => worker.fetch(new Request(url, init), env) });
    assert.equal(report.accountIsolation, 'passed');
    assert.ok(report.passed.includes('two-account isolation'));
    const rows = (await db.query('select mode,revoked_at from developer_api_keys')).rows;
    assert.equal(rows.length, 1); assert.equal(rows[0].mode, 'test'); assert.ok(rows[0].revoked_at);
  } finally { await db.close(); }
});

function fixture(overrides = {}) {
  let deletions = 0;
  let calls = 0;
  const fetcher = async (input, init) => {
    calls++;
    assert.equal(init.redirect, 'error');
    assert.equal(new URL(input).origin, options.origin);
    const path = new URL(input).pathname;
    if (path === '/api/developer/config') return Response.json({ available: true });
    if (path.endsWith('/' + keyId) && init.method === 'DELETE') {
      deletions++;
      return overrides.cleanup ? overrides.cleanup() : Response.json({ revoked: true });
    }
    if (path === '/api/developer/keys' && init.method === 'POST') return overrides.create ? overrides.create() : Response.json({ key: { id: keyId }, token: secret }, { status: 201 });
    if (path === '/api/developer/keys') return overrides.list ? overrides.list() : Response.json({ keys: [{ id: keyId }] });
    if (path === '/api/developer/usage') return Response.json({ usage: { test: { dayRequests: 0 } } });
    throw Error(`Unexpected fixture: ${secret}`);
  };
  return { fetcher, get deletions() { return deletions; }, get calls() { return calls; } };
}

test('invalid target or missing account cannot send credentials or create keys', async () => {
  const fake = fixture();
  for (const change of [{ origin: 'http://external.test' }, { origin: 'https://user:password@staging.test' }, { origin: 'https://staging.test/private' }, { sessionToken: '' }, { secondSessionToken: 'first-session' }]) {
    await assert.rejects(checkDeveloperAcceptance({ ...options, ...change, fetcher: fake.fetcher }), AcceptanceError);
  }
  assert.equal(fake.calls, 0);
});

test('failed checks revoke the temporary key and sanitize malformed response details', async () => {
  const fake = fixture({ list: () => new Response(`invalid response containing ${secret}`) });
  await assert.rejects(checkDeveloperAcceptance({ ...options, secondSessionToken: undefined, fetcher: fake.fetcher }), error => {
    assert.equal(error.message, 'List keys: target returned invalid JSON.');
    assert.ok(!error.message.includes(secret)); return true;
  });
  assert.equal(fake.deletions, 1);
});

test('network errors never reveal credentials; failed cleanup gives a manual recovery instruction', async () => {
  const fake = fixture({ list: () => { throw Error(secret); }, cleanup: () => new Response('', { status: 503 }) });
  await assert.rejects(checkDeveloperAcceptance({ ...options, secondSessionToken: undefined, fetcher: fake.fetcher }), error => {
    assert.match(error.message, /Cleanup failed: revoke the most recent acceptance-\* key/);
    assert.ok(!error.message.includes(secret)); return true;
  });
  assert.equal(fake.deletions, 1);
});

test('a malformed creation receipt cannot turn cleanup into an arbitrary request', async () => {
  const fake = fixture({ create: () => Response.json({ key: { id: '../../private' }, token: secret }, { status: 201 }) });
  await assert.rejects(checkDeveloperAcceptance({ ...options, fetcher: fake.fetcher }), /no valid key ID/);
  assert.equal(fake.deletions, 0);
});
