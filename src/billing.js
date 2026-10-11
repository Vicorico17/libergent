const STRIPE_API = "https://api.stripe.com/v1";
const encoder = new TextEncoder();
export const BILLING_TRIAL_DAYS = 3;
export const BILLING_PLANS = Object.freeze({
  weekly: { priceEnv: "STRIPE_WEEKLY_PRICE_ID", amount: 4900, interval: "week" },
  annual: { priceEnv: "STRIPE_ANNUAL_PRICE_ID", amount: 49900, interval: "year" }
});

export function isBillingConfigured(env = {}) {
  return Boolean(String(env.STRIPE_SECRET_KEY || "").startsWith("sk_test_") && (env.STRIPE_PRICE_ID || env.STRIPE_WEEKLY_PRICE_ID || env.STRIPE_ANNUAL_PRICE_ID) && env.STRIPE_WEBHOOK_SECRET && env.LIBERGENT_PUBLIC_URL && env.SUPABASE_URL && (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY));
}

export function isCheckoutConfigured(env = {}) {
  return isBillingConfigured(env) && Object.values(BILLING_PLANS).every(({ priceEnv }) => Boolean(env[priceEnv]));
}

export function configuredPriceIds(env = {}) {
  return [env.STRIPE_PRICE_ID, ...Object.values(BILLING_PLANS).map(({ priceEnv }) => env[priceEnv])].filter(Boolean);
}

export async function stripeRequest(path, fields, env, idempotencyKey) {
  if (!env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured.");
  const body = new URLSearchParams(fields);
  const response = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {})
    },
    body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `Stripe request failed (${response.status}).`);
  return payload;
}

export async function stripeGet(path, env) {
  const response = await fetch(`${STRIPE_API}${path}`, { headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `Stripe request failed (${response.status}).`);
  return payload;
}

export async function assertConfiguredPrice(plan, env) {
  const selected = BILLING_PLANS[plan];
  if (!selected) throw new Error("Choose a valid billing plan.");
  const priceId = env[selected.priceEnv];
  if (!/^price_[a-zA-Z0-9]+$/.test(priceId || "")) throw new Error(`Invalid Stripe ${plan} Price ID.`);
  const price = await stripeGet(`/prices/${priceId}`, env);
  if (!price.active || price.currency !== "ron" || price.unit_amount !== selected.amount || price.recurring?.interval !== selected.interval || price.recurring?.interval_count !== 1) {
    throw new Error(`Stripe ${plan} Price does not match the advertised amount and billing interval.`);
  }
  return priceId;
}

export function billingReturnUrl(requestUrl, env, suffix) {
  const base = new URL(env.LIBERGENT_PUBLIC_URL || requestUrl);
  if (base.protocol !== "https:" && base.hostname !== "localhost" && base.hostname !== "127.0.0.1") {
    throw new Error("Billing return URL must use HTTPS.");
  }
  return new URL(suffix, base.origin).toString();
}

export async function createCheckoutSession({ user, customerId, requestUrl, priceId, trialEligible, env }) {
  const fields = {
    mode: "subscription",
    payment_method_collection: "always",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    client_reference_id: user.id,
    "subscription_data[metadata][user_id]": user.id,
    success_url: billingReturnUrl(requestUrl, env, "/pricing/?checkout=success"),
    cancel_url: billingReturnUrl(requestUrl, env, "/pricing/?checkout=cancelled")
  };
  if (trialEligible) {
    fields["subscription_data[trial_period_days]"] = String(BILLING_TRIAL_DAYS);
  }
  if (customerId) fields.customer = customerId;
  else if (user.email) fields.customer_email = user.email;
  return stripeRequest("/checkout/sessions", fields, env);
}

export async function createPortalSession({ customerId, requestUrl, env }) {
  return stripeRequest("/billing_portal/sessions", {
    customer: customerId,
    return_url: billingReturnUrl(requestUrl, env, "/account/")
  }, env);
}

export async function verifyStripeEvent(rawBody, signature, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  const parts = Object.fromEntries(String(signature || "").split(",").map((part) => part.trim().split("=", 2)));
  const timestamp = Number(parts.t);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > 300 || !parts.v1 || !secret) return null;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${rawBody}`)));
  const actual = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const candidates = String(signature).split(",").map((part) => part.trim()).filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  const matches = candidates.some((candidate) => {
    if (!/^[0-9a-f]{64}$/i.test(candidate)) return false;
    let difference = 0;
    for (let index = 0; index < 64; index += 1) difference |= actual.charCodeAt(index) ^ candidate.toLowerCase().charCodeAt(index);
    return difference === 0;
  });
  if (!matches) return null;
  try { return JSON.parse(rawBody); } catch { return null; }
}

export function entitlementFromSubscription(subscription) {
  const periodEnd = subscription.items?.data?.[0]?.current_period_end || subscription.current_period_end;
  const hasFuturePeriod = Number.isSafeInteger(periodEnd) && periodEnd * 1000 > Date.now();
  const status = subscription.status === "active" || subscription.status === "trialing" ? (hasFuturePeriod ? "active" : "past_due") : subscription.status === "past_due" ? "past_due" : "cancelled";
  return {
    plan: "premium",
    status,
    expires_at: Number.isSafeInteger(periodEnd) && periodEnd > 0 ? new Date(periodEnd * 1000).toISOString() : null
  };
}
