import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Real Postgres SQL in an ephemeral database. PGlite serializes connections;
// production multi-session contention still needs staging acceptance.
test("developer migration, key lifecycle, quotas and role boundaries", async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);`);
  const migration = await readFile(new URL("../supabase/developer_api.sql", import.meta.url), "utf8");
  await db.exec(migration);
  await db.exec(migration); // Safe reapplication.
  const owner = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";
  await db.query("insert into auth.users values ($1), ($2)", [owner, other]);
  let serial = 0;
  const create = async (user = owner, mode = "live") => {
    const hash = (++serial).toString(16).padStart(64, "0");
    const { rows } = await db.query("select public.create_developer_key($1, 'My app', $2, $3, 'lg_live_prefix') as result", [user, mode, hash]);
    return { ...rows[0].result, hash };
  };
  const consume = async hash => (await db.query("select public.consume_developer_request($1) as result", [hash])).rows[0].result;
  const usage = async () => (await db.query("select public.developer_usage($1) as result", [owner])).rows[0].result;

  await t.test("creation caps, fixed expiry and hashes", async () => {
    const attempts = await Promise.all(Array.from({ length: 7 }, () => create()));
    assert.equal(attempts.filter(result => result.key).length, 5);
    assert.equal(attempts.filter(result => result.error === "api_key_limit").length, 2);
    const first = attempts[0];
    assert.equal(first.key.token_hash, undefined);
    assert.equal(first.key.user_id, undefined);
    assert.deepEqual(first.key.scopes, ["search:read"]);
    assert.equal(Date.parse(first.key.expires_at) - Date.parse(first.key.created_at), 90 * 86400000);
    await db.query("update public.developer_api_keys set revoked_at=now() where user_id=$1", [owner]);
    for (let i = 0; i < 15; i++) {
      const result = await create(); assert.ok(result.key);
      await db.query("update public.developer_api_keys set revoked_at=now() where id=$1", [result.key.id]);
    }
    assert.equal((await create()).error, "api_key_limit");
    // Advance creation timestamps to test a fresh day without sleeping.
    await db.query("update public.developer_api_keys set created_at=now()-interval '1 day' where user_id=$1", [owner]);
  });

  const first = await create(); const second = await create(); const testKey = await create(owner, "test");
  await t.test("quotas are shared across keys but separate per mode and owner", async () => {
    const attempts = await Promise.all(Array.from({ length: 15 }, (_, index) => consume(index % 2 ? first.hash : second.hash)));
    assert.equal(attempts.filter(result => result.mode === "live").length, 10);
    assert.equal(attempts.filter(result => result.error === "quota_exceeded").length, 5);
    assert.ok(attempts.filter(result => result.error).every(result => result.retryAfter > 0));
    assert.equal((await consume(testKey.hash)).mode, "test");
    const otherKey = await create(other);
    assert.equal((await consume(otherKey.hash)).mode, "live");
    const current = await usage();
    assert.equal(current.live.dayRequests, 10); assert.equal(current.test.dayRequests, 1);
    assert.equal(current.live.limits.perDay, 200); assert.equal(current.test.limits.perMinute, 60);
  });

  await t.test("minute and UTC-day resets and daily ceilings", async () => {
    await db.query("update public.developer_request_usage set minute_start=now()-interval '2 minutes' where user_id=$1 and mode='live'", [owner]);
    assert.equal((await consume(first.hash)).mode, "live");
    assert.equal((await usage()).live.minuteRequests, 1);
    await db.query("update public.developer_request_usage set day_requests=200 where user_id=$1 and mode='live'", [owner]);
    assert.equal((await consume(first.hash)).error, "quota_exceeded");
    await db.query("update public.developer_request_usage set day_start=now()-interval '2 days', minute_start=now()-interval '2 minutes' where user_id=$1 and mode='live'", [owner]);
    assert.equal((await usage()).live.dayRequests, 0);
    assert.equal((await consume(first.hash)).mode, "live");
    assert.equal((await usage()).live.dayRequests, 1);
  });

  await t.test("revocation, expiry, missing scopes and account disablement", async () => {
    assert.equal((await consume("f".repeat(64))).error, "invalid_api_key");
    await db.query("update public.developer_api_keys set revoked_at=now() where id=$1", [first.key.id]);
    assert.equal((await consume(first.hash)).error, "invalid_api_key");
    await db.query("update public.developer_api_keys set expires_at=now()-interval '1 second' where id=$1", [second.key.id]);
    assert.equal((await consume(second.hash)).error, "invalid_api_key");
    await db.query("update public.developer_api_keys set scopes='{}' where id=$1", [testKey.key.id]);
    assert.equal((await consume(testKey.hash)).error, "insufficient_scope");
    await db.query("update public.developer_accounts set disabled=true where user_id=$1", [owner]);
    assert.equal((await consume(testKey.hash)).error, "developer_account_disabled");
    assert.equal((await create()).error, "developer_account_disabled");
  });

  await t.test("browser roles cannot read keys or call privileged functions", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query("select * from public.developer_api_keys"), /permission denied/);
      await assert.rejects(db.query("select public.consume_developer_request('secret')"), /permission denied/);
      await assert.rejects(db.query("select public.developer_usage($1)", [owner]), /permission denied/);
      await db.exec("reset role");
    }
    const enabled = await db.query("select relrowsecurity from pg_class where relname in ('developer_api_keys','developer_accounts','developer_request_usage')");
    assert.ok(enabled.rows.every(row => row.relrowsecurity));
  });
});
