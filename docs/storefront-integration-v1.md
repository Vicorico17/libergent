# Listing contract v1 — optional BLANĂ filters

The general platform and self-service onboarding are documented in [Developer API](developer-api.md). `/api/v1/search` is the canonical endpoint, with `details=false` by default. The original `/api/integrations/v1/search` path remains compatible, including its `details=true` default. Fur filtering is optional; all supported product queries work without it.

Status: implemented on a feature branch; production deployment and credential provisioning are intentionally not performed. Search uses scoped API keys, independent of personal Supabase sessions and Premium entitlement. Self-service key management uses the existing signed-in account; personal sessions are never shared with API consumers. The existing anonymous `/api/search/free`, website, Premium search, and disabled MCP transport retain their behavior.

## Contract

`GET /api/integrations/v1/search` with `Authorization: Bearer <integration key>`.
Responses include `apiVersion: "1"`; additive fields may be introduced, breaking changes require a new URL version. Credentials are never query parameters. No CORS browser integration is provided: call from the storefront server.

| Parameter | Default | Allowed |
| --- | --- | --- |
| `q` | required | Public search policy, 1–120 characters |
| `sites` | `olx.ro` | Comma-separated subset of credential's sources; initial adapters: `olx.ro,publi24.ro,okazii.ro` |
| `limit` | `20` | Integer 1–20, applied after filtering |
| `category` | `any` | `any`, `full_fur_coat` |
| `material` | `any` | `any`, `natural`, `synthetic`, `unknown` |
| `details` | `true` | `true`, `false`; true requires `listings:details` |

Unknown/repeated parameters are rejected. There is no client-controlled provider, pagination, cache bypass, arbitrary detail URL, Premium/browser mode, or seller-contact operation. Each source searches one page using the existing `runSearch` engine and parser. At most 20 candidates across sources are enriched, in source order (sorted by domain); this is a bounded catalog sample, not an exhaustive inventory or a new deal ranking. Existing website ranking is unchanged.

```bash
curl --fail-with-body --get "$LIBERGENT_API_ORIGIN/api/integrations/v1/search" \
  -H "Authorization: Bearer $LIBERGENT_INTEGRATION_KEY" \
  --data-urlencode 'q=haina blana' \
  --data-urlencode 'sites=olx.ro' \
  --data-urlencode 'category=full_fur_coat' \
  --data-urlencode 'material=natural' \
  --data-urlencode 'details=true' --data-urlencode 'limit=20'
```

Search response:

```json
{
  "apiVersion": "1",
  "searchedAt": "2026-10-27T09:00:00.000Z",
  "expiresAt": "2026-10-27T09:15:00.000Z",
  "cache": { "status": "miss", "ageSeconds": 0 },
  "partial": false,
  "sources": [{ "source": "olx.ro", "status": "ok", "candidateCount": 10 }],
  "inspectedCount": 10,
  "items": []
}
```

Every item has these fields (missing scalar information is `null`, collections are `[]`):

| Field | Meaning/type |
| --- | --- |
| `url`, `source`, `title` | Original listing URL, source domain, seller title |
| `price`, `currency` | Source price: number when structured detail supplies it, otherwise original search-card price string; currency string or null. No guessed currency/conversion |
| `location`, `condition`, `description` | Listing text or null |
| `mainImage`, `galleryImages` | Image object or null, array of additional unique images. Each object has `url`, `sourceUrl`, `provenance: "original_listing"` |
| `size`, `measurements`, `material` | Values from labeled listing attributes or null; not inferred from photos |
| `attributes` | Source `{label,value}` pairs |
| `availability` | `active` only on structured `InStock`; `removed` on HTTP 404/410; otherwise `unknown` |
| `lastVerifiedAt` | Time detail URL was successfully parsed as a product, or returned 404/410; null on absent/failed detail verification. A cached response preserves the original timestamp |
| `detailStatus` | `verified`, `unavailable`, `not_requested` |
| `classification` | `category`, `material`, `evidence`, `independentlyVerified: false`, `age: null`, `authenticity: null` |

Classification categories are `full_fur_coat`, `fur_trim_only_or_ambiguous`, `accessory`, `unknown`. Material is `natural`, `synthetic`, or `unknown`. Each evidence entry contains `field`, `rule`, a supporting listing `text` excerpt, and `basis: "seller_claim"`. Romanian, French and English text rules are deliberately conservative. A coat mentioning collar/hood fur is excluded from a strict full-coat request, even if that causes false negatives. Vests and accessories are excluded. Negations and conflicting synthetic/natural signals produce unknown material. Unsupported languages and ambiguous items need human review. This is not authenticated material testing; “natural” is a seller claim, never proof of genuine, vintage, premium, or species authenticity. No photo analysis or replacement imagery is used.

Search cards alone do not prove active availability. Detail extraction reuses the existing structured-data parser, includes Product size/material and additional properties, and can only supply gallery/measurements when the source publishes parseable data. A successful empty search is not evidence that previously observed items were removed. BLANĂ must retain prior items separately if it needs longitudinal inventory reconciliation; this version does not proactively reverify disappeared cards.

## Failure and freshness behavior

All-source failure returns HTTP 502 with the same search envelope and per-source safe error codes. Partial source/detail failure returns 200 with `partial: true`; usable cards survive detail failures. Empty filtered results are a valid 200. Source failure codes: `timeout`, `source_unavailable`. Other errors use `{ "apiVersion":"1", "error":{"code":"..."} }`: 400 invalid parameters; 401 missing/invalid/revoked/expired credentials; 403 missing scope; 404 disabled route; 405 wrong method; 429 quota/busy with Retry-After; 503 configuration/storage/service failure. Internal exception strings and credentials are not returned.

Search fetches have an 8-second deadline, followed by a 12-second total detail budget (3 concurrent detail requests, 3 seconds each, 2 MiB body cap). Marketplace I/O is bounded to approximately 20 seconds plus parsing/storage overhead. Self-service keys also require two database authorization checks with a 5-second deadline each; use a 35-second client timeout. Abort signals propagate to the existing direct parser; response deadlines also handle noncooperative dependencies. Detail redirects are rejected to prevent leaving the allowed hosts. Slow/challenged detail pages become unavailable, not active.

A Durable Object per integration stores counters and 15-minute snapshots; fixed UTC minute/day windows count every valid authorized request including hits, coalesced requests, busy rejections, and source failures. Invalid parameters/authentication do not consume search quota. Daily rollover is midnight UTC. At most two distinct searches run per integration; identical concurrent requests coalesce. Up to 32 cached query variants are retained, with expired/oldest eviction. All-source failures and payloads exceeding 120,000 serialized UTF-8 bytes are not cached (protecting storage value limits). Partial results can be cached and are labeled. Cache status is `hit`, `miss`, or `coalesced`; cached verification timestamps never advance. There is no cross-integration cache/credential sharing. Storage failure fails closed.

The [BLANĂ Vercel example](../examples/blana/api/catalog.mjs) uses a fixed server-owned request and Vercel CDN caching, capped by the upstream expiry. Browsers call `/api/catalog`; they never receive the integration key. Render unknown availability visibly and label material as a seller claim in French/English. The example omits removed listings and preserves provenance. It has not been installed or deployed in BLANĂ.

## Credentials and deployment (operator steps, not executed)

Cloudflare runtime bindings/settings:

- `INTEGRATION_GATEWAY`: Durable Object binding to exported `IntegrationGateway`; SQLite migration tag `integration-gateway-v1` is included in `wrangler.toml`.
- `LIBERGENT_INTEGRATIONS_ENABLED=1`: explicit opt-in. Unset/other values keep route at 404.
- `LIBERGENT_INTEGRATION_KEYS`: optional operator-managed secret JSON array; ordinary developers use self-service keys instead. Each record requires `id`, `keyHash`, `scopes`, `sites`, positive integer `perMinute`, positive integer `perDay`, ISO `expiresAt`; optional boolean `revoked`.
- No new Supabase, administrator, Browser Run, model, or personal session credentials are required.

Example configuration shape (placeholder hash, not a usable credential):

```json
[{
  "id": "blana",
  "keyHash": "SHA256_HEX_OF_ENTIRE_TOKEN",
  "scopes": ["search:read", "listings:details"],
  "sites": ["olx.ro"],
  "perMinute": 10,
  "perDay": 200,
  "expiresAt": "2027-01-01T00:00:00Z",
  "revoked": false
}]
```

Generate a random key in a trusted terminal/password manager, never in source control, chat, or browser code. Required format: `lg_<8–64 URL-safe identifier characters>.<32–128 URL-safe random characters>`. Use at least 32 cryptographically random bytes for the secret. Hash the **entire** token with SHA-256; only that lowercase hex hash goes to Libergent. Transfer the raw key to BLANĂ's encrypted server environment. Keep a stable integration `id` during key rotation so quotas/cache are shared. Add the new hash, move the consumer, then remove or set `revoked:true` on the old record. Revocation is checked on each request before cache access once the updated secret is deployed; an already-running request may complete.

1. Review/merge the PR only when deployment is authorized: this repository deploys production automatically on pushes to `main`. This task does not merge it.
2. Validate locally with `npm run check` and `npx wrangler deploy --dry-run`. Use `npm run dev:worker` for integration storage; the plain Node server cannot emulate Durable Objects and fails closed with 503 if enabled without the binding.
3. Prefer a separately configured preview Worker with its own Durable Object namespace and test credentials. Deploy the included migration/binding and existing UI assets with the project's usual deployment process. Do not remove the migration tag on subsequent deployments.
4. Provision the complete key array via `npx wrangler secret put LIBERGENT_INTEGRATION_KEYS`. Explicitly enable via `npx wrangler secret put LIBERGENT_INTEGRATIONS_ENABLED` (value `1`). Configure preview resources separately; no production settings were changed here.
5. Run the curl above, repeat to confirm cache hit and unchanged timestamps, exhaust a small test quota, revoke a test key, and verify rejection. Confirm Free search and MCP remain unchanged.
6. In BLANĂ's Vercel project configure server-only `LIBERGENT_API_ORIGIN` (approved HTTPS Libergent origin) and `LIBERGENT_INTEGRATION_KEY` (raw scoped key). Copy the example into a compatible Node Functions project, or adapt its handler to BLANĂ's framework server route. No `NEXT_PUBLIC_` prefix. Deploy through BLANĂ's normal reviewed pipeline; validate CDN caching and browser network requests contain no secret.
7. Rollback: unset/disable `LIBERGENT_INTEGRATIONS_ENABLED` or revoke BLANĂ's key. Keep the Durable Object migration/storage in place. Public Free search does not depend on this binding.

The existing CI deployment requires `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; this change does not alter those requirements. Existing mock flags should be off for live acceptance. Integration uses the direct engine, not mocked app aggregation.

## Scheduled refresh / asynchronous work assessment

The repository already has a minutely Worker cron for discovery and hourly Premium alert work; integration refreshes are not inserted into those jobs. For the first consumer, fixed-query gateway/CDN caching removes searches from most visitor requests. The first miss can still take about 20 seconds. An operator can later schedule an authenticated server request every 15 minutes to warm the exact query; those requests consume the same quota. No scheduler has been enabled. Durable Object alarms or a Queue-backed refresh job with persisted last-good snapshots and a pollable job ID are the next step if measured cold latency or stale-on-error requirements warrant it. This version has no background inventory crawl, guaranteed refresh SLA, or stale-last-good fallback.

## MCP assessment

`src/mcp.js` explicitly returns 404 unless `LIBERGENT_MCP_ENABLED === "1"`. The checked-in Worker configuration does not set it. This explains the reported live response consistently with the documented default; live secret configuration has not been inspected, so deployment drift cannot be ruled out. No MCP enablement was performed.

Before public MCP enablement: configure mandatory distributed quotas/cost controls (its optional `MCP_RATE_LIMITER` is not a full daily quota); bound all MCP search/detail paths including Premium browser fallbacks; add failure/latency/cost dashboards and alerts with credential redaction; implement and test OAuth account linking, refresh/revocation, and Premium entitlement lifecycle; validate origin restrictions and real ChatGPT/Claude conversations against an HTTPS staging endpoint. The integration credentials are not wired into the legacy `/mcp` prototype. A separate developer-key `/api/v1/mcp` adapter now reuses the versioned API and its quotas; see [agent integrations](agent-integrations.md). It does not supply OAuth account linking or satisfy the remaining hosted-platform acceptance gates automatically.

## Verification and remaining acceptance

Validation performed: `npm run check` passed the backend suite (see the current PR for counts); Worker dry-run bundle passed. `node scripts/check-integration-runtime.js` passed with real local workerd/SQLite storage, fixture search, cache persistence and daily quota across a runtime restart. No marketplace requests are made by that smoke test.

Automated tests cover auth/scope/revocation/expiry, malformed parameters and limits, persisted concurrent minute/day quota, cache reuse across restart, classification and missing fields, original photo provenance, source/detail failures, timeout, URL/redirect protection, and disabled Worker/MCP routes. Existing backend regression suite is run as well. Fixtures prove contracts, not current marketplace precision/recall.

Not deployed: Worker changes, migration, keys, BLANĂ adapter, monitoring, or schedules. Still required before rollout: approved preview/production provisioning, real marketplace acceptance with representative natural/synthetic/trim examples and unavailable listings, gallery coverage audit, CDN validation in BLANĂ, and production quota/cost monitoring. Authenticated Premium remains untested and outside this Free-engine integration. The BLANĂ page could not be retrieved with the web tool in this session, so its framework has not been assumed.
