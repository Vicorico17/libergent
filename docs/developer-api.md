# Libergent API

A general product-search API for storefronts, comparison tools and other applications. BLANĂ is one consumer; optional fur-coat filters do not constrain the default search.

## Start in three steps

1. Open `/developers` and click **Run demo request**. No account is required. Demo results are simulated and contain no real product links or images.
2. Sign in with an email-verified Libergent account. Name your application and create a **test** key. Save the key as `LIBERGENT_API_KEY` in your server environment; it is displayed only once. Include the listing-details permission if you need descriptions and galleries.
3. Copy the curl, JavaScript or Python request on the page. Once the integration works, create a **live** key and change your server environment variable. The request URL and response shape stay the same.

```bash
curl --fail-with-body --get "$LIBERGENT_API_ORIGIN/api/v1/search" \
  -H "Authorization: Bearer $LIBERGENT_API_KEY" \
  --data-urlencode 'q=iphone 15' --data-urlencode 'limit=10'
```

`LIBERGENT_API_ORIGIN` is your deployed API origin (for example, the approved preview origin). No SDK is required. The key is a bearer credential, not a personal Supabase access token. Never use a frontend/public environment variable for it. Browser code should call your application's server route.

## Endpoints

| Endpoint | Authentication | Purpose |
| --- | --- | --- |
| `GET /api/v1/demo` | None | Simulated response, no upstream search |
| `GET /api/v1/sources` | None | Supported source IDs |
| `GET /api/v1/openapi.json` | None | OpenAPI 3.1 spec for client generation / API tools |
| `GET /api/v1/search` | API key | General product search |
| `/api/v1/mcp` | API key | Read-only agent tools over Streamable HTTP; separately enabled |
| `GET /api/developer/keys` | Existing account session | Own key metadata, never secrets/hashes |
| `POST /api/developer/keys` | Verified account session | Create a key; raw secret returned once |
| `DELETE /api/developer/keys/:id` | Verified account session | Revoke an owned key |
| `GET /api/developer/usage` | Verified account session | Current minute/day counts for own test/live environments |

Management routes are used by the first-party developer dashboard. A key cannot manage other keys. There are no cookie-only management requests or permissive cross-origin headers.

Search requires `q` (1–120 characters, existing public-search policy). Optional parameters: `sites` (comma-separated supported domains, default `olx.ro`), `limit` (1–20, default 20), `details` (default false, requires `listings:details`). `category` and `material` are optional specialized filters documented in the [listing contract](storefront-integration-v1.md). Unknown and repeated parameters are rejected.

Initial API sources are OLX, Publi24 and Okazii. These are general marketplaces, not a fur-specific source list. The broader website registry is not automatically advertised as supported by this API. Queries use the same direct engine as existing search. Each source gets one page, and at most 20 candidates across sources are inspected. This is a bounded sample, without pagination or a guarantee of complete inventory. Search query languages depend on the source; translation is not performed.

The original `/api/integrations/v1/search` remains available with its original `details=true` default. New integrations should use `/api/v1/search`.

## Response and integration behavior

The response includes `apiVersion`, `mode` (`test` or `live`), timestamps, cache metadata, `partial`, per-source status, and `items`. Test results also include `simulated: true`. A test key **always** uses fixtures, even if you request live-looking query/source parameters. No test request starts marketplace or detail fetching. Test requests still enforce scopes, quotas and caching.

Items expose source URL, title, price/currency, location, condition, description, original images, supported attributes and verification status. Missing scalars are `null`; missing collections are `[]`. Price can be the original source string, a structured amount, or null. See OpenAPI for the complete schema. Material classification is a text-supported seller claim, never independent proof. Availability remains unknown unless supported by a verification; never treat an absent search result as removed.

Use the [general Vercel Function](../examples/vercel/api/products.mjs) for a fixed-query cached catalog. Set `LIBERGENT_API_ORIGIN`, `LIBERGENT_API_KEY`, and `LIBERGENT_CATALOG_QUERY` in Vercel's server environment. It includes CDN caching capped by snapshot expiry, bounded client timeout, and safe error output. [BLANĂ](../examples/blana/api/catalog.mjs) demonstrates the optional specialized filters. Neither example has been deployed into a consumer application.

## Starter limits and security model

| Mode | Per minute | Per UTC day | Upstream requests |
| --- | --- | --- | --- |
| Test | 60 | 1,000 | Never |
| Live | 10 | 200 | On uncached searches only |

One API workspace per Libergent account; key names identify applications. Limits are shared by **all keys for the same account and mode**, so rotating or creating keys cannot reset quota. Up to 5 active keys per account across both modes; up to 20 creations in a rolling 24-hour period. Keys expire after 90 days. This release has no per-application billing, paid plans, automatic upgrade or multi-member organizations.

Quota counters and 15-minute cache snapshots persist in a Durable Object per account/mode, across isolates and runtime restarts. Cache hits, coalesced requests, busy rejections, and source failures count. Viewing usage does not consume a search request. Daily reset is midnight UTC. HTTP 429 includes Retry-After. At most two distinct uncached searches run concurrently; identical requests coalesce. Cache capacity is bounded to 32 query variants and 120 KB per value. Failure to reach persistent storage fails closed.

API keys use a cryptographically random 256-bit secret. Supabase stores SHA-256 hashes, safe prefixes and metadata only. Creation is transactional and serialized per owner. Direct table/RPC access is denied to browser `anon` and `authenticated` roles. Every request rechecks revocation, expiry, account suspension and verified-email status; authorization results are not cached. Key lookup failures cannot fall back to unauthenticated search. Already-running requests may finish when a key is revoked.

To rotate: create a replacement key, update the application's server environment, verify it works, then revoke the old key. The dashboard never recovers an old secret; lost keys must be replaced. If the one-time create response is lost, find the named key in the list and revoke it before retrying. Disable all API access for an account with an operator-controlled `developer_accounts.disabled` update. This is independent of Premium subscription status.

## Failures and latency

- 200 can contain partial source/detail failures. Inspect `partial` and each source status.
- 400: correct the parameters. 401: key is missing/invalid/revoked/expired. 403: required permission is absent.
- 429: wait for Retry-After. Do not loop or generate replacement keys.
- 502: all sources failed. 503: auth/storage/configuration unavailable. Retry with bounded backoff.
- The search feature is 404 until enabled. Dashboard management returns a clear unavailable state until provisioned.

The search engine has an 8-second budget followed by a 12-second total detail budget. Self-service authorization has two database checks of at most 5 seconds each. Allow 35 seconds in the client. A Vercel example uses a 40-second maximum function duration. Cached requests still reauthorize the key. Current usage is exposed, but production latency/error/cost alerting still needs operator setup.

## Operator setup — once per deployment, not per developer

Production settings and schemas remain unchanged. A separate scoped acceptance preview is deployed as described below; self-service account provisioning is not enabled there.

1. Review the PR and deploy to an isolated preview first. This repository automatically deploys production on merge to `main`; do not merge merely to obtain a test URL.
2. Apply `supabase/developer-api.sql` to the intended Supabase project. It creates two new RLS-protected tables and three service-role-only RPCs; it does not change existing search/account tables. It is idempotent.
3. Ensure the existing server-only `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are configured (`SUPABASE_SERVICE_ROLE_KEY` is the supported legacy fallback). The same Supabase Auth project must supply the website's `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` build variables. The publishable key is not the server secret.
4. Deploy the existing `INTEGRATION_GATEWAY` Durable Object binding and `integration-gateway-v1` SQLite migration in `wrangler.toml` with the Worker/UI. No new namespace needs to be manually created per developer.
5. Set **both** `LIBERGENT_INTEGRATIONS_ENABLED=1` and `LIBERGENT_DEVELOPER_API_ENABLED=1` as Worker configuration/secrets. `LIBERGENT_INTEGRATION_KEYS` is optional and only for operator-managed compatibility keys; leave it unset or `[]` for normal self-service. There is no key JSON to edit for new developer accounts.
6. Configure Supabase Auth's approved site/redirect URLs and email verification for that preview or production site using the existing account setup. Validate an actual verified user can create a test key, call search, rotate/revoke it and see usage. Confirm another account cannot see/revoke its keys. Test a live key with a bounded representative query before public release.
7. Configure production request/error/latency and cost monitoring, appropriate ingress abuse controls, and a support process for account suspension and higher quotas. The starter quotas are finite, but are not a replacement for fleet-wide monitoring or multi-account abuse controls.

Rollback: set `LIBERGENT_DEVELOPER_API_ENABLED=0` to stop self-service and database-backed keys; operator-managed compatibility keys can still work. Set `LIBERGENT_INTEGRATIONS_ENABLED=0` to stop all integration search. Keep the migration and namespace; public Free search and MCP behavior do not depend on the new API flags.

## Staging account acceptance checklist

The existing `libergent-integration-preview` Worker exposes only integration
routes. Its account management and `/api/developer/config` routes intentionally
return 404; use a full-app staging target for this test.

Prepare these once, when ready to test:

1. **An isolated Supabase test project.** Apply `supabase/developer-api.sql` there.
   Use this project's URL and server secret on the staging Worker, and its URL
   and publishable key in the staging UI build. Do not reuse production data or
   copy production billing, outreach or operator API-key secrets.
2. **A staging website.** `wrangler.staging.toml` defines `libergent-staging`, with
   its own Durable Object namespace and no scheduled jobs or Browser Run binding.
   Build with the staging `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; run `npm run verify:ui-auth-config`.
   Configure Worker secrets `SUPABASE_URL` and `SUPABASE_SECRET_KEY` using
   `wrangler secret put ... --config wrangler.staging.toml`, then deploy explicitly
   with `wrangler deploy --config wrangler.staging.toml`. The normal production
   workflow does not deploy this file. Set the staging origin as the Supabase
   Auth site URL and allow its `/confirm` callback; verify your login provider
   configuration before testing Google login.
3. **Two email-verified test accounts** in that project. Sign into each in separate
   browser profiles. Two sessions belonging to the same account are not sufficient
   for ownership testing.
4. **Temporary local session credentials** for the automated check. Configure
   `LIBERGENT_ACCEPTANCE_SESSION_TOKEN` for account A and
   `LIBERGENT_ACCEPTANCE_SECOND_SESSION_TOKEN` for account B in the local shell.
   These are Supabase session access tokens, not database secrets or API keys.
   Do not paste them into chat, command arguments, source files, or PRs. Clear them
   from the shell after testing. They expire; repeat sign-in if necessary.

Run `npm run check:developer-api -- https://YOUR-STAGING-HOST`. The script creates
one `acceptance-*` **test** key, verifies that account B cannot list or revoke it,
checks simulated search/cache reuse, rejects unauthorized listing enrichment,
checks usage, revokes the key, and confirms cached access is denied. It attempts
cleanup on failure and gives a manual dashboard instruction if cleanup fails.
Omitting account B explicitly reports isolation as **not tested**. Responses and
credentials are never printed. This check does not contact marketplaces, apply
migrations, send messages, or change subscriptions.

Then manually test `/developers/` on mobile and desktop: sign in, create a test
key, copy the one-time secret, reload, inspect usage, revoke, sign out, and confirm
that switching accounts shows only the signed-in account's keys. Repeat with
expired login and failed network requests. Real-source checks with a live key
are a separate, bounded test; passing simulated acceptance does not establish
marketplace availability.

## Local testing

```bash
npm ci
npm --prefix ui ci
npm run check                         # includes real PostgreSQL (PGlite) migration tests
npm --prefix ui run lint:ci
npm --prefix ui run build
node scripts/check-integration-runtime.js
npm run dev:api                       # serves built UI and no-key demo at 127.0.0.1:8787/developers
```

The plain Node server supports the developer page, demo, sources and spec. Full quota-backed search needs `npm run dev:worker`, since Node does not supply Durable Object bindings. Configure a local `.dev.vars` with the two feature flags and **test-project** Supabase settings to exercise real self-service. Never commit that file. The runtime smoke test uses fixture search and local workerd/SQLite, without remote accounts or marketplace requests.

## Status and follow-up

Implemented: general v1 API, compatible legacy route, self-service test/live keys, dashboard, usage, scopes, revocation, expiry, account-wide quotas, cache, demo, OpenAPI and examples. Existing website/Free/Premium search paths remain unchanged; navigation only gains an API link. The new `/api/v1/mcp` adapter accepts the same developer keys when separately enabled. The older `/mcp` stays disabled and does not accept these keys. See [agent integrations](agent-integrations.md).

Validation on 2026-10-27:

- `npm run check`: 355 tests passed, including real PostgreSQL migration/RLS/ownership/key-creation limits and a create → authenticate → sandbox search → revoke → reject flow.
- `npm --prefix ui run lint:ci`: passed.
- `npm --prefix ui run build -- --webpack`: passed, with `/developers` statically exported. Webpack was used for this isolated checkout's shared local dependencies; no framework configuration was changed.
- `npx wrangler deploy --dry-run`: passed; no upload or deployment.
- `node scripts/check-integration-runtime.js`: passed with local workerd/SQLite quota/cache persistence across restart.
- Fresh local Chrome profile: desktop and 390px mobile rendering, no-key demo, query/language examples, clipboard copying, sign-in return URL, no horizontal overflow, and no page runtime errors. External browser requests were blocked; real account sign-in was not exercised.

 Remote Supabase Auth email flows, production load/monitoring, live-source accuracy and consumer deployment require staging acceptance. The stable production developer API is not deployed; the isolated acceptance preview is available as described below.

Later work: wider validated source coverage, async jobs/webhooks, scheduled refresh and last-good inventory snapshots, billing and organization/team management. Those are not prerequisites for a developer to obtain a scoped key and integrate the current API once the deployment is provisioned.

### Isolated BLANĂ acceptance preview

A separate `libergent-integration-preview` Worker was provisioned on October 27, 2026 using `wrangler.integration-preview.toml`. It has its own Durable Object namespace and a scoped, expiring operator-managed BLANĂ key; it has no website/account/cron/production bindings. The stable production API and self-service database migration remain undeployed. The preview supports REST and authenticated MCP. See the [FAU agent handoff](fau-blana-agent-handoff.md) for the endpoint, verified live results and integration steps. Do not reuse the preview configuration to deploy production.
