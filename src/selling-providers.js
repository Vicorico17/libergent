import { SellingError, store, ownerQuery, seal, unseal } from './selling-store.js';

const OLX = 'https://www.olx.ro';
export function olxConfigured(env) {
  return Boolean(env.OLX_CLIENT_ID && env.OLX_CLIENT_SECRET && env.SELLING_PUBLIC_URL && /^[a-f\d]{64}$/i.test(env.SELLING_ENCRYPTION_KEY || ''));
}
export function publicOrigin(env) {
  const url = new URL(env.SELLING_PUBLIC_URL);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new SellingError('Adresa publică de vânzare nu este configurată.', 503);
  return url.origin;
}
export const callbackUrl = (env) => `${publicOrigin(env)}/api/selling/olx/callback`;
export function olxAuthorizeUrl(state, env) {
  return `${OLX}/oauth/authorize/?${new URLSearchParams({ client_id: env.OLX_CLIENT_ID, response_type: 'code', scope: 'v2 read write', state, redirect_uri: callbackUrl(env) })}`;
}
export async function olxToken(grant, env) {
  const response = await fetch(`${OLX}/api/open/oauth/token`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: env.OLX_CLIENT_ID, client_secret: env.OLX_CLIENT_SECRET, ...grant }), signal: AbortSignal.timeout(20000), redirect: 'error'
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw new SellingError('Conectarea OLX a eșuat. Reconectează contul.', 502);
  return { ...payload, expires_at: Date.now() + Number(payload.expires_in || 3600) * 1000 };
}
export async function saveOlxConnection(userId, tokens, env) {
  await store(env, 'selling_connections', 'on_conflict=user_id,platform', 'POST', { user_id: userId, platform: 'olx', credentials: await seal(tokens, userId, env) }, 'resolution=merge-duplicates');
}
export async function olxAccessToken(userId, env) {
  if (!olxConfigured(env)) throw new SellingError('Integrarea OLX necesită activare pe server.', 503);
  const [connection] = await store(env, 'selling_connections', `${ownerQuery(userId)}&platform=eq.olx`);
  if (!connection) throw new SellingError('Conectează contul OLX înainte de publicare.', 409);
  let tokens = await unseal(connection.credentials, userId, env);
  if (tokens.expires_at < Date.now() + 60000) {
    tokens = await olxToken({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token }, env);
    await saveOlxConnection(userId, tokens, env);
  }
  return tokens.access_token;
}
export async function olxRequest(path, token, method = 'GET', body) {
  const response = await fetch(`${OLX}/api/partner${path}`, {
    method, headers: { authorization: `Bearer ${token}`, version: '2.0', 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(25000), redirect: 'error'
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    // A definitive validation/auth rejection is safe to retry. Timeouts/5xx are ambiguous.
    const error = new SellingError(response.status === 401 ? 'Sesiunea OLX a expirat. Reconectează contul.' : 'OLX nu a acceptat cererea.', 502);
    error.definitive = [400, 401, 403, 404, 422, 429].includes(response.status);
    error.fields = (data?.error?.validation || []).slice(0, 20).map((item) => `${String(item.field || '').slice(0, 100)}: ${String(item.detail || item.title || '').slice(0, 300)}`);
    throw error;
  }
  return data?.data ?? data;
}
export function olxPayload(listing, id) {
  const config = listing.olx || {};
  if (!Number.isInteger(config.categoryId) || config.categoryId < 1 || !Number.isInteger(config.cityId) || config.cityId < 1 || !listing.contactName) throw new SellingError('Completează categoria OLX, localitatea OLX și numele de contact.');
  if (!Array.isArray(config.attributes) || config.attributes.length > 80) throw new SellingError('Verifică atributele categoriei OLX.');
  return {
    title: listing.title, description: listing.description, category_id: config.categoryId,
    advertiser_type: config.advertiserType === 'business' ? 'business' : 'private', external_id: id,
    contact: { name: listing.contactName, ...(listing.phone ? { phone: listing.phone } : {}) },
    location: { city_id: config.cityId, ...(config.districtId ? { district_id: config.districtId } : {}) },
    images: listing.images.map((url) => ({ url })),
    price: { value: listing.price, currency: 'RON', negotiable: false },
    attributes: config.attributes, auto_extend_enabled: false
  };
}
const xml = (value) => String(value).replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]);
export function okaziiFeed(rows) {
  return `<?xml version="1.0" encoding="UTF-8"?><OKAZII>${rows.map(({ id, listing }) => `<AUCTION><UNIQUEID>${xml(id)}</UNIQUEID><TITLE>${xml(listing.title.slice(0, 80))}</TITLE><CATEGORY>${xml(listing.category)}</CATEGORY><DESCRIPTION><![CDATA[${listing.description.replace(/]]>/g, ']]]]><![CDATA[>')}]]></DESCRIPTION><PRICE>${listing.price}</PRICE><CURRENCY>RON</CURRENCY><AMOUNT>1</AMOUNT><STATE>${listing.condition === 'Nou' ? 1 : 2}</STATE><REPOST>0</REPOST><PHOTOS>${listing.images.map((url) => `<URL>${xml(url)}</URL>`).join('')}</PHOTOS></AUCTION>`).join('')}</OKAZII>`;
}
