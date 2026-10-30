import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { IntegrationGateway, keyHash, handleIntegration } from './integration.js';
import { handleAgentMcp } from './agent-mcp.js';
import { executeSearchProducts } from '../examples/agents/search-tool.mjs';
import worker from './worker.js';

async function setup(t, overrides = {}) {
  const token = 'lg_test_agent001.' + 'd'.repeat(64);
  const config = { id: 'agent', keyHash: await keyHash(token), mode: 'test', scopes: ['search:read'], sites: ['olx.ro'], perMinute: 10, perDay: 100, expiresAt: '2099-01-01', ...overrides };
  const values = new Map(); let tail = Promise.resolve();
  const storage = { get: async k => values.get(k), put: async (k,v) => values.set(k, v), list: async ({ prefix }) => new Map([...values].filter(([k])=>k.startsWith(prefix))), delete: async keys => { for (const k of Array.isArray(keys) ? keys : [keys]) values.delete(k); }, transaction: fn => { const pending = tail.then(()=>fn(storage)); tail = pending.catch(()=>{}); return pending; } };
  const env = { LIBERGENT_AGENT_MCP_ENABLED: '1', LIBERGENT_INTEGRATIONS_ENABLED: '1', LIBERGENT_INTEGRATION_KEYS: JSON.stringify([config]) };
  const gateway = new IntegrationGateway({ storage }, env);
  gateway.search = () => { throw Error('Test keys must never invoke live search'); };
  env.INTEGRATION_GATEWAY = { idFromName: name => name, get: () => gateway };
  const client = new Client({ name: 'agent-test', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL('https://api.test/api/v1/mcp'), {
    requestInit: { headers: { authorization: `Bearer ${token}` } },
    fetch: (url, init) => worker.fetch(new Request(url, init), env)
  }));
  t.after(() => client.close());
  return { client, env, config, token, gateway, values };
}
test('agent MCP uses developer keys, advertises only read-only tools and shares REST cache', async t => {
  const { client, env, token, values } = await setup(t);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool=>tool.name), ['search_products','list_sources']);
  assert.ok(tools.every(tool=>tool.annotations.readOnlyHint));
  assert.ok(!JSON.stringify(tools).includes(token));
  const sources = await client.callTool({ name:'list_sources', arguments:{} });
  assert.deepEqual(sources.structuredContent.data.sources, [{ id:'olx.ro' }]);
  const rpc = await client.callTool({ name:'search_products', arguments:{ query:'bicicleta', limit:10 } });
  assert.equal(rpc.structuredContent.data.mode,'test'); assert.equal(rpc.structuredContent.data.cache.status,'miss');
  const rest = await handleIntegration(new Request('https://api.test/api/v1/search?q=bicicleta&limit=10', { headers:{ authorization:`Bearer ${token}` } }),env);
  const payload = await rest.json(); assert.equal(payload.cache.status,'hit');
  assert.deepEqual(payload.items,rpc.structuredContent.data.items); assert.equal(values.get('usage').dayCount,2);
});
test('agent calls cannot bypass scopes, limits or shared search quota', async t => {
  const { client, values } = await setup(t,{ perMinute:1 });
  assert.equal((await client.callTool({name:'search_products',arguments:{query:'phone',limit:21}})).isError,true);
  const forbidden = await client.callTool({name:'search_products',arguments:{query:'phone',details:true}});
  assert.equal(forbidden.isError,true); assert.equal(forbidden.structuredContent.data.httpStatus,403);
  assert.equal(values.get('usage'),undefined);
  await client.callTool({name:'search_products',arguments:{query:'phone'}});
  const exhausted = await client.callTool({name:'search_products',arguments:{query:'phone'}});
  assert.equal(exhausted.isError,true); assert.equal(exhausted.structuredContent.data.httpStatus,429);
  assert.ok(exhausted.structuredContent.data.retryAfterSeconds > 0);
});
test('agent transport rechecks revocation even after initialization', async t => {
  const { client, env, config } = await setup(t);
  env.LIBERGENT_INTEGRATION_KEYS = JSON.stringify([{...config,revoked:true}]);
  await assert.rejects(client.listTools());
});
test('agent transport has separate persistent protocol quota and rejects bad origins and oversized bodies', async t => {
  const { env, token, values, gateway } = await setup(t);
  const headers = { authorization:`Bearer ${token}`,'content-type':'application/json',accept:'application/json, text/event-stream' };
  const request = (extra={}) => new Request('https://api.test/api/v1/mcp',{method:'POST',headers:{...headers,...extra},body:'x'.repeat(65537)});
  assert.equal((await handleAgentMcp(request({origin:'https://evil.test'}),env)).status,403);
  assert.equal((await handleAgentMcp(request(),env)).status,413);
  values.set('mcp-usage',{minute:Math.floor(Date.now()/60000),minuteCount:120,day:Math.floor(Date.now()/86400000),dayCount:120});
  const limited = await handleAgentMcp(request(),env); assert.equal(limited.status,429); assert.ok(limited.headers.get('retry-after'));
  values.set('mcp-usage',{minute:0,minuteCount:0,day:Math.floor(Date.now()/86400000),dayCount:2000});
  const restarted = new IntegrationGateway({storage:gateway.state.storage},env);
  assert.equal((await restarted.fetch(new Request('https://gateway.internal/internal/mcp-admission',{method:'POST'}))).status,429);
  assert.equal((await handleIntegration(new Request('https://api.test/internal/mcp-admission'),env)).status,404);
});
test('new and legacy MCP remain independently disabled; keys required before discovery', async () => {
  assert.equal((await worker.fetch(new Request('https://api.test/api/v1/mcp'),{})).status,404);
  assert.equal((await worker.fetch(new Request('https://api.test/mcp'),{LIBERGENT_AGENT_MCP_ENABLED:'1'})).status,404);
  assert.equal((await handleAgentMcp(new Request('https://api.test/api/v1/mcp'),{LIBERGENT_AGENT_MCP_ENABLED:'1',LIBERGENT_INTEGRATIONS_ENABLED:'1'})).status,401);
});
test('framework-neutral agent tool passes keys only as headers and preserves retry guidance', async () => {
  const output = await executeSearchProducts({query:'iphone',limit:2},{apiKey:'server-key',origin:'https://api.test',fetcher:async (url,init)=>{
    assert.equal(url.pathname,'/api/v1/search'); assert.equal(init.headers.Authorization,'Bearer server-key'); assert.equal(url.searchParams.has('apiKey'),false);
    return Response.json({error:{code:'quota_exceeded'}},{status:429,headers:{'retry-after':'15'}});
  }});
  assert.equal(output.ok,false); assert.equal(output.retryAfterSeconds,15);
  await assert.rejects(executeSearchProducts({query:'x',limit:21}),/Invalid/);
});
