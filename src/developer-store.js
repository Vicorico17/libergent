// Service-role-only persistence. Never store or return a plaintext API key.
export class DeveloperError extends Error {
  constructor(code, status = 503, retryAfter) {
    super(code);
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function developerConfigured(env) {
  return env.LIBERGENT_DEVELOPER_API_ENABLED === "1" && Boolean(env.SUPABASE_URL && (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY));
}

export async function hashDeveloperKey(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function generateDeveloperKey(mode) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const secret = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  const token = `lg_${mode}_${secret}`;
  return { token, hash: await hashDeveloperKey(token), prefix: token.slice(0, 16) };
}

async function rest(env, path, { method = "GET", body } = {}) {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env.SUPABASE_URL || !key) throw new DeveloperError("developer_storage_unavailable");
  const headers = { apikey: key, "content-type": "application/json", prefer: "return=representation" };
  if (!key.startsWith("sb_")) headers.authorization = `Bearer ${key}`;
  try {
    const response = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/${path}`, {
      method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error("Storage request failed");
    return await response.json();
  } catch {
    throw new DeveloperError("developer_storage_unavailable");
  }
}

function unwrap(result) {
  if (!result || typeof result !== "object") throw new DeveloperError("developer_storage_unavailable");
  if (result.error) {
    const status = { invalid_api_key: 401, insufficient_scope: 403, developer_account_disabled: 403, api_key_limit: 409, quota_exceeded: 429 }[result.error] || 503;
    throw new DeveloperError(result.error, status, result.retryAfter);
  }
  return result;
}

export function publicDeveloperKey(row) {
  return { id: row.id, name: row.name, prefix: row.prefix, mode: row.mode, scopes: row.scopes, expiresAt: row.expires_at, revokedAt: row.revoked_at };
}

const fields = "id,name,prefix,mode,scopes,expires_at,revoked_at";
export function createDeveloperStore(env) {
  return {
    async create(userId, input) {
      const generated = await generateDeveloperKey(input.mode);
      const result = unwrap(await rest(env, "rpc/create_developer_key", { method: "POST", body: {
        p_user_id: userId, p_name: input.name, p_mode: input.mode, p_hash: generated.hash, p_prefix: generated.prefix
      } }));
      return { key: publicDeveloperKey(result.key), token: generated.token };
    },
    async list(userId) {
      const rows = await rest(env, `developer_api_keys?user_id=eq.${encodeURIComponent(userId)}&select=${fields}&order=created_at.desc&limit=100`);
      return rows.map(publicDeveloperKey);
    },
    async revoke(userId, id) {
      const rows = await rest(env, `developer_api_keys?user_id=eq.${encodeURIComponent(userId)}&id=eq.${encodeURIComponent(id)}&select=${fields}`, {
        method: "PATCH", body: { revoked_at: new Date().toISOString() }
      });
      if (!rows.length) throw new DeveloperError("key_not_found", 404);
      return publicDeveloperKey(rows[0]);
    },
    async usage(userId) {
      return unwrap(await rest(env, "rpc/developer_usage", { method: "POST", body: { p_user_id: userId } }));
    },
    async consume(token) {
      if (!/^lg_(test|live)_[a-f0-9]{64}$/.test(token)) throw new DeveloperError("invalid_api_key", 401);
      return unwrap(await rest(env, "rpc/consume_developer_request", { method: "POST", body: { p_hash: await hashDeveloperKey(token) } }));
    }
  };
}
