import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.js";
import { readAgentEntitlement } from "./supabase.js";

const env = {
  SUPABASE_URL: "https://supabase.example",
  SUPABASE_SECRET_KEY: "test-secret",
  LIBERGENT_PREMIUM_EMAILS: "buyer@example.test",
  LIBERGENT_PREMIUM_ALERTS_BETA: "1",
  OPENCLAW_BRIDGE_URL: "https://bridge.example",
  OPENCLAW_BRIDGE_TOKEN: "test-token"
};

for (const [name, row] of [
  ["missing", null],
  ["inactive", { status: "inactive" }],
  ["cancelled", { status: "cancelled" }],
  ["expired", { status: "active", expires_at: "2000-01-01T00:00:00Z" }],
  ["invalid expiry", { status: "active", expires_at: "invalid" }]
]) {
  test(`Premium and beta access do not bypass ${name} Agent access`, async (t) => {
    const original = globalThis.fetch;
    t.after(() => { globalThis.fetch = original; });
    globalThis.fetch = async (url) => {
      const target = new URL(url);
      if (target.pathname.endsWith("/auth/v1/user")) return Response.json({ id: "buyer-1", email: "buyer@example.test" });
      if (target.pathname.endsWith("/agent_entitlements")) {
        assert.equal(target.searchParams.get("user_id"), "eq.buyer-1");
        return Response.json(row ? [row] : []);
      }
      assert.fail(`No downstream action should run: ${url}`);
    };
    for (const [path, method, body] of [
      ["/api/deals", "GET"],
      ["/api/deals", "POST", {}],
      ["/api/deals/11111111-1111-4111-8111-111111111111/suggest", "POST", {}],
      ["/api/deals/11111111-1111-4111-8111-111111111111/calls", "POST", {}],
      ["/api/whatsapp/send", "POST", { target: "+40722123456", message: "Hello" }]
    ]) {
      const response = await worker.fetch(new Request(`https://libergent.test${path}`, {
        method, headers: { authorization: "Bearer buyer-token", "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {})
      }), env);
      assert.equal(response.status, 403, path);
      assert.equal((await response.json()).code, "agent_required");
    }
  });
}

test("Agent access is independent of Premium and expires deterministically", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/auth/v1/user")) return Response.json({ id: "buyer-1" });
    if (String(url).includes("/agent_entitlements")) return Response.json([{ status: "active", expires_at: "2999-01-01T00:00:00Z" }]);
    if (String(url).includes("/user_entitlements")) return Response.json([]);
    if (String(url).includes("/deal_cases")) return Response.json([]);
    assert.fail(`Unexpected request ${url}`);
  };
  const agentOnlyEnv = { SUPABASE_URL: env.SUPABASE_URL, SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY };
  assert.equal((await readAgentEntitlement("buyer-1", agentOnlyEnv)).active, true);
  const request = (path) => new Request(`https://libergent.test${path}`, { headers: { authorization: "Bearer buyer-token" } });
  assert.equal((await worker.fetch(request("/api/deals"), agentOnlyEnv)).status, 200);
  const search = await worker.fetch(request("/api/search/premium?q=iphone"), agentOnlyEnv);
  assert.equal(search.status, 403);
  assert.equal((await search.json()).code, "premium_required");
});

test("Agent database failure denies service without contacting a seller", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/auth/v1/user")) return Response.json({ id: "buyer-1" });
    if (String(url).includes("/agent_entitlements")) return Response.json({ message: "missing migration" }, { status: 404 });
    assert.fail(`Unexpected request ${url}`);
  };
  const response = await worker.fetch(new Request("https://libergent.test/api/whatsapp/send", {
    method: "POST", headers: { authorization: "Bearer buyer-token", "content-type": "application/json" },
    body: JSON.stringify({ target: "+40722123456", message: "Hello" })
  }), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "agent_access_unavailable");
});
