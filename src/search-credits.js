import { searchCreditWallet } from './supabase.js';

export const PREMIUM_SEARCH_COST = 1;
export const MONTHLY_SEARCH_CREDITS = 40;
export const CREDIT_PACKS = Object.freeze({
  credits10: { priceEnv: 'STRIPE_CREDITS_10_PRICE_ID', amount: 1900, credits: 10 },
  credits30: { priceEnv: 'STRIPE_CREDITS_30_PRICE_ID', amount: 3900, credits: 30 }
});
const messages = {
  insufficient_credits: 'Ai folosit creditele disponibile. Adaugă credite pentru a continua în Premium.',
  search_in_progress: 'Această căutare este în curs. Încearcă din nou în câteva momente.',
  request_conflict: 'Identificatorul căutării a fost deja folosit.',
  request_expired: 'Încearcă din nou cu o căutare nouă.'
};
export function creditError(code, status = 409) {
  return Object.assign(new Error(messages[code] || code), { code, status });
}

// Used by both runtimes; an API/MCP premium operation can use this same boundary.
export async function runCreditSearch({ userId, requestId, fingerprint, execute, env }) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId || '')) {
    throw creditError('A search request ID is required.', 400);
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint));
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const reservation = await searchCreditWallet(userId, 'reserve', {
    p_request_id: requestId, p_fingerprint: hash, p_amount: PREMIUM_SEARCH_COST
  }, env);
  if (reservation.code) throw Object.assign(creditError(reservation.code, reservation.code === 'insufficient_credits' ? 402 : 409), { wallet: reservation });
  if (reservation.replay) return { ...reservation.replay, credits: { ...walletSummary(reservation), spent: 0, replay: true } };
  if (!reservation.reserved) throw new Error('Credit reservation failed.');
  let committing = false;
  try {
    const payload = await execute();
    if (!payload.results?.some(result => result.ok)) throw new Error('Sursele nu au răspuns. Creditul este returnat.');
    // A commit with an uncertain network outcome must never be refunded blindly.
    committing = true;
    const completed = await searchCreditWallet(userId, 'complete', { p_request_id: requestId, p_response: payload }, env);
    if (!completed.completed) throw creditError(completed.code || 'request_expired');
    return { ...payload, credits: { ...walletSummary(completed), spent: PREMIUM_SEARCH_COST } };
  } catch (error) {
    if (!committing) {
      try { await searchCreditWallet(userId, 'refund', { p_request_id: requestId }, env); error.code = 'search_refunded'; }
      catch { /* Expired reservations are recovered by the next wallet request. */ }
    }
    throw error;
  }
}

export function walletSummary(wallet) {
  return { balance: wallet.balance, included: wallet.included, purchased: wallet.purchased, renewsAt: wallet.renewsAt };
}
