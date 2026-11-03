# Libergent connector owner trial

The owner trial uses an isolated, no-login MCP endpoint. It provides Free search
and read-only listing details. Free stays free. Premium search, account data,
seller contact and other write actions are unavailable until per-call billing
and the required customer identity checks are implemented.

## Endpoint

Deploy the `mcp-test` Wrangler environment. Cloudflare assigns its hostname based
on the account's Workers subdomain. The MCP URL will be:

```text
https://libergent-mcp-test.vic-cazacu.workers.dev/mcp
```

The worker returns 404 for all paths except `/mcp`. Disable the trial by setting
`LIBERGENT_MCP_ENABLED` to `0` or deleting the test worker.

## Add it to a client

Use the test URL above as a remote MCP connector in Claude and ChatGPT. Neither
client needs a Libergent login for this Free-only trial. In Claude, open Settings
→ Connectors → Add custom connector. In ChatGPT, add a custom MCP server from
the Plugins/apps interface. Availability and exact menu labels depend on the
client's current plan and workspace settings.

Available tools:

- `search_products`: Free marketplace search; returns Libergent's decisions,
  source coverage, price intelligence and listing links.
- `get_listing_details`: read details for a supported listing URL.
- `list_sources`: registered sources available to Free search.

The connector has per-IP and global request limits (40 requests/minute) and a
per-IP search limit (8 searches/minute). Cloudflare rate limits are approximate.
Search results are limited to 20 returned offers; each search asks the existing
Free search API for at most one page. No connector charge is applied.

## Review search traffic

Open Workers & Pages → `libergent-mcp-test` → Logs → Workers Logs in Cloudflare,
or run `npx wrangler tail --env mcp-test`. Filter for `libergent_mcp_usage`.
Search events include a request ID, query, outcome,
duration, cache hit, source coverage, failed sources and result count. Logs omit
caller IPs and authorization tokens. Set an appropriate log retention period in
Cloudflare before inviting anyone beyond the owner.

## Deployment checks

Before sharing the URL, confirm the MCP worker initializes and lists all three
tools, Free search returns results, non-MCP paths return 404, Premium is not
advertised, rate limits work, and the kill switch returns 404. Connect only the
owner's ChatGPT and Claude accounts during this trial.
