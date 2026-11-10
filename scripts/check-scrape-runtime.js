// Exercises real workerd Durable Object transactions and restart persistence.
// Uses only local fixtures; never requests a marketplace or deploys resources.
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const modulePath = fileURLToPath(new URL('../src/scrape-coordinator.js', import.meta.url));
const output = await build({ stdin: { contents: `
export { ScrapeCoordinator } from ${JSON.stringify(modulePath)};
export default { fetch(request, env) { return env.COORDINATOR.get(env.COORDINATOR.idFromName('example.test')).fetch(request); } };
`, resolveDir: fileURLToPath(new URL('..', import.meta.url)) }, bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022' });
const directory = await mkdtemp(join(tmpdir(), 'libergent-scrape-'));
const options = {
  modules: true, script: output.outputFiles[0].text, compatibilityDate: '2026-03-13', compatibilityFlags: ['nodejs_compat'],
  durableObjects: { COORDINATOR: { className: 'ScrapeCoordinator', useSQLite: true } }, durableObjectsPersist: directory
};
let runtime;
const invoke = (path, body) => runtime.dispatchFetch(`https://test/${path}`, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) });
try {
  runtime = new Miniflare(options);
  const results = await Promise.all(Array.from({ length: 8 }, () => invoke('acquire')));
  assert.equal(results.filter(result => result.status === 200).length, 2);
  assert.equal(results.filter(result => result.status === 429).length, 6);
  for (const response of results.filter(result => result.ok)) await invoke('release', await response.json());
  assert.equal((await invoke('acquire')).status, 200);
  await invoke('cooldown', { delay: 60000 });
  await runtime.dispose();
  runtime = new Miniflare(options);
  assert.equal((await invoke('acquire')).status, 429);
  console.log('PASS: real workerd concurrent leases, release, SQLite storage, and cooldown across restart. No external traffic.');
} finally {
  if (runtime) await runtime.dispose();
  await rm(directory, { recursive: true, force: true });
}
