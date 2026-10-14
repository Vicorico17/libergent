// Server-only persistence. Every private query includes the authenticated owner.
export class SellingError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export const sellingConfigured = (env) => Boolean(env.SUPABASE_URL && (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY));
export function serviceHeaders(env) {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  return { apikey: key, ...(key?.startsWith('sb_') ? {} : { authorization: `Bearer ${key}` }) };
}
export async function store(env, table, query = '', method = 'GET', body, prefer = '') {
  if (!sellingConfigured(env)) throw new SellingError('Publicarea nu este configurată pe server.', 503);
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}${query ? `?${query}` : ''}`, {
    method, headers: { ...serviceHeaders(env), 'content-type': 'application/json', prefer: `return=representation${prefer ? `,${prefer}` : ''}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new SellingError('Nu am putut salva datele de publicare. Verifică configurarea bazei de date.', 503);
  return response.status === 204 ? [] : response.json();
}
export const ownerQuery = (userId) => `user_id=eq.${encodeURIComponent(userId)}`;
export const draftQuery = (userId, id) => `${ownerQuery(userId)}&id=eq.${encodeURIComponent(id)}`;
const encoder = new TextEncoder();
const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const bytes = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
async function encryptionKey(env) {
  if (!/^[a-f\d]{64}$/i.test(env.SELLING_ENCRYPTION_KEY || '')) throw new SellingError('Conectarea OLX nu este configurată.', 503);
  return crypto.subtle.importKey('raw', Uint8Array.from(env.SELLING_ENCRYPTION_KEY.match(/../g), (pair) => parseInt(pair, 16)), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function seal(value, owner, env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const result = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(owner) }, await encryptionKey(env), encoder.encode(JSON.stringify(value)));
  return `${b64(iv)}.${b64(new Uint8Array(result))}`;
}
export async function unseal(value, owner, env) {
  const [iv, ciphertext] = value.split('.');
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(iv), additionalData: encoder.encode(owner) }, await encryptionKey(env), bytes(ciphertext))));
}
export async function digest(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
