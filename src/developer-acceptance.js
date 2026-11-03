// Opt-in account acceptance against an explicitly selected target. Never include
// server bodies, credentials or arbitrary thrown errors in operator output.
export class AcceptanceError extends Error {}
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function requireCheck(condition, message) { if (!condition) throw new AcceptanceError(message); }

export async function checkDeveloperAcceptance({ origin: input, sessionToken, secondSessionToken, fetcher = fetch }) {
  let target;
  try { target = new URL(input); } catch { throw new AcceptanceError('Supply a valid staging origin.'); }
  requireCheck(!target.username && !target.password && target.pathname === '/' && !target.search && !target.hash, 'Supply only the staging origin, without credentials, path or query.');
  requireCheck(target.protocol === 'https:' || (target.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)), 'Use HTTPS except for localhost.');
  requireCheck(typeof sessionToken === 'string' && Boolean(sessionToken.trim()), 'Configure the first verified staging account session locally.');
  requireCheck(!secondSessionToken || secondSessionToken !== sessionToken, 'Account isolation requires a different test account session.');
  const origin = target.origin;
  const passed = [];
  let keyId;
  let failure;
  let cleanupFailed = false;
  async function call(label, path, { method = 'GET', token = sessionToken, body } = {}) {
    try {
      const response = await fetcher(new URL(path, origin), {
        method, redirect: 'error', signal: AbortSignal.timeout(45000),
        headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      let data;
      try { data = await response.json(); }
      catch { throw new AcceptanceError(`${label}: target returned invalid JSON.`); }
      return { status: response.status, data };
    } catch (error) {
      if (error instanceof AcceptanceError) throw error;
      throw new AcceptanceError(`${label}: request failed; check connectivity and the target.`);
    }
  }
  try {
    const config = await call('Configuration', '/api/developer/config', { token: null });
    requireCheck(config.status === 200 && config.data?.available === true, 'Developer key management is not configured on this target.');
    passed.push('configuration');
    const created = await call('Create key', '/api/developer/keys', { method: 'POST', body: { name: `acceptance-${Date.now()}`, mode: 'test', scopes: ['search:read'] } });
    requireCheck(created.status === 201, 'Test key creation failed. Check account verification and key limits.');
    requireCheck(UUID.test(created.data?.key?.id || ''), 'Creation returned no valid key ID. Inspect the acceptance-* key in the account dashboard.');
    keyId = created.data.key.id;
    const token = created.data.token;
    requireCheck(typeof token === 'string' && /^lg_test_[a-f0-9]{32}\.[a-f0-9]{64}$/.test(token), 'Creation did not return a valid test key.');
    const listed = await call('List keys', '/api/developer/keys');
    requireCheck(listed.status === 200 && Array.isArray(listed.data?.keys) && listed.data.keys.some(key => key.id === keyId), 'Created key missing from account list.');
    requireCheck(!JSON.stringify(listed.data).includes(token) && listed.data.keys.every(key => !('key_hash' in key) && !('token' in key)), 'Account list exposed secret key material.');
    passed.push('key creation and private metadata');

    if (secondSessionToken) {
      const other = await call('Second account list', '/api/developer/keys', { token: secondSessionToken });
      requireCheck(other.status === 200 && Array.isArray(other.data?.keys), 'Second account session is invalid or key listing failed.');
      requireCheck(!other.data.keys.some(key => key.id === keyId), 'Second account can see the first account key; verify these are different accounts.');
      const forbidden = await call('Second account revocation', `/api/developer/keys/${keyId}`, { token: secondSessionToken, method: 'DELETE' });
      requireCheck(forbidden.status === 404, 'Second account revocation was not rejected.');
      passed.push('two-account isolation');
    }
    const initialUsage = await call('Initial usage', '/api/developer/usage');
    requireCheck(initialUsage.status === 200 && Number.isInteger(initialUsage.data?.usage?.test?.dayRequests), 'Initial usage is unavailable.');
    const searchPath = '/api/v1/search?q=iphone%2015&details=false&limit=2';
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await call('Test search', searchPath, { token });
      requireCheck(result.status === 200 && result.data?.mode === 'test' && result.data.simulated === true && Array.isArray(result.data.items), 'Test search did not return simulated results.');
      if (attempt === 1) requireCheck(result.data.cache?.status === 'hit', 'Repeated test search did not reuse the cached result.');
    }
    const scope = await call('Scope denial', '/api/v1/search?q=iphone%2015&details=true', { token });
    requireCheck(scope.status === 403, 'Search-only key was not denied listing enrichment.');
    const usage = await call('Usage', '/api/developer/usage');
    requireCheck(usage.status === 200 && usage.data?.usage?.test?.dayRequests >= initialUsage.data.usage.test.dayRequests + 2, 'Search and cache-hit usage were not recorded.');
    passed.push('simulated search, cache reuse, scope denial and usage');
    const revoked = await call('Revoke key', `/api/developer/keys/${keyId}`, { method: 'DELETE' });
    requireCheck(revoked.status === 200 && revoked.data?.revoked === true, 'Key revocation failed.');
    keyId = null;
    const denied = await call('Revoked access', searchPath, { token });
    requireCheck(denied.status === 401, 'Revoked key still has access.');
    passed.push('revocation and cached-access denial');
  } catch (error) {
    failure = error instanceof AcceptanceError ? error : new AcceptanceError('Acceptance check failed unexpectedly.');
  } finally {
    if (keyId) {
      try {
        const cleanup = await call('Cleanup', `/api/developer/keys/${keyId}`, { method: 'DELETE' });
        cleanupFailed = cleanup.status !== 200 || cleanup.data?.revoked !== true;
      } catch { cleanupFailed = true; }
    }
  }
  if (cleanupFailed) throw new AcceptanceError(`${failure?.message || 'Acceptance check failed.'} Cleanup failed: revoke the most recent acceptance-* key in the staging dashboard.`);
  if (failure) throw failure;
  return { passed, accountIsolation: secondSessionToken ? 'passed' : 'not tested: second account session not supplied' };
}
