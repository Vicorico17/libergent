// Project-specific discovery document, not an A2A or OAuth declaration.
export function agentCapabilities(env = {}) {
  const integration = env.LIBERGENT_INTEGRATIONS_ENABLED === '1' && Boolean(env.INTEGRATION_GATEWAY);
  return {
    schemaVersion: '1', name: 'LiberGent', kind: 'website-agent-discovery',
    documentation: { index: '/llms.txt', full: '/llms-full.txt', openapi: '/api/v1/openapi.json', evidence: '/.well-known/site-evidence.json', guide: '/agents/index.md' },
    statusMeaning: 'Configured means runtime prerequisites are present, not that credentials or upstream marketplaces passed live acceptance.',
    capabilities: [
      { id: 'demo', method: 'GET', path: '/api/v1/demo', authentication: 'none', configured: true, simulated: true, readOnly: true },
      { id: 'sources', method: 'GET', path: '/api/v1/sources', authentication: 'none', configured: true, readOnly: true },
      { id: 'search', method: 'GET', path: '/api/v1/search', authentication: 'developer_bearer_key', configured: integration, readOnly: true, metering: 'Developer-key quota; separate from Premium search credits.' },
      { id: 'mcp', path: '/api/v1/mcp', transport: 'streamable-http', authentication: 'developer_bearer_key', configured: integration && env.LIBERGENT_AGENT_MCP_ENABLED === '1', tools: ['search_products', 'list_sources'], readOnly: true }
    ],
    unsupportedAgentActions: ['purchase', 'seller_contact', 'publish_listing', 'manage_account_keys', 'hosted_oauth'],
    resultVerification: { originalUrl: 'items[].url', source: 'items[].source', fetchedAt: 'searchedAt', expiresAt: 'expiresAt', partial: 'partial', perSourceStatus: 'sources[].status', detailStatus: 'items[].detailStatus', simulated: 'mode=test or simulated=true', limitations: 'Seller claims are not independently verified. Unknown availability and missing fields remain unknown. A successful HTTP response can contain partial results.' }
  };
}

export function handleAgentDiscovery(request, env = {}) {
  if (new URL(request.url).pathname !== '/.well-known/agent.json') return null;
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
  const body = JSON.stringify(agentCapabilities(env), null, 2);
  return new Response(request.method === 'HEAD' ? null : body, { headers: {
    'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
    'x-content-type-options': 'nosniff', link: '</llms.txt>; rel="describedby"'
  } });
}
