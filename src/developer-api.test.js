import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { authenticateDeveloper, handleDeveloper, validateKeyInput } from './developer-api.js';
import { authenticateIntegration, keyHash, parseIntegrationQuery, IntegrationGateway, buildSandboxSearch, handleIntegration } from './integration.js';
import { lookupDeveloperKey, developerDb, publicKeyMetadata } from './developer-store.js';
import { OPENAPI } from './developer-reference.js';
import worker from './worker.js';

const owner = '11111111-1111-4111-8111-111111111111';
const stranger = '22222222-2222-4222-8222-222222222222';
const env = { LIBERGENT_DEVELOPER_API_ENABLED: '1', LIBERGENT_INTEGRATIONS_ENABLED: '1', SUPABASE_URL: 'https://db.test', SUPABASE_SECRET_KEY: 'sb_secret_test', INTEGRATION_GATEWAY: {} };
const req = (path = '/api/developer/keys', method = 'GET', body) => new Request(`https://api.test${path}`, { method, headers: { authorization: 'Bearer session', 'content-type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const auth = async () => ({ user: { id: owner } });

test('management requires a verified non-anonymous account and fails closed on auth outages', async t => {
  assert.equal((await authenticateDeveloper(new Request('https://api.test'), env)).response.status, 401);
  for (const [user, status] of [[{ id: owner },403], [{ id: owner, email_confirmed_at: 'today', is_anonymous: true },403], [{ id: 'invalid', email_confirmed_at: 'today' },401], [{ id: owner, email_confirmed_at: 'today' },200]]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(user));
    const result = await authenticateDeveloper(req(), env);
    assert.equal(result.response?.status || 200, status); t.mock.restoreAll();
  }
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }));
  assert.equal((await authenticateDeveloper(req(), env)).response.status, 503);
  assert.equal((await handleDeveloper(req(), {})).status, 503);
});
test('key input rejects privilege, quota and owner overrides', () => {
  for (const input of [null, [], { name: '' }, { name: 'test', owner_id: stranger }, { name: 'test', perDay: 9999 }, { name: 'test', mode: 'premium' }, { name: 'test', scopes: ['admin'] }, { name: 'test', scopes: 'search:read' }]) assert.throws(() => validateKeyInput(input));
  assert.deepEqual(validateKeyInput({ name: ' App ' }), { name: 'App', mode: 'test', scopes: ['search:read'] });
});
test('creation shows token once, sends only its hash to DB and strips hashes from metadata', async () => {
  let created;
  const db = async (path, init) => {
    created = init.body; assert.equal(path, 'rpc/create_developer_key');
    return [{ id: created.p_id, name: created.p_name, mode: created.p_mode, prefix: created.p_prefix, scopes: created.p_scopes, key_hash: created.p_hash, owner_id: owner }];
  };
  const response = await handleDeveloper(req(undefined, 'POST', { name: 'My app' }), env, { authenticate: auth, db });
  assert.equal(response.status, 201); assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json(); assert.match(body.token, /^lg_test_[a-f0-9]{32}\.[a-f0-9]{64}$/);
  assert.equal(await keyHash(body.token), created.p_hash); assert.equal(created.p_owner, owner);
  assert.equal(body.key.key_hash, undefined); assert.equal(body.key.owner_id, undefined);
  assert.ok(!JSON.stringify(created).includes(body.token));
  const listed = publicKeyMetadata({ ...body.key, key_hash: created.p_hash }); assert.ok(!JSON.stringify(listed).includes(created.p_hash));
});
test('ownership cannot be selected by request and revoke is owner-scoped', async () => {
  let seen;
  const db = async (path, init) => { seen = { path, init }; return path.startsWith('rpc/') ? false : []; };
  await handleDeveloper(req('/api/developer/keys?owner_id=' + stranger), env, { authenticate: auth, db });
  assert.ok(seen.path.includes('owner_id=eq.' + owner)); assert.ok(!seen.path.includes(stranger));
  const result = await handleDeveloper(req('/api/developer/keys/' + stranger, 'DELETE'), env, { authenticate: auth, db });
  assert.equal(result.status, 404); assert.deepEqual(seen.init.body, { p_owner: owner, p_id: stranger });
});
test('management maps quota errors, rejects huge/malformed bodies and fails closed without durable storage', async () => {
  assert.equal((await handleDeveloper(req(undefined, 'POST', { name: 'app' }), { ...env, INTEGRATION_GATEWAY: undefined }, { authenticate: auth })).status, 503);
  const response = await handleDeveloper(req(undefined, 'POST', { name: 'app' }), env, { authenticate: auth, db: async () => { throw Error('api_key_limit'); } });
  assert.equal(response.status, 429);
  assert.equal((await handleDeveloper(req(undefined, 'POST', { name: 'x'.repeat(5000) }), env, { authenticate: auth })).status, 400);
});
test('database lookup uses hash, honors SQL rejection, and has bounded credentials-only server requests', async t => {
  const token = 'lg_live_12345678.' + 'b'.repeat(64);
  let seen;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    seen = { url, options };
    return Response.json([{ owner_id: owner, mode: 'live', scopes: ['search:read'], expires_at: '2099-01-01' }]);
  });
  const authResult = await authenticateIntegration(new Request('https://api.test/api/v1/search?q=iphone', { headers: { authorization: 'Bearer ' + token } }), env);
  assert.equal(authResult.config.id, `dev_${owner}_live`); assert.equal(authResult.config.perDay, 200);
  assert.equal(seen.options.headers.apikey, 'sb_secret_test'); assert.equal(seen.options.headers.authorization, undefined);
  assert.equal(JSON.parse(seen.options.body).p_hash, await keyHash(token)); assert.ok(!seen.options.body.includes(token));
  assert.ok(seen.options.signal);
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async () => Response.json([]));
  assert.equal((await authenticateIntegration(new Request('https://api.test', { headers: { authorization: 'Bearer ' + token } }), env)).response.status, 401);
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }));
  await assert.rejects(lookupDeveloperKey('hash', env), /developer_storage_unavailable/);
  await assert.rejects(developerDb('x', {}, {}), /developer_storage_unavailable/);
});
test('canonical search defaults to general products and lightweight details, legacy default unchanged', () => {
  const config = { scopes: ['search:read'], sites: ['olx.ro'] };
  const parsed = parseIntegrationQuery(new URL('https://api.test/api/v1/search?q=bicicleta'), config);
  assert.equal(parsed.category, 'any'); assert.equal(parsed.material, 'any'); assert.equal(parsed.details, false);
  assert.throws(() => parseIntegrationQuery(new URL('https://api.test/api/integrations/v1/search?q=bicicleta'), config), /insufficient_scope/);
});
test('public demo/sources/spec work without keys and never call a source; internal quota endpoint is not public', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw Error('Must not fetch'); });
  const demo = await (await worker.fetch(new Request('https://api.test/api/v1/demo'), {}, {})).json();
  assert.equal(demo.mode, 'test'); assert.equal(demo.simulated, true); assert.equal(demo.items[0].url, null);
  assert.equal((await worker.fetch(new Request('https://api.test/api/v1/sources'), {}, {})).status, 200);
  assert.equal((await worker.fetch(new Request('https://api.test/api/v1/openapi.json'), {}, {})).status, 200);
  assert.equal((await handleIntegration(new Request('https://api.test/internal/usage'), env)).status, 404);
  assert.equal(OPENAPI.openapi, '3.1.0');
  assert.ok(OPENAPI.paths['/api/v1/search'].get.security.length);
  for (const field of OPENAPI.components.schemas.SearchResponse.required) assert.ok(field in buildSandboxSearch());
  for (const field of OPENAPI.components.schemas.Listing.required) assert.ok(field in demo.items[0]);
});
test('test-mode key cannot trigger live engine; usage is tracked without consuming a request to view it', async () => {
  const token = 'lg_test_12345678.' + 'c'.repeat(64);
  const values = new Map();
  const storage = { get: async k => values.get(k), put: async (k,v) => values.set(k,v), list: async () => new Map(), delete: async () => {}, transaction: async fn => fn(storage) };
  const gateway = new IntegrationGateway({ storage }, { LIBERGENT_INTEGRATION_KEYS: JSON.stringify([{ id: 'sandbox', keyHash: await keyHash(token), mode: 'test', scopes: ['search:read'], sites: ['olx.ro'], perDay: 2, perMinute: 2, expiresAt: '2099-01-01' }]) });
  gateway.search = () => { throw Error('Live search forbidden'); };
  const response = await gateway.fetch(new Request('https://api.test/api/v1/search?q=canapea', { headers: { authorization: 'Bearer ' + token } }));
  assert.equal(response.status, 200); assert.equal((await response.json()).mode, 'test');
  const usage = await (await gateway.fetch(new Request('https://gateway.internal/internal/usage'))).json();
  assert.equal(usage.dayRequests, 1); assert.equal(values.get('usage').dayCount, 1);
});

test('real PostgreSQL migration: idempotency, RLS, ownership, quota, expiry and revocation', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
      create table auth.users(id uuid primary key, email_confirmed_at timestamptz, banned_until timestamptz);
      insert into auth.users values('${owner}',now(),null),('${stranger}',now(),null);`);
    const migration = await readFile(new URL('../supabase/developer-api.sql', import.meta.url), 'utf8');
    await db.exec(migration); await db.exec(migration);
    const create = async (id, account = owner) => db.query('select * from public.create_developer_key($1,$2,$3,$4,$5,$6,$7)', [account, id, 'app', 'live', ['search:read'], 'lg_live_test', id.replaceAll('-','').repeat(2)]);
    const id = crypto.randomUUID(); await create(id);
    assert.equal((await db.query('select * from public.lookup_developer_key($1)', [id.replaceAll('-','').repeat(2)])).rows.length, 1);
    assert.equal((await db.query('select public.revoke_developer_key($1,$2) as revoked', [stranger,id])).rows[0].revoked, false);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select key_hash from public.developer_api_keys'), /permission denied/);
    await assert.rejects(db.query('select * from public.lookup_developer_key($1)', ['a'.repeat(64)]), /permission denied/);
    await db.exec('reset role');
    for (let i=0;i<4;i++) await create(crypto.randomUUID());
    await assert.rejects(create(crypto.randomUUID()), /api_key_limit/);
    await db.query('select public.revoke_developer_key($1,$2)', [owner,id]);
    assert.equal((await db.query('select * from public.lookup_developer_key($1)', [id.replaceAll('-','').repeat(2)])).rows.length, 0);
    const next = crypto.randomUUID(); await create(next);
    await db.query("update developer_api_keys set expires_at = now() - interval '1 day' where id=$1",[next]);
    assert.equal((await db.query('select * from public.lookup_developer_key($1)', [next.replaceAll('-','').repeat(2)])).rows.length, 0);
    await db.query('update developer_accounts set disabled=true where owner_id=$1',[owner]);
    await assert.rejects(create(crypto.randomUUID()), /developer_account_disabled/);
    assert.equal((await db.query('select count(*) from developer_api_keys where owner_id=$1',[stranger])).rows[0].count, 0);
    const validHash = (await db.query('select key_hash from developer_api_keys where owner_id=$1 and revoked_at is null and expires_at>now() limit 1',[owner])).rows[0].key_hash;
    assert.equal((await db.query('select * from public.lookup_developer_key($1)',[validHash])).rows.length, 0);
    for (let i=0; i<20; i++) {
      const rotating = crypto.randomUUID(); await create(rotating, stranger);
      await db.query('select public.revoke_developer_key($1,$2)',[stranger,rotating]);
    }
    await assert.rejects(create(crypto.randomUUID(), stranger), /api_key_limit/);
  } finally { await db.close(); }
});
test('self-service end-to-end: SQL-issued test key authenticates, uses sandbox and is rejected immediately after revocation', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
      create table auth.users(id uuid primary key, email_confirmed_at timestamptz, banned_until timestamptz);
      insert into auth.users values('${owner}',now(),null);`);
    await db.exec(await readFile(new URL('../supabase/developer-api.sql', import.meta.url), 'utf8'));
    const gateways = new Map();
    const testEnv = { ...env, INTEGRATION_GATEWAY: { idFromName: name => name, get: id => {
      if (!gateways.has(id)) {
        const values = new Map();
        const storage = { get: async k => values.get(k), put: async (k,v) => values.set(k,v), list: async ({prefix}) => new Map([...values].filter(([k])=>k.startsWith(prefix))), delete: async keys => { for (const k of Array.isArray(keys)?keys:[keys]) values.delete(k); }, transaction: async fn => fn(storage) };
        gateways.set(id, new IntegrationGateway({ storage }, testEnv));
      }
      return gateways.get(id);
    } } };
    t.mock.method(globalThis, 'fetch', async (url, init) => {
      assert.ok(String(url).startsWith('https://db.test/'), 'No marketplace request allowed');
      if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: owner, email_confirmed_at: new Date().toISOString() });
      const body = JSON.parse(init.body);
      const rpc = String(url).split('/').at(-1);
      let result;
      if (rpc === 'create_developer_key') result = (await db.query('select * from create_developer_key($1,$2,$3,$4,$5,$6,$7)', [body.p_owner,body.p_id,body.p_name,body.p_mode,body.p_scopes,body.p_prefix,body.p_hash])).rows;
      else if (rpc === 'lookup_developer_key') result = (await db.query('select * from lookup_developer_key($1)', [body.p_hash])).rows;
      else if (rpc === 'revoke_developer_key') result = (await db.query('select revoke_developer_key($1,$2) as revoked', [body.p_owner,body.p_id])).rows[0].revoked;
      else throw Error('Unexpected REST operation');
      return Response.json(result);
    });
    const created = await (await handleDeveloper(req(undefined,'POST',{name:'My app'}),testEnv)).json();
    assert.ok(created.token);
    const searchRequest = new Request('https://api.test/api/v1/search?q=bicicleta', { headers: { authorization: `Bearer ${created.token}` } });
    const search = await handleIntegration(searchRequest, testEnv);
    assert.equal(search.status, 200); assert.equal((await search.json()).mode, 'test');
    assert.equal((await handleDeveloper(req('/api/developer/keys/'+created.key.id,'DELETE'),testEnv)).status, 200);
    assert.equal((await handleIntegration(searchRequest, testEnv)).status, 401);
  } finally { await db.close(); }
});
