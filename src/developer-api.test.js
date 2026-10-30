import test from "node:test";
import assert from "node:assert/strict";
import { handleDeveloperApi, parseDeveloperSearch, executeDeveloperSearch } from "./developer-api.js";
import { createDeveloperStore, generateDeveloperKey, hashDeveloperKey, DeveloperError } from "./developer-store.js";
import { buildMockSearchResult } from "./mock.js";
import worker from "./worker.js";

const env = { LIBERGENT_DEVELOPER_API_ENABLED: "1", SUPABASE_URL: "https://db.test", SUPABASE_SECRET_KEY: "sb_secret_test" };
const userId = "11111111-1111-4111-8111-111111111111";
const auth = async () => ({ user: { id: userId, email_confirmed_at: "2026-01-01T00:00:00Z" } });
const request = (path, init = {}) => new Request(`https://libergent.test${path}`, init);
const input = { query: "iphone 15", siteKeys: ["olx.ro"], condition: "any", limit: 2 };
const post = data => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });

test("developer API is opt-in; config and isolated MCP deployment fail closed", async () => {
  assert.equal((await worker.fetch(request("/api/developer/config"), {})).status, 200);
  assert.deepEqual(await (await worker.fetch(request("/api/developer/config"), {})).json(), { available: false });
  assert.equal((await worker.fetch(request("/api/v1/demo"), {})).status, 503);
  assert.equal((await worker.fetch(request("/api/v1/demo"), { ...env, LIBERGENT_MCP_TEST_MODE: "1" })).status, 404);
  assert.equal((await worker.fetch(request("/api/v1/demo"), env)).status, 200);
});

test("search input rejects unsupported paid providers, sources, duplicates, adult and personal data", () => {
  for (const query of ["q=iphone&provider=firecrawl", "q=iphone&sites=emag", "q=iphone&q=phone", "q=iphone&limit=21", "q=iphone&limit=1.5", "q=iphone&maxPriceRon=NaN", "q=iphone&condition=broken", "q=lovense", "q=test%40example.com", "q=iphone&details=true"]) {
    assert.throws(() => parseDeveloperSearch(new URL(`https://test/search?${query}`)), DeveloperError);
  }
  assert.deepEqual(parseDeveloperSearch(new URL("https://test/search?q=iphone&sites=olx,olx.ro,publi24&limit=5" )).siteKeys, ["olx.ro", "publi24.ro"]);
});

test("key creation requires confirmed account, bounded JSON and supported scopes", async () => {
  const calls = [];
  const store = { create: async (...args) => { calls.push(args); return { token: "shown-once", key: { mode: "test" } }; } };
  const path = "/api/developer/keys";
  const data = { name: " My app ", mode: "test", scopes: ["search:read"] };
  assert.equal((await handleDeveloperApi(request(path, post(data)), env, async () => ({ status: 401 }), { store })).status, 401);
  assert.equal((await handleDeveloperApi(request(path, post(data)), env, async () => ({ user: { id: userId } }), { store })).status, 403);
  assert.equal((await handleDeveloperApi(request(path, post({ ...data, scopes: ["admin"] })), env, auth, { store })).status, 400);
  assert.equal((await handleDeveloperApi(request(path, post({ ...data, name: "a".repeat(5000) })), env, auth, { store })).status, 413);
  assert.equal((await handleDeveloperApi(request(path, { ...post(data), headers: { "content-type": "application/json", origin: "https://evil.test" } }), env, auth, { store })).status, 403);
  const response = await handleDeveloperApi(request(path, post(data)), env, auth, { store });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(calls, [[userId, { name: "My app", mode: "test" }]]);
});

test("key persistence stores only a hash, never returns it, and scopes revocation to owner", async t => {
  const original = globalThis.fetch; const calls = [];
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (String(url).endsWith("rpc/create_developer_key")) {
      const body = JSON.parse(options.body);
      return Response.json({ key: { id: "key-id", name: body.p_name, mode: body.p_mode, prefix: body.p_prefix, token_hash: body.p_hash, scopes: ["search:read"] } });
    }
    return Response.json([]);
  };
  const store = createDeveloperStore(env);
  const created = await store.create(userId, { name: "My app", mode: "live" });
  assert.match(created.token, /^lg_live_[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(created.key).includes("token_hash"));
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.p_hash, await hashDeveloperKey(created.token));
  assert.ok(!calls[0].options.body.includes(created.token));
  await assert.rejects(store.revoke(userId, "22222222-2222-4222-8222-222222222222"), error => error.status === 404);
  assert.ok(calls[1].url.includes(`user_id=eq.${userId}`));
  assert.equal(calls[0].options.headers.authorization, undefined);
  await assert.rejects(store.consume("not-a-key"), error => error.status === 401);
  assert.equal(calls.length, 2);
  assert.notEqual((await generateDeveloperKey("test")).token, (await generateDeveloperKey("test")).token);
});

test("database outages fail closed without leaking provider errors", async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => Response.json({ message: "private schema detail" }, { status: 500 });
  const response = await handleDeveloperApi(request("/api/v1/search?q=iphone", { headers: { authorization: `Bearer lg_live_${"a".repeat(64)}` } }), env, auth);
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes("private schema"));
});

test("cache hits recheck quota and revocation before exposing cached results", async () => {
  let mode = "live"; let blocked = false; let used = 0; let searches = 0; let cached;
  const store = { consume: async () => { used++; if (blocked) throw new DeveloperError("quota_exceeded", 429, 60); return { mode }; } };
  const cache = { match: async () => cached?.clone(), put: async (_, response) => { cached = response; } };
  const search = async (...args) => { searches++; return executeDeveloperSearch(args[0], "test"); };
  const run = () => handleDeveloperApi(request("/api/v1/search?q=iphone"), env, auth, { store, cache, search });
  assert.equal((await run()).status, 200);
  assert.equal((await (await run()).json()).cacheHit, true);
  assert.equal(searches, 1);
  blocked = true;
  const denied = await run();
  assert.equal(denied.status, 429);
  assert.equal(denied.headers.get("retry-after"), "60");
  assert.equal(searches, 1);
  blocked = false; mode = "test";
  assert.equal((await run()).status, 200);
  assert.equal(searches, 2); // Test never reads or writes the live cache.
  assert.equal(used, 4);
});

test("test search never invokes marketplaces; live search is direct and retains engine decisions", async () => {
  let calls = 0;
  const search = async args => {
    calls++;
    assert.equal(args.provider, "direct"); assert.equal(args.maxPages, 1); assert.equal(args.limit, 20);
    assert.ok(args.signal instanceof AbortSignal);
    return buildMockSearchResult({ siteKey: args.site.key, query: args.query });
  };
  const simulated = await executeDeveloperSearch(input, "test", undefined, search);
  assert.equal(calls, 0); assert.equal(simulated.simulated, true);
  assert.ok(simulated.items.every(item => item.lastVerifiedAt === null));
  const live = await executeDeveloperSearch(input, "live", undefined, search);
  assert.equal(calls, 1); assert.equal(live.mode, "live");
  assert.equal(live.decisions.decisionAuthority, "libergent");
  assert.ok(live.items.every(item => item.availability === "unknown" && item.lastVerifiedAt));
  assert.deepEqual(live.decisions.recommendedOffer, simulated.decisions.recommendedOffer);
});

test("partial failures remain explicit; total failure never becomes an empty successful search", async () => {
  const partial = await executeDeveloperSearch({ ...input, siteKeys: ["olx.ro", "publi24.ro"] }, "live", undefined, async args => {
    if (args.site.key === "publi24.ro") throw Error("private source detail");
    return buildMockSearchResult({ siteKey: args.site.key, query: args.query });
  });
  assert.equal(partial.partial, true);
  assert.deepEqual(partial.sources[1], { domain: "publi24.ro", status: "unavailable" });
  await assert.rejects(executeDeveloperSearch(input, "live", undefined, async () => { throw Error(); }), error => error.code === "sources_unavailable");
});

test("public demo and OpenAPI match the implemented read-only surface", async () => {
  const demo = await (await handleDeveloperApi(request("/api/v1/demo"), env, auth)).json();
  assert.equal(demo.mode, "test"); assert.equal(demo.simulated, true);
  const spec = await (await handleDeveloperApi(request("/api/v1/openapi.json"), env, auth)).json();
  assert.deepEqual(Object.keys(spec.paths).sort(), ["/api/v1/demo", "/api/v1/search", "/api/v1/sources"]);
  assert.equal((await handleDeveloperApi(request("/api/v1/mcp"), env, auth)).status, 404);
});

test("search deadline aborts upstream work even if a source never settles", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let upstreamSignal;
  const pending = executeDeveloperSearch(input, "live", undefined, async args => {
    upstreamSignal = args.signal;
    return new Promise(() => {});
  });
  const rejected = assert.rejects(pending, error => error.status === 504 && error.code === "search_timeout");
  t.mock.timers.tick(25000);
  await rejected;
  assert.equal(upstreamSignal.aborted, true);
});

test("already-cancelled requests never start marketplace work", async () => {
  let called = false;
  await assert.rejects(executeDeveloperSearch(input, "live", AbortSignal.abort(), async () => { called = true; }), error => error.status === 499);
  assert.equal(called, false);
});
