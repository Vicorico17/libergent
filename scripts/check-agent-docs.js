import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { artifactDigest } from '../src/agent-documents.js';
const out = new URL('../ui/out/', import.meta.url);
const origin = process.argv[2];
if (origin && !/^https?:\/\/[^/@]+\/?$/.test(origin)) throw new Error('Pass only an HTTP(S) origin without credentials or a path');
async function read(path) {
  if (!path.startsWith('/') || path.includes('..') || path.includes('\\') || path.startsWith('//')) throw new Error('Invalid artifact path');
  if (!origin) return fs.readFile(fileURLToPath(new URL(`.${path}`, out)), 'utf8');
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  const expectedType = path.endsWith('.md') ? 'text/markdown' : path.endsWith('.txt') ? 'text/plain' : path.endsWith('.json') || path.startsWith('/api/') ? 'application/json' : 'text/html';
  if (!response.headers.get('content-type')?.startsWith(expectedType)) throw new Error(`${path}: expected ${expectedType}`);
  return response.text();
}
const evidence = JSON.parse(await read('/.well-known/site-evidence.json'));
if (!Array.isArray(evidence.artifacts) || evidence.artifacts.length > 200 || !Array.isArray(evidence.pages) || evidence.pages.length > 80) throw new Error('Invalid evidence manifest');
for (const artifact of evidence.artifacts) {
  const body = await read(artifact.path);
  if (artifactDigest(body) !== artifact.sha256 || Buffer.byteLength(body) !== artifact.bytes) throw new Error(`Integrity mismatch: ${artifact.path}`);
}
for (const page of evidence.pages) {
  const html = await read(origin ? page.path : `${page.path}index.html`);
  if (!html.includes(`href="${page.markdown}"`) || !html.includes(`href="${page.llms}"`)) throw new Error(`Missing discovery links: ${page.path}`);
  if (!evidence.artifacts.some(entry => entry.path === page.markdown) || !evidence.artifacts.some(entry => entry.path === page.llms)) throw new Error(`Missing page documents: ${page.path}`);
}
if (origin) {
  const manifest = JSON.parse(await read('/.well-known/agent.json'));
  if (manifest.schemaVersion !== '1' || !Array.isArray(manifest.capabilities)) throw new Error('Invalid runtime discovery');
  const demo = JSON.parse(await read('/api/v1/demo'));
  if (demo.mode !== 'test' && demo.simulated !== true) throw new Error('Public demo must explicitly be simulated');
}
console.log(`PASS: ${evidence.pages.length} pages, ${evidence.artifacts.length} artifact hashes and discovery links${origin ? ', runtime discovery and simulated demo' : ''}. Integrity is not live marketplace verification.`);
