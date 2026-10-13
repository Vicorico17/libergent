import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.js";
import { discoveryProbeFailure } from "./discovery-probes.js";

const env = { SUPABASE_URL: "https://database.example", SUPABASE_SECRET_KEY: "sb_secret_test" };

function isolate(t) {
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  t.mock.method(console, "warn", () => {});
}

test("radar distinguishes missing schema without exposing database details", async t => {
  isolate(t);
  t.mock.method(globalThis, "fetch", async () => Response.json({ message: "Could not find the table 'public.discovery_probe_runs' in the schema cache" }, { status: 404 }));
  const response = await worker.fetch(new Request("https://libergent.test/api/discovery/probes"), env);
  const payload = await response.json();
  assert.equal(response.status, 503);
  assert.equal(payload.code, "discovery_schema_not_ready");
  assert.doesNotMatch(payload.error, /public\.|schema cache|Supabase/);
});

test("radar reports an authorization failure as unavailable, not missing schema", async t => {
  isolate(t);
  t.mock.method(globalThis, "fetch", async () => Response.json({ message: "Invalid API key" }, { status: 401 }));
  const response = await worker.fetch(new Request("https://libergent.test/api/discovery/probes"), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "discovery_unavailable");
  assert.equal(discoveryProbeFailure(new Error("fetch failed")).code, "discovery_unavailable");
});

test("radar returns a successful empty queue once its tables are available", async t => {
  isolate(t);
  t.mock.method(globalThis, "fetch", async () => Response.json([]));
  const response = await worker.fetch(new Request("https://libergent.test/api/discovery/probes"), env);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(payload.runs, []);
  assert.deepEqual(payload.terms, []);
  assert.ok(Number.isFinite(Date.parse(payload.updatedAt)));
});
