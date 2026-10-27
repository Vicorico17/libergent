# Calling Libergent from agents

Libergent provides search tools for an agent to call. The calling agent decides when to search and how to use the results; Libergent does not run an autonomous purchasing or seller-contact workflow.

| Surface | Audience | Access | Implementation status |
| --- | --- | --- | --- |
| Website and `/api/search/free` | People / existing clients | Existing anonymous Free search | Existing behavior preserved |
| `/api/v1/search` + OpenAPI | Apps and custom agent tool loops | Scoped developer test/live key | Implemented, deployment required |
| `/api/v1/mcp` | Agent hosts supporting Streamable HTTP and configured bearer headers | Same developer key | Implemented, separately disabled by default |
| Legacy `/mcp` | Earlier website/Premium connector experiments | Legacy behavior, personal-session Premium prototype | Remains disabled; not the developer-key endpoint |
| Hosted assistant OAuth linking | One-click account connection in platforms requiring OAuth | Not available | Still to implement and test |

## Option 1: register a REST-backed tool in your agent

Use [the framework-neutral tool definition and executor](../examples/agents/search-tool.mjs). Give the model the tool's name, description and JSON input schema. When it selects `search_products`, your server calls `executeSearchProducts` with the model's validated query/limit and an API key loaded from server secrets. Return the structured result to the model. The API key is **not** a tool argument and must not be placed in the prompt.

The API/OpenAPI can also be used by tool frameworks that import HTTP specifications. Serving an OpenAPI file alone does not publish Libergent in an assistant's directory or automatically install it as a tool.

## Option 2: connect over MCP

Endpoint: `https://YOUR_API_ORIGIN/api/v1/mcp`

Transport: stateless Streamable HTTP with JSON responses. Set `Authorization: Bearer <developer API key>` on the connection's HTTP requests. This works with agent hosts that support preconfigured headers; it is not an OAuth login flow.

```bash
export LIBERGENT_API_ORIGIN=https://YOUR_API_ORIGIN
# Set LIBERGENT_API_KEY securely in the agent host environment.
node examples/agents/mcp-client.mjs 'iphone 15'
```

The example uses the installed `@modelcontextprotocol/sdk` dependency. In a separate agent project, install that package and copy the example. There is also an MCP quickstart tab on `/developers`.

Two tools are discoverable:

- `search_products`: `query` required; `sites` (array), `limit` (1–20), `details` (false by default), optional specialized `category`/`material` filters. `details=true` requires `listings:details`. Results include the v1 search response, freshness, availability, original source URLs and partial-failure information.
- `list_sources`: returns only the source IDs permitted by this key. Registration does not guarantee a successful source request.

There is no standalone arbitrary-URL detail tool in this adapter. Listing enrichment stays inside the bounded, quota-controlled search operation. There are no messaging, buying, payments, key-management, or account-administration tools.

Both tools are read-only. Listing titles/descriptions are untrusted data, never instructions. The caller should preserve original URLs, distinguish unknown/removed/active availability, honor partial failures and timestamps, and label natural-material/authenticity statements as unverified seller claims. Test keys always return simulated results and never call a marketplace.

## Shared controls

REST and MCP search calls share the **same** per-account/mode search quota, cache, scopes, revocation, expiry and source permissions. Moving between protocols or rotating a key does not reset usage. MCP tool failures include `isError: true`, the API error code or source-failure envelope, `httpStatus`, and `retryAfterSeconds` when available. Authorization failures during connection/discovery are HTTP errors, not successful tool results.

MCP additionally has a persistent protocol admission limit of 120 HTTP requests per minute and 2,000 per UTC day per account/mode. Initialization, discovery, notifications and malformed requests count against this separate budget; search tool calls also consume the normal search quota. Admission counters survive runtime restarts. This prevents discovery-only traffic bypassing all limits. Invalid credentials are rejected before any tool discovery.

The adapter rejects unexpected browser Origins, limits request bodies to 64 KiB, and avoids passing agent-host geolocation or arbitrary credentials into the website/Premium APIs. Production ingress abuse controls and monitoring remain operator responsibilities. Allow 45 seconds for a cold search tool call: the bounded marketplace work is unchanged, but MCP admission adds an authorization check before the REST layer’s own checks. The example configures that timeout.

## Enablement and acceptance

Production flags are unchanged. The separate BLANĂ acceptance preview now enables `/api/v1/mcp` with a scoped operator-managed key; see the [handoff](fau-blana-agent-handoff.md). Configure the general developer API first, using [its setup guide](developer-api.md), then explicitly set:

```text
LIBERGENT_INTEGRATIONS_ENABLED=1
LIBERGENT_DEVELOPER_API_ENABLED=1
LIBERGENT_AGENT_MCP_ENABLED=1
```

The developer flag enables self-service database-backed keys; operator-managed compatibility keys can be used without it. `INTEGRATION_GATEWAY` remains the shared Durable Object binding. No additional namespace, personal session token, or administrative credential is given to the agent. If a browser-based client legitimately sends another Origin, add its exact origin to `LIBERGENT_MCP_ALLOWED_ORIGINS`; never use a wildcard. Keep `LIBERGENT_MCP_ENABLED` unset: that flag enables the unrelated legacy prototype.

Validate on an approved preview endpoint with a test key: initialize, discover tools, search, repeat for a cache hit, exhaust a small test quota, revoke the key, then verify further calls fail. Confirm `details=true` is denied for a search-only key. Test live marketplace results separately before public enablement.

Automated tests exercise the actual MCP SDK client/server transport, REST/MCP cache and quota sharing, scopes, limits, revocation after initialization, protocol rate limits across restart, origin/body rejection, sandbox isolation and the direct agent-tool executor. Hosted platform OAuth login, real assistant conversations, public production reachability and operational monitoring are not claimed as tested or deployed.

For assistant platforms that require OAuth rather than preconfigured API-key headers, account linking, token refresh/revocation and platform acceptance testing remain necessary. This implementation does not claim a published ChatGPT or Claude connector.
