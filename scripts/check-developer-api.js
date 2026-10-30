// Opt-in staging acceptance. Creates one test key and revokes it in cleanup.
// Credentials come from the environment and never appear in output or argv.
import assert from 'node:assert/strict';
const argument = process.argv[2];
if (!argument || argument === '--help') {
  console.log('Usage: LIBERGENT_ACCEPTANCE_SESSION_TOKEN=<verified-session> npm run check:developer-api -- https://YOUR-STAGING-HOST');
  console.log('Creates and revokes one test key. No marketplace searches or database migrations.');
  process.exit(argument === '--help' ? 0 : 1);
}
let keyId;
let origin;
const session = process.env.LIBERGENT_ACCEPTANCE_SESSION_TOKEN;
async function call(path, { method = 'GET', token = session, body } = {}) {
  const response = await fetch(new URL(path, origin), {
    method, redirect: 'error', signal: AbortSignal.timeout(45000),
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return { status: response.status, data: await response.json() };
}
function expect(value, message) { if (!value) throw Error(message); }
try {
  const target = new URL(argument);
  expect(!target.username && !target.password && target.pathname === '/' && !target.search && !target.hash, 'Supply only the staging origin.');
  expect(target.protocol === 'https:' || (target.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)), 'Use HTTPS except for localhost.');
  origin = target.origin;
  expect(Boolean(session), 'Set LIBERGENT_ACCEPTANCE_SESSION_TOKEN to a verified staging account session.');
  const config = await call('/api/developer/config', { token: null });
  expect(config.status === 200 && config.data.available, 'Developer key management is not configured on this target.');
  const created = await call('/api/developer/keys', { method: 'POST', body: { name: `acceptance-${Date.now()}`, mode: 'test', scopes: ['search:read'] } });
  expect(created.status === 201, 'Test key creation failed. Check account verification and key limits.');
  keyId = created.data.key?.id;
  expect(typeof keyId === 'string' && /^[0-9a-f-]{36}$/i.test(keyId), 'Creation did not return a valid key ID; inspect the account key list.');
  const token = created.data.token;
  expect(typeof token === 'string' && token.startsWith('lg_test_'), 'Creation did not return a test key.');
  const listed = await call('/api/developer/keys');
  expect(listed.status === 200 && listed.data.keys.some(key => key.id === keyId), 'Created key missing from account list.');
  expect(!JSON.stringify(listed.data).includes(token), 'Account list exposed the plaintext key.');
  const result = await call('/api/v1/search?q=iphone%2015&details=false&limit=2', { token });
  expect(result.status === 200 && result.data.mode === 'test' && result.data.simulated === true, 'Test search did not return simulated results.');
  assert.ok(Array.isArray(result.data.items), 'Search items missing.');
  const usage = await call('/api/developer/usage');
  expect(usage.status === 200 && usage.data.usage?.test?.dayRequests >= 1, 'Test usage was not recorded.');
  const revoked = await call(`/api/developer/keys/${keyId}`, { method: 'DELETE' });
  expect(revoked.status === 200, 'Key revocation failed.');
  keyId = null;
  const denied = await call('/api/v1/search?q=iphone%2015&details=false', { token });
  expect(denied.status === 401, 'Revoked key still has access.');
  console.log('PASS: staging account authentication, key creation/listing, simulated search, usage, revocation and access denial.');
} catch (error) {
  // Do not print HTTP bodies, fetch errors, tokens or key values.
  console.error(error instanceof assert.AssertionError ? 'FAIL: response contract mismatch.' : `FAIL: ${error.name === 'TypeError' ? 'Request failed; check the staging origin and connectivity.' : error.message}`);
  process.exitCode = 1;
} finally {
  if (keyId && origin && session) {
    try {
      const cleanup = await call(`/api/developer/keys/${keyId}`, { method: 'DELETE' });
      if (cleanup.status !== 200) throw Error();
      console.log('Temporary test key revoked during cleanup.');
    } catch {
      console.error('Cleanup failed. Revoke the most recent acceptance-* key from the staging account dashboard.');
      process.exitCode = 1;
    }
  }
}
