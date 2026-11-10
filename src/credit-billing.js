import { billingReturnUrl, stripeGet, stripeRequest } from './billing.js';
import { CREDIT_PACKS, WEEKLY_SEARCH_CREDITS } from './search-credits.js';
import { searchCreditWallet } from './supabase.js';

export const creditsEnabled = env => String(env.SEARCH_CREDITS_ENABLED || '') === '1';
export const CREDIT_OFFERS = Object.freeze({
  weekly: { priceEnv: 'STRIPE_WEEKLY_PRICE_ID', amount: 4900, credits: WEEKLY_SEARCH_CREDITS, interval: 'week' },
  ...CREDIT_PACKS
});
export function creditOffers(env) {
  return Object.entries(CREDIT_OFFERS).map(([id, offer]) => ({ id, amount: offer.amount, credits: offer.credits,
    recurring: Boolean(offer.interval), available: creditsEnabled(env) && Boolean(env[offer.priceEnv]) }));
}
export async function createCreditCheckout({ user, customerId, plan, requestUrl, returnTo, env }) {
  const offer = CREDIT_OFFERS[plan];
  if (!offer || !creditsEnabled(env)) throw new Error('Credit checkout is not available.');
  const priceId = env[offer.priceEnv];
  if (!/^price_[a-zA-Z0-9]+$/.test(priceId || '')) throw new Error('Credit price is not configured.');
  const price = await stripeGet(`/prices/${priceId}`, env);
  if (!price.active || price.currency !== 'ron' || price.unit_amount !== offer.amount ||
    (offer.interval ? price.recurring?.interval !== offer.interval || price.recurring?.interval_count !== 1 : Boolean(price.recurring))) {
    throw new Error('Stripe price does not match the advertised credit offer.');
  }
  const destination = typeof returnTo === 'string' && /^\/(search|pricing|account)(\/|\?|$)/.test(returnTo) && returnTo.length < 2000 ? returnTo : '/pricing/';
  const success = new URL(billingReturnUrl(requestUrl, env, destination));
  success.searchParams.set('checkout', 'success');
  success.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');
  const cancel = new URL(billingReturnUrl(requestUrl, env, destination));
  cancel.searchParams.set('checkout', 'cancelled');
  const fields = {
    mode: offer.interval ? 'subscription' : 'payment',
    'line_items[0][price]': priceId, 'line_items[0][quantity]': '1',
    client_reference_id: user.id, 'metadata[user_id]': user.id, 'metadata[credit_offer]': plan,
    success_url: success.toString().replace('%7BCHECKOUT_SESSION_ID%7D', '{CHECKOUT_SESSION_ID}'), cancel_url: cancel.toString()
  };
  if (offer.interval) fields['subscription_data[metadata][user_id]'] = user.id;
  if (customerId) fields.customer = customerId;
  else if (user.email) fields.customer_email = user.email;
  return stripeRequest('/checkout/sessions', fields, env);
}

export async function fulfillCreditPack(object, env) {
  if (object.mode !== 'payment' || !object.metadata?.credit_offer) return false;
  if (!/^cs_[a-zA-Z0-9_]+$/.test(object.id || '')) throw new Error('Invalid checkout session.');
  const session = await stripeGet(`/checkout/sessions/${object.id}?expand[]=line_items`, env);
  if (session.payment_status !== 'paid') return true;
  const offer = CREDIT_PACKS[session.metadata?.credit_offer];
  const line = session.line_items?.data?.[0];
  const userId = session.client_reference_id;
  if (!offer || session.mode !== 'payment' || session.metadata?.user_id !== userId ||
    !/^[0-9a-f-]{36}$/i.test(userId || '') || session.line_items?.data?.length !== 1 ||
    line?.price?.id !== env[offer.priceEnv] || line.quantity !== 1 ||
    session.currency !== 'ron' || session.amount_total !== offer.amount) throw new Error('Invalid paid credit purchase.');
  await searchCreditWallet(userId, 'grant', { p_reference: `checkout:${session.id}`, p_amount: offer.credits }, env);
  return true;
}

export async function fulfillWeeklyCredits(event, subscription, userId, env) {
  if (event.type !== 'invoice.paid' || !env.STRIPE_WEEKLY_PRICE_ID) return;
  const invoiceId = event.data?.object?.id;
  if (!/^in_[a-zA-Z0-9]+$/.test(invoiceId || '')) throw new Error('Invalid invoice.');
  const invoice = await stripeGet(`/invoices/${invoiceId}`, env);
  const ownerSubscription = invoice.parent?.subscription_details?.subscription || invoice.subscription;
  if (invoice.status !== 'paid' || ownerSubscription !== subscription.id ||
    !['subscription_create', 'subscription_cycle'].includes(invoice.billing_reason)) return;
  const line = invoice.lines?.data?.find(item => (item.pricing?.price_details?.price || item.price?.id) === env.STRIPE_WEEKLY_PRICE_ID);
  if (!line || line.quantity !== 1 || !Number.isSafeInteger(line.period?.end)) return;
  await searchCreditWallet(userId, 'grant', {
    p_reference: `invoice:${invoice.id}`, p_amount: WEEKLY_SEARCH_CREDITS,
    p_expires_at: new Date(line.period.end * 1000).toISOString()
  }, env);
}
