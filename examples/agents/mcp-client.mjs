// npm install @modelcontextprotocol/sdk
// Run on the agent host, never in frontend JavaScript or as a prompt containing a key.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const origin = process.env.LIBERGENT_API_ORIGIN;
const key = process.env.LIBERGENT_API_KEY;
if (!origin || !key) throw Error('Set LIBERGENT_API_ORIGIN and LIBERGENT_API_KEY in the agent server environment.');
const client = new Client({ name: 'my-shopping-agent', version: '1.0.0' });
try {
  await client.connect(new StreamableHTTPClientTransport(new URL('/api/v1/mcp', origin), {
    requestInit: { headers: { Authorization: `Bearer ${key}` } }
  }));
  const { tools } = await client.listTools();
  console.log('Available tools:', tools.map(tool => tool.name));
  // A model/tool loop can select this tool and supply these validated arguments.
  const result = await client.callTool({ name: 'search_products', arguments: { query: process.argv[2] || 'iphone 15', limit: 5 } }, undefined, { timeout: 45000 });
  if (result.isError) throw Error(JSON.stringify(result.structuredContent?.data || result.content));
  console.log(JSON.stringify(result.structuredContent.data, null, 2));
} finally { await client.close(); }
