import test from 'node:test';
import assert from 'node:assert/strict';
import { pageText, renderPageDocument, addDiscoveryLinks, artifactDigest, decodeHtml, PRIVATE_PAGE_ROUTES } from './agent-documents.js';
import { agentCapabilities, handleAgentDiscovery } from './agent-discovery.js';
import worker from './worker.js';

test('static text excludes scripts, navigation and embedded hydration data', () => {
  const html = '<html><head><title>Title</title><script>secret token</script></head><body><nav>Menu</nav><main><h1>Telefon</h1><p>Preț: 1.999 lei &amp; transport</p><script>self.__next_f.push(["account-secret"])</script></main><footer>Footer</footer></body></html>';
  assert.equal(pageText(html), 'Telefon\nPreț: 1.999 lei & transport');
  assert.equal(decodeHtml('&#x1f600; &#99999999;'), '😀 ');
});

test('every sensitive page publishes access guidance instead of rendered account data', () => {
  for (const route of PRIVATE_PAGE_ROUTES) {
    const text = renderPageDocument(route, '<title>LiberGent</title><body>private-key-123 wallet=900</body>', '2026-11-10T00:00:00Z');
    assert.doesNotMatch(text, /private-key-123|wallet=900/);
    assert.match(text, /excludes account data/);
  }
});

test('discovery injection is idempotent and scoped to the page', () => {
  const html = '<html><head><title>Search</title></head><body>Search</body></html>';
  const once = addDiscoveryLinks(html, '/search/');
  assert.equal(addDiscoveryLinks(once, '/search/'), once);
  assert.match(once, /href="\/search\/index.md"/);
  assert.match(once, /href="\/search\/llms.txt"/);
  assert.notEqual(artifactDigest('text'), artifactDigest('text changed'));
});

test('runtime discovery reflects flags and binding, never secrets or unsupported OAuth', async () => {
  assert.equal(agentCapabilities({}).capabilities.find(c => c.id === 'mcp').configured, false);
  const env = { LIBERGENT_INTEGRATIONS_ENABLED: '1', LIBERGENT_AGENT_MCP_ENABLED: '1', INTEGRATION_GATEWAY: {}, SUPABASE_SECRET_KEY: 'never-publish-me', LIBERGENT_INTEGRATION_KEYS: 'private-key-catalog' };
  const response = handleAgentDiscovery(new Request('https://example.test/.well-known/agent.json'), env);
  const text = await response.text();
  assert.doesNotMatch(text, /never-publish-me|private-key-catalog/);
  const body = JSON.parse(text);
  assert.equal(body.capabilities.find(c => c.id === 'mcp').configured, true);
  assert.ok(body.unsupportedAgentActions.includes('hosted_oauth'));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(handleAgentDiscovery(new Request('https://example.test/.well-known/agent.json', { method: 'POST' }), env).status, 405);
  assert.equal(await handleAgentDiscovery(new Request('https://example.test/.well-known/agent.json', { method: 'HEAD' }), env).text(), '');
});

test('Worker discovery needs no account and owner MCP trial stays isolated', async () => {
  const req = new Request('https://example.test/.well-known/agent.json');
  assert.equal((await worker.fetch(req, {})).status, 200);
  assert.equal((await worker.fetch(req, { LIBERGENT_MCP_TEST_MODE: '1' })).status, 404);
});
