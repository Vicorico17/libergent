import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';

// Stateful REST boundary: real Worker routes, matching and scheduling; no remote I/O.
function fixture(t, extraEnv = {}) {
  const env = { SUPABASE_URL: 'https://supabase.example', SUPABASE_SECRET_KEY: 'test-secret', LIBERGENT_ADMIN_TOKEN: 'admin-test', LIBERGENT_MOCK_SEARCH: '1', ...extraEnv };
  const savedEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
    Object.assign(process.env, savedEnv);
  });
  const db = { alert_profiles: [], alert_events: [], alert_listing_state: [], notification_deliveries: [], alert_email_outbox: [] };
  const entitlements = { a: { plan: 'premium', status: 'active' }, b: { plan: 'premium', status: 'active' }, free: null };
  const mail = [];
  let mailStatus = 200;
  let mailThrows = false;
  let missingReceipt = false;
  let failStateRead = false;
  let serial = 0;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.href === env.ALERT_EMAIL_WEBHOOK_URL) {
      mail.push(JSON.parse(init.body));
      if (mailThrows) throw new Error("Simulated network timeout");
      if (missingReceipt) return Response.json({});
      return Response.json(mailStatus === 200 ? { id: 'receipt-1' } : { error: 'Test provider rejection' }, { status: mailStatus });
    }
    assert.equal(url.origin, env.SUPABASE_URL, 'Unexpected external request');
    if (url.pathname === '/auth/v1/user') {
      const id = new Headers(init.headers).get('authorization').replace('Bearer ', '');
      return Response.json({ id, email: `${id}@example.test` });
    }
    const table = url.pathname.replace('/rest/v1/', '');
    if (table === 'discovery_probe_state') return Response.json([]);
    if (table === 'alert_listing_state' && failStateRead) { failStateRead = false; return Response.json({ error: 'unavailable' }, { status: 503 }); }
    if (table === 'rpc/commit_alert_scan') {
      const { p_id, p_token, p_states, p_events, p_sources } = JSON.parse(init.body);
      const profile = db.alert_profiles.find(row => row.id === p_id);
      assert.equal(profile.lease_token, p_token);
      const inserted = [];
      if (profile.last_checked_at) for (const event of p_events) {
        if (!profile.baseline_sources.includes(event.payload.source) || db.alert_events.some(row => row.event_key === event.eventKey)) continue;
        const row = { id: `event-${++serial}`, alert_id: profile.id, user_id: profile.user_id, event_key: event.eventKey, event_type: event.type, listing_url: event.listingUrl, payload: event.payload };
        db.alert_events.push(row); inserted.push(row);
      }
      for (const item of p_states) {
        const old = db.alert_listing_state.find(row => row.alert_id === p_id && row.listing_url === item.url);
        const state = { alert_id: p_id, listing_url: item.url, latest_price_ron: item.priceRon, snapshot: item };
        if (old) Object.assign(old, state); else db.alert_listing_state.push(state);
      }
      const batches = profile.frequency === 'daily' ? [inserted] : inserted.map(event => [event]);
      for (const events of batches) if (events.length) db.alert_email_outbox.push({ id: `batch-${++serial}`, alert_id: p_id, user_id: profile.user_id, email: profile.email, query: profile.query, events, status: 'queued', attempts: 0 });
      Object.assign(profile, { baseline_sources: [...new Set([...profile.baseline_sources, ...p_sources])], last_checked_at: new Date().toISOString(), next_check_at: new Date(Date.now() + (profile.frequency === 'daily' ? 86400000 : 3600000)).toISOString(), lease_until: '2000-01-01', lease_token: null });
      return Response.json(inserted.length);
    }
    if (table === 'rpc/claim_alert_emails') {
      const batches = db.alert_email_outbox.filter(row => row.status === 'queued');
      batches.forEach(row => { row.status = 'sending'; row.attempts++; });
      return Response.json(batches);
    }
    const matches = row => [...url.searchParams].every(([key, value]) => {
      if (value.startsWith('eq.')) return String(row[key]) === value.slice(3);
      if (value.startsWith('lt.')) return row[key] < value.slice(3);
      if (value.startsWith('lte.')) return row[key] <= value.slice(4);
      return true;
    });
    if (table === 'user_entitlements') {
      const id = url.searchParams.get('user_id').slice(3);
      return Response.json(entitlements[id] ? [entitlements[id]] : []);
    }
    assert.ok(table in db, `Unexpected REST table ${table}`);
    const method = init.method || 'GET';
    if (method === 'GET') return Response.json(db[table].filter(matches));
    if (method === 'PATCH') {
      const rows = db[table].filter(matches);
      rows.forEach(row => Object.assign(row, JSON.parse(init.body)));
      return Response.json(rows);
    }
    if (method === 'DELETE') {
      db[table] = db[table].filter(row => !matches(row));
      return new Response(null, { status: 204 });
    }
    assert.equal(method, 'POST');
    const body = JSON.parse(init.body);
    const inserted = [];
    for (const row of Array.isArray(body) ? body : [body]) {
      if (table === 'alert_events' && db[table].some(old => old.event_key === row.event_key)) continue;
      const old = table === 'alert_listing_state' && db[table].find(old => old.alert_id === row.alert_id && old.listing_url === row.listing_url);
      if (old) Object.assign(old, row);
      else {
        const stored = { id: `row-${++serial}`, baseline_sources: [], lease_until: '2000-01-01', ...row };
        db[table].push(stored);
        inserted.push(stored);
      }
    }
    return Response.json(inserted);
  };
  const request = (path, method = 'GET', body, user = 'a') => worker.fetch(new Request(`https://libergent.test${path}`, {
    method, headers: { authorization: `Bearer ${user}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  }), env);
  const create = async (body = {}) => {
    const response = await request('/api/alerts', 'POST', { query: 'BMW 320d', ...body });
    assert.equal(response.status, 201);
    return (await response.json()).alert;
  };
  const run = async () => {
    const response = await request('/api/admin/alerts/run', 'POST', undefined, 'admin-test');
    assert.equal(response.status, 200);
    return response.json();
  };
  const due = () => db.alert_profiles.forEach(row => { row.next_check_at = '2000-01-01T00:00:00.000Z'; });
  return { db, env, entitlements, mail, request, create, run, due, rejectMail: () => { mailStatus = 422; }, failState: () => { failStateRead = true; }, timeoutMail: () => { mailThrows = true; }, noReceipt: () => { missingReceipt = true; } };
}

test('alert access requires an account, allows Free creation; manual runs require admin', async t => {
  const f = fixture(t);
  assert.equal((await worker.fetch(new Request('https://libergent.test/api/alerts'), f.env)).status, 401);
  assert.equal((await f.request('/api/alerts', 'POST', { query: 'BMW' }, 'free')).status, 201);
  assert.equal((await f.request('/api/admin/alerts/run', 'POST')).status, 401);
  assert.equal(f.db.alert_profiles.length, 1);
});

test('structured creation, five-active limit, pause/resume and owner isolation', async t => {
  const f = fixture(t);
  const first = await f.create({ criteria: { priceMaxRon: '150000', yearFrom: 2018, mileageMaxKm: 180000, location: 'Cluj' } });
  assert.equal(first.criteria.priceMaxRon, 150000);
  assert.equal(first.user_id, 'a');
  assert.equal(first.email, 'a@example.test');
  for (let i = 0; i < 4; i++) await f.create();
  assert.equal((await f.request('/api/alerts', 'POST', { query: 'BMW' })).status, 409);
  const paused = await f.create({ status: 'paused' });
  assert.equal((await f.request(`/api/alerts/${paused.id}`, 'PATCH', { status: 'active' })).status, 409);
  assert.equal((await f.request(`/api/alerts/${first.id}`, 'PATCH', { status: 'active' })).status, 200);
  assert.equal((await f.request(`/api/alerts/${first.id}`, 'PATCH', { status: 'paused' }, 'b')).status, 404);
  await f.request(`/api/alerts/${first.id}`, 'DELETE', undefined, 'b');
  assert.equal(f.db.alert_profiles.length, 6);
  assert.deepEqual((await (await f.request('/api/alerts', 'GET', undefined, 'b')).json()).alerts, []);
  assert.equal((await f.request(`/api/alerts/${first.id}`, 'PATCH', { status: 'paused' })).status, 200);
  assert.equal((await f.request(`/api/alerts/${paused.id}`, 'PATCH', { status: 'active' })).status, 200);
  await f.request(`/api/alerts/${first.id}`, 'DELETE');
  assert.equal(f.db.alert_profiles.some(row => row.id === first.id), false);
});

for (const frequency of ['immediate', 'daily']) {
  for (const mode of ['inbox', 'email', 'failed-email']) {
    test(`${frequency} lifecycle: baseline, price drop, replay, inbox ownership (${mode})`, async t => {
      const f = fixture(t, mode === 'inbox' ? {} : { ALERT_EMAIL_WEBHOOK_URL: 'https://mail.example/send' });
      if (mode === 'failed-email') f.rejectMail();
      await f.create({ frequency });
      const baseline = await f.run();
      assert.equal(baseline.results[0].status, 'checked');
      assert.ok(f.db.alert_listing_state.length > 0);
      assert.equal(f.db.alert_events.length, 0);
      assert.equal(f.mail.length, 0);
      assert.equal((await f.run()).checked, 0, 'not due yet');
      for (const row of f.db.alert_listing_state) row.latest_price_ron += 2000;
      f.due();
      const scan = await f.run();
      assert.ok(scan.results[0].events > 0);
      const count = f.db.alert_events.length;
      assert.ok(f.db.alert_events.every(row => row.event_type === 'price_drop' && row.user_id === 'a'));
      assert.equal(f.db.alert_email_outbox.length, frequency === 'daily' ? 1 : count);
      assert.ok(f.db.alert_email_outbox.every(row => row.status === (mode === 'inbox' ? 'skipped' : mode === 'email' ? 'sent' : 'failed')));
      assert.equal(f.mail.length, mode === 'inbox' ? 0 : frequency === 'daily' ? 1 : count);
      assert.ok(f.mail.every(message => message.to === 'a@example.test'));
      if (mode === 'failed-email') assert.ok(f.db.alert_email_outbox.every(row => row.error.includes('422')));
      const event = f.db.alert_events[0];
      assert.equal((await (await f.request('/api/alerts/events', 'GET', undefined, 'b')).json()).events.length, 0);
      await f.request(`/api/alerts/events/${event.id}`, 'PATCH', {}, 'b');
      assert.equal(event.read_at, undefined);
      await f.request(`/api/alerts/events/${event.id}`, 'PATCH', {});
      assert.ok(event.read_at);
      assert.equal((await (await f.request('/api/alerts/events')).json()).events.length, count);
      // Replay the same price drop, even if the stored prior price is stale.
      for (const row of f.db.alert_listing_state) row.latest_price_ron += 2000;
      f.due();
      await f.run();
      assert.equal(f.db.alert_events.length, count);
      assert.equal(f.db.alert_email_outbox.length, frequency === 'daily' ? 1 : count);
      const delay = Date.parse(f.db.alert_profiles[0].next_check_at) - Date.parse(f.db.alert_profiles[0].last_checked_at);
      assert.ok(Math.abs(delay - (frequency === 'daily' ? 86400000 : 3600000)) < 1000);
      await f.request(`/api/alerts/${f.db.alert_profiles[0].id}`, 'PATCH', { status: 'paused' });
      f.due();
      assert.equal((await f.run()).checked, 0);
    });
  }
}

test('Free accounts retain alerts after subscription expiry', async t => {
  const f = fixture(t);
  await f.create();
  f.entitlements.a = { plan: 'premium', status: 'past_due' };
  assert.equal((await f.request('/api/alerts')).status, 200);
  assert.equal((await f.run()).results[0].status, 'checked');
  assert.equal(f.db.alert_profiles[0].status, 'active');
});


test('failed first scan retains an unset baseline; recovered scan stays silent', async t => {
  const f = fixture(t);
  await f.create();
  f.failState();
  assert.equal((await f.run()).results[0].status, 'failed');
  assert.equal(f.db.alert_profiles[0].last_checked_at, undefined);
  f.due();
  assert.equal((await f.run()).results[0].status, 'checked');
  assert.equal(f.db.alert_events.length, 0);
});

for (const failure of ['timeoutMail', 'noReceipt']) test(`email ${failure} preserves inbox and records unknown without resend`, async t => {
  const f = fixture(t, { ALERT_EMAIL_WEBHOOK_URL: 'https://mail.example/send' });
  await f.create(); await f.run();
  for (const row of f.db.alert_listing_state) row.latest_price_ron += 2000;
  f[failure](); f.due(); await f.run();
  assert.ok(f.db.alert_events.length > 0);
  assert.equal(f.db.alert_email_outbox[0].status, 'unknown');
  const sent = f.mail.length;
  f.due(); await f.run();
  assert.equal(f.mail.length, sent);
});

test('generic product alert detects new matching products and cron runs at minute 15', async t => {
  const f = fixture(t);
  await f.create({ query: 'iphone 15', events: { newProducts: true } });
  const scheduled = async minute => {
    const work = [];
    await worker.scheduled({ scheduledTime: Date.UTC(2026, 10, 11, 12, minute) }, f.env, { waitUntil: promise => work.push(promise) });
    await Promise.all(work);
  };
  await scheduled(10);
  assert.equal(f.db.alert_listing_state.length, 0);
  await scheduled(15);
  assert.ok(f.db.alert_listing_state.length > 0);
  assert.equal(f.db.alert_events.length, 0);
  // One product was not in the initial inventory.
  f.db.alert_listing_state.shift(); f.due(); await f.run();
  assert.ok(f.db.alert_events.some(row => row.event_type === 'new_match'));
  assert.ok(f.db.alert_listing_state.some(row => !row.listing_url.includes('autovit')));
});
