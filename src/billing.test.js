import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.js";
import { entitlementFromSubscription, isBillingConfigured, verifyStripeEvent } from "./billing.js";

const userId = "11111111-1111-4111-8111-111111111111";
const env = {
  STRIPE_SECRET_KEY: "sk_test_fake",
  STRIPE_PRICE_ID: "price_test123",
  STRIPE_WEEKLY_PRICE_ID: "price_weekly123",
  STRIPE_ANNUAL_PRICE_ID: "price_annual123",
  STRIPE_WEBHOOK_SECRET: "whsec_fake",
  LIBERGENT_PUBLIC_URL: "https://libergent.test",
  SUPABASE_URL: "https://supabase.test",
  SUPABASE_ANON_KEY: "sb_publishable_fake",
  SUPABASE_SECRET_KEY: "sb_secret_fake"
};

async function signedRequest(event, secret = env.STRIPE_WEBHOOK_SECRET) {
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`)));
  const signature = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return new Request("https://libergent.test/api/billing/webhook", {
    method: "POST", headers: { "stripe-signature": `t=${timestamp},v1=${signature}` }, body
  });
}

test("checkout requires a user, validates the selected Price, and grants a first-time trial", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/auth/v1/user")) return Response.json({ id: userId, email: "buyer@example.com" });
    if (String(url).includes("/rest/v1/billing_customers")) return Response.json([]);
    if (String(url).endsWith("/prices/price_annual123")) return Response.json({ active: true, currency: "ron", unit_amount: 49900, recurring: { interval: "year", interval_count: 1 } });
    if (String(url).endsWith("/prices/price_weekly123")) return Response.json({ active: true, currency: "ron", unit_amount: 4900, recurring: { interval: "week", interval_count: 1 } });
    if (String(url).endsWith("/checkout/sessions")) return Response.json({ url: "https://checkout.stripe.com/test-session" });
    throw new Error(`Unexpected request: ${url}`);
  };
  const unauthenticated = await worker.fetch(new Request("https://libergent.test/api/billing/checkout", { method: "POST" }), env);
  assert.equal(unauthenticated.status, 401);
  const response = await worker.fetch(new Request("https://libergent.test/api/billing/checkout", { method: "POST", headers: { authorization: "Bearer user-token" }, body: JSON.stringify({ plan: "annual" }) }), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).url, "https://checkout.stripe.com/test-session");
  const checkout = calls.find((call) => call.url.endsWith("/checkout/sessions"));
  const fields = new URLSearchParams(checkout.init.body);
  assert.equal(fields.get("line_items[0][price]"), "price_annual123");
  assert.equal(fields.get("subscription_data[trial_period_days]"), "3");
  assert.equal(fields.get("subscription_data[metadata][user_id]"), userId);
  assert.equal(fields.get("success_url"), "https://libergent.test/pricing/?checkout=success");
  const weekly = await worker.fetch(new Request("https://libergent.test/api/billing/checkout", { method: "POST", headers: { authorization: "Bearer user-token" }, body: JSON.stringify({ plan: "weekly" }) }), env);
  assert.equal(weekly.status, 200);
  const weeklyFields = new URLSearchParams(calls.filter((call) => call.url.endsWith("/checkout/sessions")).at(-1).init.body);
  assert.equal(weeklyFields.get("line_items[0][price]"), "price_weekly123");
  const invalidPlan = await worker.fetch(new Request("https://libergent.test/api/billing/checkout", { method: "POST", headers: { authorization: "Bearer user-token" }, body: JSON.stringify({ plan: "free" }) }), env);
  assert.equal(invalidPlan.status, 400);
});

test("a returning customer does not receive another trial", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  let checkoutFields;
  globalThis.fetch = async (url, init = {}) => {
    const target = String(url);
    if (target.endsWith("/auth/v1/user")) return Response.json({ id: userId, email: "buyer@example.com" });
    if (target.includes("/rest/v1/billing_customers")) return Response.json([{ user_id: userId, stripe_customer_id: "cus_123", stripe_subscription_id: "sub_old" }]);
    if (target.endsWith("/subscriptions/sub_old")) return Response.json({ status: "canceled" });
    if (target.endsWith("/prices/price_weekly123")) return Response.json({ active: true, currency: "ron", unit_amount: 4900, recurring: { interval: "week", interval_count: 1 } });
    if (target.endsWith("/checkout/sessions")) { checkoutFields = new URLSearchParams(init.body); return Response.json({ url: "https://checkout.stripe.com/test-session" }); }
    throw new Error(`Unexpected request: ${url}`);
  };
  const response = await worker.fetch(new Request("https://libergent.test/api/billing/checkout", { method: "POST", headers: { authorization: "Bearer user-token" }, body: JSON.stringify({ plan: "weekly" }) }), env);
  assert.equal(response.status, 200);
  assert.equal(checkoutFields.get("customer"), "cus_123");
  assert.equal(checkoutFields.has("subscription_data[trial_period_days]"), false);
});

test("webhook verifies raw signature and maps current subscription state", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const writes = [];
  let status = "active";
  globalThis.fetch = async (url, init = {}) => {
    const target = String(url);
    if (target.endsWith("/auth/v1/user")) return Response.json({ id: userId, email: "buyer@example.com" });
    if (target.includes("/rest/v1/user_entitlements")) return Response.json(writes.length ? [{ plan: "premium", status: writes.at(-1).p_status, expires_at: writes.at(-1).p_expires_at }] : []);
    if (target.includes("/rest/v1/alert_profiles") || target.includes("/rest/v1/alert_events")) return Response.json([]);
    if (target.endsWith("/subscriptions/sub_123")) return Response.json({ id: "sub_123", customer: "cus_123", status,
      metadata: { user_id: userId }, items: { data: [{ price: { id: "price_annual123" }, current_period_end: 1800000000 }] } });
    if (target.includes("/rest/v1/billing_customers")) return Response.json([]);
    if (target.endsWith("/rpc/apply_billing_subscription")) { writes.push(JSON.parse(init.body)); return Response.json(true); }
    throw new Error(`Unexpected request: ${url}`);
  };
  const event = { id: "evt_123", type: "customer.subscription.updated", created: 1700000000, data: { object: { id: "sub_123" } } };
  const alerts = () => worker.fetch(new Request("https://libergent.test/api/alerts", { headers: { authorization: "Bearer user-token" } }), env);
  assert.equal((await alerts()).status, 403);
  const invalid = await worker.fetch(await signedRequest(event, "wrong-secret"), env);
  assert.equal(invalid.status, 400);
  assert.equal(writes.length, 0);
  const active = await worker.fetch(await signedRequest(event), env);
  assert.equal(active.status, 200);
  assert.equal(writes[0].p_status, "active");
  assert.equal((await alerts()).status, 200);
  assert.equal(entitlementFromSubscription({ status: "trialing", current_period_end: 1800000000 }).status, "active");
  status = "past_due";
  const failed = await worker.fetch(await signedRequest({ ...event, id: "evt_124", type: "invoice.payment_failed", created: event.created + 1,
    data: { object: { parent: { subscription_details: { subscription: "sub_123" } } } } }), env);
  assert.equal(failed.status, 200);
  assert.equal(writes[1].p_status, "past_due");
  assert.equal((await alerts()).status, 403);
  status = "canceled";
  const canceled = await worker.fetch(await signedRequest({ ...event, id: "evt_125", type: "customer.subscription.deleted", created: event.created + 2 }), env);
  assert.equal(canceled.status, 200);
  assert.equal(writes[2].p_status, "cancelled");
  assert.equal(entitlementFromSubscription({ status: "canceled" }).status, "cancelled");
});

test("signature rejects stale events", async () => {
  assert.equal(await verifyStripeEvent("{}", "t=1,v1=" + "0".repeat(64), env.STRIPE_WEBHOOK_SECRET), null);
  assert.equal(isBillingConfigured({ ...env, STRIPE_SECRET_KEY: "sk_live_fake" }), false);
});
