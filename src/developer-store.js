// Server-only persistence. Supabase clients have no table/RPC access to API key hashes.
export const STARTER_LIMITS = { live: { perMinute: 10, perDay: 200 }, test: { perMinute: 60, perDay: 1000 } };
export const API_SOURCES = ['olx.ro', 'publi24.ro', 'okazii.ro'];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function developerStoreEnabled(env) { return env.LIBERGENT_DEVELOPER_API_ENABLED === '1'; }
export function accountGatewayId(owner, mode) { return `dev_${owner}_${mode}`; }
export async function developerDb(path, { method = 'GET', body } = {}, env = {}) {
  const origin = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!origin || !secret) throw Error('developer_storage_unavailable');
  const response = await fetch(`${origin}/rest/v1/${path}`, {
    method, signal: AbortSignal.timeout(5000),
    headers: { apikey: secret, ...(secret.startsWith('sb_') ? {} : { authorization: `Bearer ${secret}` }), 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    if (result?.message === 'api_key_limit') throw Error('api_key_limit');
    if (result?.message === 'developer_account_disabled') throw Error('developer_account_disabled');
    throw Error('developer_storage_unavailable');
  }
  return result;
}
export async function lookupDeveloperKey(hash, env) {
  if (!developerStoreEnabled(env)) return null;
  const rows = await developerDb('rpc/lookup_developer_key', { method: 'POST', body: { p_hash: hash } }, env);
  const row = rows?.[0];
  if (!row) return null;
  return { id: accountGatewayId(row.owner_id, row.mode), scopes: row.scopes, sites: API_SOURCES,
    ...STARTER_LIMITS[row.mode], expiresAt: row.expires_at, mode: row.mode };
}
export function publicKeyMetadata(row) {
  return { id: row.id, name: row.name, prefix: row.prefix, mode: row.mode, scopes: row.scopes,
    createdAt: row.created_at, expiresAt: row.expires_at, revokedAt: row.revoked_at || null };
}
