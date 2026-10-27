import test from 'node:test';
import assert from 'node:assert/strict';
import preview from './integration-preview-worker.js';
test('preview exposes only integration surfaces and requires keys for live search/MCP', async () => {
  const env = { LIBERGENT_INTEGRATIONS_ENABLED: '1', LIBERGENT_AGENT_MCP_ENABLED: '1' };
  for (const path of ['/api/v1/search?q=phone', '/api/v1/mcp']) assert.equal((await preview.fetch(new Request('https://preview.test'+path),env)).status,401);
  for (const path of ['/api/search/free?q=phone','/api/developer/keys','/api/whatsapp/send','/mcp','/']) assert.equal((await preview.fetch(new Request('https://preview.test'+path),env)).status,404);
  const sample = await (await preview.fetch(new Request('https://preview.test/api/v1/demo'),env)).json();
  assert.equal(sample.mode,'test'); assert.equal(sample.simulated,true);
});
