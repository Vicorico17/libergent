import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSelling, normalizeSellingListing, publishOlx, safeOlxUrl, olxPublicationReceipt } from './selling.js';
import { seal, unseal, digest } from './selling-store.js';
import { olxPayload, okaziiFeed, olxRequest, olxAuthorizeUrl } from './selling-providers.js';

const userId = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const env = { SUPABASE_URL: 'https://db.example.test', SUPABASE_SERVICE_ROLE_KEY: 'service-test', SELLING_ENCRYPTION_KEY: 'a'.repeat(64), OLX_CLIENT_ID: 'client-test', OLX_CLIENT_SECRET: 'secret-test', SELLING_PUBLIC_URL: 'https://libergent.test' };
const listing = { title: 'Telefon de vânzare', description: 'Telefon în stare bună, fără defecte ascunse.', price: 200, location: 'București', category: 'Electronice', condition: 'Folosit', images: [], contactName: 'Test', phone: '', olx: { categoryId: 12, cityId: 34, attributes: [{ code: 'state', value: 'used' }] } };
const auth = async () => ({ user: { id: userId } });
const request = (path, body, method = body ? 'POST' : 'GET') => new Request(`https://libergent.test/api/selling${path}`, { method, ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}) });
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function mockDatabase(t, options = {}) {
  const jobs = []; const drafts = [{ id, user_id: userId, listing }]; const sent = []; const reads = [];
  const realFetch = globalThis.fetch; t.after(() => { globalThis.fetch = realFetch; });
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input); const method = init.method || 'GET'; const body = init.body ? JSON.parse(init.body) : undefined;
    if (url.hostname === 'www.olx.ro') {
      if (method === 'GET') {
        reads.push(url);
        if (options.beforeRead) options.beforeRead(jobs);
        return reply({ data: url.pathname.endsWith('/adverts') ? options.lookup ?? [] : options.single ?? { id: 123, status: options.providerStatus || 'active' } });
      }
      if (url.pathname.endsWith('/adverts')) {
        sent.push(body);
        if (options.timeout) throw new Error('timeout');
        if (options.reject) return reply({ error: { validation: [{ field: 'title', detail: 'too short' }] } }, 400);
        return reply({ data: { id: 123, status: options.providerStatus || 'active', url: 'https://www.olx.ro/d/oferta/test.html' } });
      }
      throw new Error(`Unexpected provider URL: ${url}`);
    }
    assert.equal(url.hostname, 'db.example.test');
    const table = url.pathname.split('/').pop();
    if (table === 'selling_connections') return reply([{ credentials: await seal({ access_token: 'user-token', expires_at: Date.now() + 3600000 }, userId, env) }]);
    if (table === 'selling_drafts') {
      if (method === 'POST') { assert.equal(body.user_id, userId); drafts[0] = { ...body }; return reply([drafts[0]]); }
      assert.equal(url.searchParams.get('user_id'), `eq.${userId}`);
      if (method === 'PATCH') Object.assign(drafts[0], body);
      return reply(drafts);
    }
    if (table === 'selling_feeds') return reply([{ user_id: userId, token: id }]);
    if (table === 'selling_publications') {
      if (method === 'POST') {
        const existing = jobs.find((job) => job.platform === body.platform);
        if (existing && init.headers.prefer.includes('ignore-duplicates')) return reply([]);
        if (existing) Object.assign(existing, body); else jobs.push({ ...body });
        return reply([existing || jobs.at(-1)]);
      }
      assert.equal(url.searchParams.get('user_id'), `eq.${userId}`);
      const found = jobs.filter((job) => !url.searchParams.get('platform') || url.searchParams.get('platform') === `eq.${job.platform}`).filter((job) => !url.searchParams.get('status') || url.searchParams.get('status') === `eq.${job.status}`);
      if (method === 'PATCH') found.forEach((job) => Object.assign(job, body));
      return reply(found);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
  return { jobs, drafts, sent, reads };
}

test('credentials are encrypted and bound to the owner', async () => {
  const encrypted = await seal({ access_token: 'secret' }, userId, env);
  assert.ok(!encrypted.includes('secret'));
  assert.deepEqual(await unseal(encrypted, userId, env), { access_token: 'secret' });
  await assert.rejects(unseal(encrypted, 'another-owner', env));
  await assert.rejects(seal({}, userId, {}));
});

test('validation accepts only owned hosted photos and rejects invalid listing data', () => {
  assert.equal(normalizeSellingListing(listing, userId, env).price, 200);
  for (const invalid of [{ price: -1 }, { price: 'NaN' }, { title: ' ' }, { description: 'short' }, { images: ['https://evil.test/image.jpg'] }, { images: [`${env.SUPABASE_URL}/storage/v1/object/public/selling-images/other/${id}.jpg`] }]) {
    assert.throws(() => normalizeSellingListing({ ...listing, ...invalid }, userId, env));
  }
  assert.equal(normalizeSellingListing({ ...listing, images: [`${env.SUPABASE_URL}/storage/v1/object/public/selling-images/${userId}/${id}.jpg`] }, userId, env).images.length, 1);
});

test('OLX payload uses user category, location, shared product and photos without buying promotions', () => {
  const payload = olxPayload(listing, id);
  assert.equal(payload.external_id, id); assert.equal(payload.category_id, 12); assert.equal(payload.location.city_id, 34);
  assert.deepEqual(payload.price, { value: 200, currency: 'RON', negotiable: false });
  assert.equal(payload.auto_extend_enabled, false); assert.deepEqual(payload.attributes, listing.olx.attributes);
  assert.throws(() => olxPayload({ ...listing, olx: {} }, id));
});

test('Okazii feed escapes XML, safely splits CDATA and keeps a stable product ID', () => {
  const xml = okaziiFeed([{ id, listing: { ...listing, title: 'A & <B>', description: 'Text ]]> <more>', images: ['https://images.test/a?b=1&c=2'] } }]);
  assert.ok(xml.includes('<TITLE>A &amp; &lt;B&gt;</TITLE>'));
  assert.ok(xml.includes(']]]]><![CDATA[>')); assert.ok(xml.includes('<UNIQUEID>' + id));
  assert.ok(xml.includes('&amp;c=2')); assert.ok(xml.includes('<REPOST>0</REPOST>'));
  assert.ok(!xml.includes('<PROMOTIONS>'));
});

test('Okazii feed reads all pages even when the database returns fewer than requested', async t => {
  const rows = [1, 2, 3].map(number => ({ id: `22222222-2222-4222-8222-${String(number).padStart(12, '0')}`, listing }));
  let pages = 0;
  t.mock.method(globalThis, 'fetch', async input => {
    const url = new URL(input);
    if (url.pathname.endsWith('/selling_feeds')) return reply([{ user_id: userId }]);
    assert.equal(url.searchParams.get('user_id'), `eq.${userId}`);
    assert.equal(url.searchParams.get('okazii_enabled'), 'eq.true');
    assert.equal(url.searchParams.get('order'), 'id.asc');
    const cursor = url.searchParams.get('id')?.slice(3) || '';
    pages++;
    return reply(rows.filter(row => row.id > cursor).slice(0, 1));
  });
  const response = await handleSelling(request(`/feeds/${id}.xml`), env, () => assert.fail('Token-scoped feed does not use account auth'));
  assert.equal(response.status, 200);
  const xml = await response.text();
  for (const row of rows) assert.ok(xml.includes(`<UNIQUEID>${row.id}</UNIQUEID>`));
  assert.equal(pages, 4);
});

test('Okazii feed fails rather than returning partial inventory on a broken later page', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async input => {
    if (new URL(input).pathname.endsWith('/selling_feeds')) return reply([{ user_id: userId }]);
    calls++;
    return calls === 1 ? reply([{ id, listing }]) : reply({ error: 'unavailable' }, 503);
  });
  const response = await handleSelling(request(`/feeds/${id}.xml`), env, auth);
  assert.equal(response.status, 503);
  assert.ok(!response.headers.get('content-type').includes('xml'));
});

test('Okazii feed rejects non-progressing pages instead of looping or duplicating inventory', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async input => {
    if (new URL(input).pathname.endsWith('/selling_feeds')) return reply([{ user_id: userId }]);
    calls++; return reply([{ id, listing }]);
  });
  assert.equal((await handleSelling(request(`/feeds/${id}.xml`), env, auth)).status, 503);
  assert.equal(calls, 2);
});

test('provider calls use the fixed OLX host, user token and required version', async (t) => {
  const real = globalThis.fetch; t.after(() => { globalThis.fetch = real; });
  globalThis.fetch = async (url, init) => { assert.equal(url, 'https://www.olx.ro/api/partner/adverts'); assert.equal(init.headers.authorization, 'Bearer token'); assert.equal(init.headers.version, '2.0'); return reply({ data: { id: 9 } }); };
  assert.deepEqual(await olxRequest('/adverts', 'token', 'POST', {}), { id: 9 });
  const url = new URL(olxAuthorizeUrl(id, env)); assert.equal(url.searchParams.get('state'), id); assert.equal(url.searchParams.get('redirect_uri'), 'https://libergent.test/api/selling/olx/callback');
  assert.equal(safeOlxUrl('javascript:alert(1)'), ''); assert.equal(safeOlxUrl('https://olx.ro.evil.test/ad'), '');
});

test('private publishing routes require authentication', async () => {
  const response = await handleSelling(request('/publish', { id, platforms: ['olx'] }), env, async () => ({ error: 'Authentication required', status: 401 }));
  assert.equal(response.status, 401);
});

test('OAuth callbacks reject missing/mismatched browser state without database access', async (t) => {
  const real = globalThis.fetch; t.after(() => { globalThis.fetch = real; });
  globalThis.fetch = () => { throw new Error('must not call external services'); };
  const response = await handleSelling(request(`/olx/callback?state=${id}&code=fake`), env, auth); assert.equal(response.status, 400);
});

test('OAuth state is consumed once and expiry is checked before token exchange', async (t) => {
  const real = globalThis.fetch; t.after(() => { globalThis.fetch = real; });
  globalThis.fetch = async (input, init) => {
    const url = new URL(input); assert.ok(url.pathname.endsWith('/selling_oauth_states')); assert.equal(init.method, 'DELETE');
    assert.equal(url.searchParams.get('state_hash'), `eq.${await digest(id)}`); assert.ok(url.searchParams.get('expires_at').startsWith('gt.')); return reply([]);
  };
  const req = new Request(`https://libergent.test/api/selling/olx/callback?state=${id}&code=fake`, { headers: { cookie: `selling_oauth=${id}` } });
  assert.equal((await handleSelling(req, env, auth)).status, 400);
});

test('repeated or concurrent publishing sends at most one OLX request', async (t) => {
  const { sent } = mockDatabase(t);
  const args = { userId, draft: { id, listing }, env };
  const results = await Promise.all([publishOlx(args), publishOlx(args)]);
  assert.equal(sent.length, 1); assert.ok(results.some((result) => result.status === 'published'));
  assert.equal((await publishOlx(args)).status, 'published'); assert.equal(sent.length, 1);
});

test('timeout stays unknown and is never retried automatically', async (t) => {
  const { sent } = mockDatabase(t, { timeout: true });
  const args = { userId, draft: { id, listing }, env };
  assert.equal((await publishOlx(args)).status, 'unknown'); assert.equal((await publishOlx(args)).status, 'unknown'); assert.equal(sent.length, 1);
});

test('definitive validation failure can be corrected and retried', async (t) => {
  const { sent } = mockDatabase(t, { reject: true });
  const args = { userId, draft: { id, listing }, env };
  const result = await publishOlx(args); assert.equal(result.status, 'failed'); assert.match(result.message, /title: too short/);
  await publishOlx(args); assert.equal(sent.length, 2);
});

test('OLX moderation/unpaid states are not reported as published', async (t) => {
  mockDatabase(t, { providerStatus: 'unpaid' });
  const result = await publishOlx({ userId, draft: { id, listing }, env }); assert.equal(result.status, 'pending'); assert.equal(result.provider_status, 'unpaid');
});

test('OLX receipts distinguish inactive and moderated adverts without enabling republishing', async t => {
  for (const status of ['removed_by_user', 'outdated', 'blocked', 'disabled']) assert.equal(olxPublicationReceipt({ id: 123, status }).status, 'inactive');
  for (const status of ['moderated', 'removed_by_moderator']) assert.equal(olxPublicationReceipt({ id: 123, status }).status, 'rejected');
  assert.equal(olxPublicationReceipt({ id: 123, status: 'future-status' }).status, 'unknown');
  for (const badId of [undefined, {}, 0, -1, 1.5, 'undefined', '1/other']) assert.throws(() => olxPublicationReceipt({ id: badId, status: 'active' }));
  assert.throws(() => olxPublicationReceipt({ id: 456, status: 'active' }, '123'));
  const { sent } = mockDatabase(t, { providerStatus: 'moderated' });
  const args = { userId, draft: { id, listing }, env };
  assert.equal((await publishOlx(args)).status, 'rejected');
  assert.equal((await publishOlx(args)).status, 'rejected');
  assert.equal(sent.length, 1);
});

test('refresh recovers an uncertain publication by exact external ID without another POST', async t => {
  const { jobs, sent, reads } = mockDatabase(t, { timeout: true, lookup: [{ id: 123, external_id: id, status: 'active' }] });
  const args = { userId, draft: { id, listing }, env };
  assert.equal((await publishOlx(args)).status, 'unknown');
  const response = await handleSelling(request('/refresh', { id }), env, auth);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).publications[0].status, 'published');
  assert.equal(reads[0].searchParams.get('external_id'), id);
  assert.equal(reads[0].searchParams.get('limit'), '2');
  assert.equal(jobs[0].provider_id, '123');
  assert.equal((await publishOlx(args)).status, 'published');
  assert.equal(sent.length, 1);
});

test('missing, multiple or mismatched recovery results never authorize another publication', async t => {
  const options = { timeout: true, lookup: [] };
  const { jobs, sent } = mockDatabase(t, options);
  for (const lookup of [[], [{ id: 123, external_id: 'other', status: 'active' }],
    [{ id: 123, external_id: id }, { id: 456, external_id: id }], { unexpected: true }]) {
    options.lookup = lookup; jobs.length = 0; sent.length = 0;
    const args = { userId, draft: { id, listing }, env };
    await publishOlx(args);
    const response = await handleSelling(request('/refresh', { id }), env, auth);
    assert.equal(response.status, Array.isArray(lookup) ? 200 : 502);
    assert.equal(jobs[0].status, 'unknown');
    await publishOlx(args);
    assert.equal(sent.length, 1);
  }
});

test('recovery cannot overwrite a receipt saved while its read was in flight', async t => {
  const { jobs } = mockDatabase(t, { timeout: true, lookup: [], beforeRead: entries => Object.assign(entries[0], { status: 'published', provider_id: '123' }) });
  await publishOlx({ userId, draft: { id, listing }, env });
  const response = await handleSelling(request('/refresh', { id }), env, auth);
  assert.equal(response.status, 200);
  assert.equal(jobs[0].status, 'published');
});

test('refresh maps a removed existing advert to inactive and rejects a mismatched receipt', async t => {
  const options = { single: { id: 123, status: 'removed_by_user' } };
  const { jobs } = mockDatabase(t, options);
  await publishOlx({ userId, draft: { id, listing }, env });
  assert.equal((await handleSelling(request('/refresh', { id }), env, auth)).status, 200);
  assert.equal(jobs[0].status, 'inactive');
  options.single = { id: 999, status: 'active' };
  assert.equal((await handleSelling(request('/refresh', { id }), env, auth)).status, 502);
  assert.equal(jobs[0].status, 'inactive');
});

test('partial failure does not prevent another platform receiving the announcement', async (t) => {
  const { jobs } = mockDatabase(t, { reject: true });
  const response = await handleSelling(request('/publish', { id, platforms: ['olx', 'okazii'] }), env, auth);
  assert.equal(response.status, 200); const { results } = await response.json();
  assert.equal(results[0].status, 'failed'); assert.equal(results[1].status, 'feed_ready'); assert.equal(jobs.length, 2);
});

test('saving after an OLX send cannot silently change the published snapshot', async (t) => {
  mockDatabase(t); await publishOlx({ userId, draft: { id, listing }, env });
  const response = await handleSelling(request('/drafts', { id, listing: { ...listing, title: 'Changed product' } }), env, auth);
  assert.equal(response.status, 409);
});

test('unsupported platforms and invalid IDs never invoke a provider', async () => {
  for (const body of [{ id, platforms: ['facebook'] }, { id: 'bad', platforms: ['olx'] }, { id, platforms: [] }]) assert.equal((await handleSelling(request('/publish', body), env, auth)).status, 400);
});

test('image upload rejects disguised files and oversize content', async () => {
  const fake = new Request('https://libergent.test/api/selling/images', { method: 'POST', headers: { 'content-type': 'image/png' }, body: '<script>not an image</script>' });
  assert.equal((await handleSelling(fake, env, auth)).status, 400);
  const huge = new Request('https://libergent.test/api/selling/images', { method: 'POST', headers: { 'content-type': 'image/png' }, body: new Uint8Array(10 * 1024 * 1024 + 1) });
  assert.equal((await handleSelling(huge, env, auth)).status, 413);
});

test('photo validation rejects URL traversal inside the owned prefix', () => {
  const prefix = `${env.SUPABASE_URL}/storage/v1/object/public/selling-images/${userId}/`;
  assert.throws(() => normalizeSellingListing({ ...listing, images: [`${prefix}${id}.jpg/../../another.jpg`] }, userId, env));
});

test('a saved draft belonging to another account is not returned', async (t) => {
  const real = globalThis.fetch; t.after(() => { globalThis.fetch = real; });
  globalThis.fetch = async (input) => { const url = new URL(input); assert.equal(url.searchParams.get('user_id'), `eq.${userId}`); assert.equal(url.searchParams.get('id'), `eq.${id}`); return reply([]); };
  assert.equal((await handleSelling(request(`/drafts/${id}`), env, auth)).status, 404);
});

test('OAuth callback stores encrypted credentials and redirects without leaking tokens', async (t) => {
  const real = globalThis.fetch; t.after(() => { globalThis.fetch = real; });
  globalThis.fetch = async (input, init) => {
    const url = new URL(input);
    if (url.pathname.endsWith('/selling_oauth_states')) return reply([{ user_id: userId }]);
    if (url.pathname.endsWith('/oauth/token')) return reply({ access_token: 'secret-access', refresh_token: 'secret-refresh', expires_in: 3600 });
    if (url.pathname.endsWith('/selling_connections')) {
      const saved = JSON.parse(init.body); assert.equal(saved.user_id, userId); assert.ok(!saved.credentials.includes('secret-access'));
      assert.equal((await unseal(saved.credentials, userId, env)).access_token, 'secret-access'); return reply([saved]);
    }
    throw new Error('Unexpected URL');
  };
  const req = new Request(`https://libergent.test/api/selling/olx/callback?state=${id}&code=test-code`, { headers: { cookie: `selling_oauth=${id}` } });
  const response = await handleSelling(req, env, auth); assert.equal(response.status, 303); assert.equal(response.headers.get('location'), 'https://libergent.test/vinde/?olx=connected'); assert.equal(await response.text(), '');
});

test('Worker dispatch exposes configuration and rejects unauthenticated publication', async () => {
  const { default: worker } = await import('./worker.js');
  const config = await worker.fetch(request('/config'), {}, {});
  assert.equal(config.status, 200); assert.deepEqual(await config.json(), { available: false, olx: false, okazii: false });
  assert.equal((await worker.fetch(request('/publish', { id, platforms: ['olx'] }), {}, {})).status, 401);
});

test('Okazii setup requires authentication and configured storage', async () => {
  assert.equal((await handleSelling(request('/okazii/connect', {}), env, async () => ({ error: 'Sign in', status: 401 }))).status, 401);
  assert.equal((await handleSelling(request('/okazii/connect', {}), {}, auth)).status, 503);
});

test('Okazii connection link is stable and does not publish any announcement', async (t) => {
  const real = globalThis.fetch; t.after(() => { globalThis.fetch = real; });
  globalThis.fetch = async (input, init) => {
    const url = new URL(input);
    assert.ok(url.pathname.endsWith('/selling_feeds'), 'setup must not touch drafts or publications');
    if (init.method === 'POST') {
      assert.equal(JSON.parse(init.body).user_id, userId);
      assert.match(init.headers.prefer, /ignore-duplicates/);
    } else assert.equal(url.searchParams.get('user_id'), `eq.${userId}`);
    return reply([{ user_id: userId, token: id }]);
  };
  const first = await handleSelling(request('/okazii/connect', {}), env, auth);
  const second = await handleSelling(request('/okazii/connect', {}), env, auth);
  assert.equal(first.status, 200);
  const payload = await first.json();
  assert.equal(payload.status, 'setup_required');
  assert.equal(payload.url, `https://libergent.test/api/selling/feeds/${id}.xml`);
  assert.deepEqual(await second.json(), payload);
});
