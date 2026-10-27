import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const target = new URL(process.argv[2] || "http://127.0.0.1:8787/mcp");
const client = new Client({ name: "libergent-smoke-check", version: "1.0.0" });
try {
  await client.connect(new StreamableHTTPClientTransport(target));
  const { tools } = await client.listTools();
  const expected = ["search_products", "get_listing_details", "list_sources"];
  for (const name of expected) {
    if (!tools.some((tool) => tool.name === name)) throw new Error(`Missing tool: ${name}`);
  }
  const result = await client.callTool({ name: "list_sources", arguments: {} });
  if (result.isError || !result.structuredContent?.data?.sources?.length) throw new Error("Source discovery failed");
  console.log(`MCP connected: ${target.origin}${target.pathname}`);
  console.log(`Tools: ${tools.map((tool) => tool.name).join(", ")}`);
  console.log(`Free sources: ${result.structuredContent.data.sources.length}`);
} catch (error) {
  console.error(`MCP check failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.close();
}
