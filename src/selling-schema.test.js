import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('VINDE status schema upgrades existing publications without losing data or browser isolation', async t => {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
  const sql = await readFile(new URL('../supabase/selling.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  const user = '11111111-1111-4111-8111-111111111111';
  const listing = '22222222-2222-4222-8222-222222222222';
  await db.query('insert into auth.users values($1)', [user]);
  await db.query("insert into selling_drafts(user_id,id,listing) values($1,$2,'{}')", [user, listing]);
  await db.query("insert into selling_publications(user_id,listing_id,platform,status) values($1,$2,'olx','published')", [user, listing]);
  await db.exec(`alter table selling_publications drop constraint selling_publications_status_check;
    alter table selling_publications add constraint selling_publications_status_check check(status in ('sending','published','pending','failed','unknown','feed_ready'));`);
  await db.exec(sql);
  for (const status of ['inactive', 'rejected']) await db.query('update selling_publications set status=$1', [status]);
  await assert.rejects(db.query("update selling_publications set status='made-up'"), /check constraint/);
  await db.exec(sql);
  assert.equal((await db.query('select status from selling_publications')).rows[0].status, 'rejected');
  assert.equal((await db.query("select has_table_privilege('authenticated','selling_publications','SELECT') as allowed")).rows[0].allowed, false);
});
