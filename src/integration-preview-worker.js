// Isolated integration acceptance target. No website, account routes, cron or production bindings.
import { handleIntegration } from './integration.js';
import { handleAgentMcp } from './agent-mcp.js';
import { handleApiReference } from './developer-reference.js';
export { IntegrationGateway } from './integration.js';
export default {
  fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/api/v1/search') return handleIntegration(request, env);
    if (path === '/api/v1/mcp') return handleAgentMcp(request, env);
    if (['/api/v1/demo', '/api/v1/sources', '/api/v1/openapi.json'].includes(path)) return handleApiReference(request);
    return Response.json({ error: { code: 'not_found' } }, { status: 404 });
  }
};
