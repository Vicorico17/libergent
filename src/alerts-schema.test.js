import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const owner = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const token = '00000000-0000-4000-8000-000000000003';
async function setup(t) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec("create role anon; create role authenticated; create role service_role; create function unaccent(text) returns text language sql immutable as 'select $1';");
  // PGlite has gen_random_uuid built in; unrelated search text extension is stubbed.
  const sql = (await readFile(new URL('../supabase/search_tracking.sql', import.meta.url), 'utf8')).replace(/^create extension.*;$/gm, '');
  await db.exec(sql);
  const create = async (user = owner, status = 'active') => (await db.query("insert into alert_profiles(user_id,email,query,status) values($1,'test@example.test','iphone 15',$2) returning *", [user, status])).rows[0];
  const lease = async id => db.query("update alert_profiles set lease_token=$2,lease_until=now()+interval '2 minutes' where id=$1", [id, token]);
  const commit = async (id, states = [], events = [], sources = ['olx.ro']) => (await db.query('select commit_alert_scan($1,$2,$3,$4,$5) as count', [id, token, JSON.stringify(states), JSON.stringify(events), sources])).rows[0].count;
  return { db, sql, create, lease, commit };
}

const item = { url: 'https://olx.ro/test', priceRon: 2000, site: 'olx.ro', title: 'iPhone 15' };
const event = { type: 'new_match', eventKey: 'event-1', listingUrl: item.url, payload: { title: item.title, source: item.site, priceRon: 2000 } };

test('SQL quota covers creation, resume, many paused profiles, independent accounts and migration replay', async t => {
  const { db, sql, create } = await setup(t);
  const active = [];
  for (let i = 0; i < 5; i++) active.push(await create());
  await assert.rejects(create(), /Maximum 5/);
  const paused = await create(owner, 'paused');
  for (let i = 0; i < 105; i++) await create(owner, 'paused');
  await assert.rejects(db.query("update alert_profiles set status='active' where id=$1", [paused.id]), /Maximum 5/);
  await db.query("update alert_profiles set status='paused' where id=$1", [active[0].id]);
  await db.query("update alert_profiles set status='active' where id=$1", [paused.id]);
  await create(other);
  await db.exec(sql);
  await assert.rejects(create(), /Maximum 5/);
  assert.equal((await db.query("select count(*)::int n from alert_profiles where user_id=$1 and status='active'", [owner])).rows[0].n, 5);
});

test('SQL commits baseline, events and email atomically; source recovery, deduplication and stale leases', async t => {
  const { db, create, lease, commit } = await setup(t);
  const profile = await create();
  await lease(profile.id);
  assert.equal(await commit(profile.id, [item], [event]), 0);
  assert.equal((await db.query('select count(*)::int n from alert_email_outbox')).rows[0].n, 0);
  await lease(profile.id);
  const recovered = { ...event, eventKey: 'recovered-source', payload: { ...event.payload, source: 'okazii.ro' } };
  assert.equal(await commit(profile.id, [item], [event, recovered], ['olx.ro', 'okazii.ro']), 1);
  assert.equal((await db.query('select count(*)::int n from alert_events')).rows[0].n, 1);
  assert.equal((await db.query('select count(*)::int n from alert_email_outbox')).rows[0].n, 1);
  await assert.rejects(commit(profile.id, [], []), /lease expired/);
  await lease(profile.id);
  assert.equal(await commit(profile.id, [item], [event]), 0);
  await lease(profile.id);
  // A bad state must roll back the event and its queued email as well.
  await assert.rejects(commit(profile.id, [{ ...item, priceRon: 'invalid' }], [{ ...event, eventKey: 'rollback' }]), /numeric/);
  assert.equal((await db.query("select count(*)::int n from alert_events where event_key='rollback'")).rows[0].n, 0);
  await db.query("update alert_profiles set status='paused' where id=$1", [profile.id]);
  await assert.rejects(commit(profile.id), /lease expired/);
});

test('SQL outbox claims once, bounds explicit retries, preserves unknown outcomes and honors pause/delete', async t => {
  const { db, create, lease, commit } = await setup(t);
  const profile = await create();
  await lease(profile.id); await commit(profile.id, [item]);
  await lease(profile.id); await commit(profile.id, [item], [event]);
  const claim = () => db.query('select * from claim_alert_emails(20)');
  await db.query("update alert_profiles set status='paused' where id=$1", [profile.id]);
  assert.equal((await claim()).rows.length, 0);
  await db.query("update alert_profiles set status='active' where id=$1", [profile.id]);
  assert.equal((await claim()).rows.length, 1);
  assert.equal((await claim()).rows.length, 0);
  await db.exec("update alert_email_outbox set status='failed';");
  assert.equal((await claim()).rows[0].attempts, 2);
  await db.exec("update alert_email_outbox set status='failed';");
  assert.equal((await claim()).rows[0].attempts, 3);
  await db.exec("update alert_email_outbox set status='failed';");
  assert.equal((await claim()).rows.length, 0);
  await db.exec("update alert_email_outbox set status='sending',attempted_at=now()-interval '10 minutes';");
  assert.equal((await claim()).rows.length, 0);
  assert.equal((await db.query('select status from alert_email_outbox')).rows[0].status, 'unknown');
  await db.query('delete from alert_profiles where id=$1', [profile.id]);
  for (const table of ['alert_events', 'alert_email_outbox', 'alert_listing_state']) assert.equal((await db.query(`select count(*)::int n from ${table}`)).rows[0].n, 0);
  for (const role of ['anon', 'authenticated']) {
    assert.equal((await db.query("select has_table_privilege($1,'alert_email_outbox','SELECT') allowed", [role])).rows[0].allowed, false);
    assert.equal((await db.query("select has_function_privilege($1,'commit_alert_scan(uuid,uuid,jsonb,jsonb,text[])','EXECUTE') allowed", [role])).rows[0].allowed, false);
    assert.equal((await db.query("select has_function_privilege($1,'claim_alert_emails(integer)','EXECUTE') allowed", [role])).rows[0].allowed, false);
  }
});
