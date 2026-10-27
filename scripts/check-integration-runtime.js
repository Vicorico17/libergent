// Local workerd smoke test; no external requests or deployed resources.
// esbuild and Miniflare are supplied by the locked Wrangler dev dependency.
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const modulePath = fileURLToPath(new URL('../src/integration.js', import.meta.url));
const output = await build({ stdin: { contents: `
import { IntegrationGateway as Base, handleIntegration } from ${JSON.stringify(modulePath)};
export class IntegrationGateway extends Base {
  async search() {
    return { apiVersion: '1', searchedAt: new Date().toISOString(), expiresAt: new Date(Date.now()+900000).toISOString(), sources: [{ status: 'ok', source: 'olx.ro' }], items: [] };
  }
}
export default { fetch: handleIntegration };
`, resolveDir: fileURLToPath(new URL('..', import.meta.url)) }, bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022' });
const directory = await mkdtemp(join(tmpdir(), 'libergent-integration-'));
const token = `lg_runtime01.${randomBytes(32).toString('base64url')}`;
const options = {
  modules: true, script: output.outputFiles[0].text, compatibilityDate: '2026-03-13', compatibilityFlags: ['nodejs_compat'],
  durableObjects: { INTEGRATION_GATEWAY: { className: 'IntegrationGateway', useSQLite: true } },
  durableObjectsPersist: directory,
  bindings: { LIBERGENT_INTEGRATIONS_ENABLED: '1', LIBERGENT_INTEGRATION_KEYS: JSON.stringify([{
    id: 'runtime', keyHash: createHash('sha256').update(token).digest('hex'), expiresAt: '2099-01-01T00:00:00Z', scopes: ['search:read'], sites: ['olx.ro'], perMinute: 100, perDay: 3
  }]) }
};
let runtime;
try {
  runtime = new Miniflare(options);
  const url = 'https://integration.test/api/integrations/v1/search?q=haina+blana&details=false';
  const init = { headers: { authorization: `Bearer ${token}` } };
  assert.equal((await runtime.dispatchFetch(url)).status, 401);
  const first = await runtime.dispatchFetch(url, init);
  assert.equal(first.status, 200); assert.equal((await first.json()).cache.status, 'miss');
  const second = await runtime.dispatchFetch(url, init);
  assert.equal((await second.json()).cache.status, 'hit');
  await runtime.dispose();
  runtime = new Miniflare(options);
  const restored = await runtime.dispatchFetch(url, init);
  assert.equal((await restored.json()).cache.status, 'hit');
  assert.equal((await runtime.dispatchFetch(url, init)).status, 429);
  console.log('PASS: workerd authentication, SQLite transactions, cache persistence, and quota across restart. Search is a fixture; no marketplace request was made.');
} finally {
  if (runtime) await runtime.dispose();
  await rm(directory, { recursive: true, force: true });
}
