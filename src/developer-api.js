import { keyHash } from './integration.js';
import { developerDb, publicKeyMetadata, developerStoreEnabled, accountGatewayId, STARTER_LIMITS, UUID } from './developer-store.js';
const json = (data, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
const fail = (code, status) => json({ error: { code } }, status);

export async function authenticateDeveloper(request, env) {
  const bearer = request.headers.get('authorization');
  if (!/^Bearer \S+$/.test(bearer || '')) return { response: fail('authentication_required', 401) };
  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const apiKey = env.SUPABASE_ANON_KEY || env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !apiKey) return { response: fail('authentication_unavailable', 503) };
  try {
    const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: apiKey, authorization: bearer }, signal: AbortSignal.timeout(5000) });
    if (response.status >= 500 || response.status === 429) return { response: fail('authentication_unavailable', 503) };
    const user = await response.json().catch(() => null);
    if (!response.ok || !UUID.test(user?.id || '')) return { response: fail('invalid_session', 401) };
    if (user.is_anonymous || !user.email_confirmed_at) return { response: fail('verified_email_required', 403) };
    return { user };
  } catch { return { response: fail('authentication_unavailable', 503) }; }
}
async function smallJson(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw Error('invalid_request');
  const reader = request.body?.getReader(); if (!reader) throw Error('invalid_request');
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length; if (size > 4096) throw Error('invalid_request'); chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw Error('invalid_request'); }
}
export function validateKeyInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['name', 'mode', 'scopes'].includes(k))) throw Error('invalid_request');
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const mode = body.mode || 'test';
  const scopes = body.scopes || ['search:read'];
  if (!name || name.length > 60 || /[\x00-\x1f]/.test(name) || !['test', 'live'].includes(mode)
    || !Array.isArray(scopes) || !scopes.includes('search:read') || scopes.some(s => !['search:read', 'listings:details'].includes(s))) throw Error('invalid_request');
  return { name, mode, scopes: [...new Set(scopes)] };
}
export async function handleDeveloper(request, env, deps = {}) {
  if (new URL(request.url).pathname.replace(/\/$/, '') === '/api/developer/config') {
    if (request.method !== 'GET') return fail('method_not_allowed', 405);
    return json({ available: developerStoreEnabled(env) && env.LIBERGENT_INTEGRATIONS_ENABLED === '1'
      && Boolean(env.SUPABASE_URL && (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY) && env.INTEGRATION_GATEWAY) });
  }
  if (!developerStoreEnabled(env) || env.LIBERGENT_INTEGRATIONS_ENABLED !== '1') return fail('developer_api_unavailable', 503);
  const path = new URL(request.url).pathname.replace(/\/$/, '');
  const isKeys = path === '/api/developer/keys';
  const revokeId = path.match(/^\/api\/developer\/keys\/([0-9a-f-]+)$/i)?.[1];
  const isUsage = path === '/api/developer/usage';
  if (!isKeys && !isUsage && !revokeId) return fail('not_found', 404);
  if (!(isKeys && ['GET', 'POST'].includes(request.method)) && !(isUsage && request.method === 'GET') && !(revokeId && UUID.test(revokeId) && request.method === 'DELETE')) return fail('method_not_allowed', 405);
  const auth = await (deps.authenticate || authenticateDeveloper)(request, env);
  if (auth.response) return auth.response;
  const db = deps.db || developerDb;
  const owner = auth.user.id;
  try {
    if (isUsage) {
      if (!env.INTEGRATION_GATEWAY) return fail('storage_unavailable', 503);
      const usage = {};
      for (const mode of ['test', 'live']) {
        const stub = env.INTEGRATION_GATEWAY.get(env.INTEGRATION_GATEWAY.idFromName(accountGatewayId(owner, mode)));
        // This path is only reachable through the binding, never the public API router.
        const response = await stub.fetch(new Request('https://gateway.internal/internal/usage'));
        if (!response.ok) throw Error('developer_storage_unavailable');
        usage[mode] = { ...await response.json(), limits: STARTER_LIMITS[mode] };
      }
      return json({ usage });
    }
    if (request.method === 'GET') {
      const rows = await db(`developer_api_keys?owner_id=eq.${owner}&select=id,name,prefix,mode,scopes,created_at,expires_at,revoked_at&order=revoked_at.asc.nullsfirst,expires_at.desc&limit=100`, {}, env);
      return json({ keys: rows.map(publicKeyMetadata), limits: STARTER_LIMITS, maxActiveKeys: 5 });
    }
    if (request.method === 'DELETE') {
      const result = await db('rpc/revoke_developer_key', { method: 'POST', body: { p_owner: owner, p_id: revokeId } }, env);
      return result === true ? json({ revoked: true }) : fail('not_found', 404);
    }
    if (!env.INTEGRATION_GATEWAY) return fail('storage_unavailable', 503);
    const input = validateKeyInput(await smallJson(request));
    const id = crypto.randomUUID();
    const prefix = `lg_${input.mode}_${id.replaceAll('-', '')}`;
    const secret = [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, '0')).join('');
    const token = `${prefix}.${secret}`;
    const rows = await db('rpc/create_developer_key', { method: 'POST', body: {
      p_owner: owner, p_id: id, p_name: input.name, p_mode: input.mode, p_scopes: input.scopes, p_prefix: prefix, p_hash: await keyHash(token)
    } }, env);
    return json({ key: publicKeyMetadata(rows[0]), token, notice: 'Copy this key now. It will not be shown again.' }, 201);
  } catch (error) {
    const code = error.message;
    if (code === 'invalid_request') return fail(code, 400);
    if (code === 'api_key_limit') return fail(code, 429);
    if (code === 'developer_account_disabled') return fail(code, 403);
    return fail('developer_storage_unavailable', 503);
  }
}
