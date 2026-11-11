# Facebook Marketplace integration plan

Date: 2026-11-11
Status: Phase 1 diagnostic implemented; Cloudflare live probing started. No production Facebook adapter.

Implementation update: the user selected Cloudflare as the first runtime to test. A local diagnostic page and remote browser binding are implemented; see [testing instructions](facebook-marketplace-testing.md). Use this route for Phase 1 before considering Browserbase. Production registration and Romanian location validation remain pending.

## Decision and scope

Build toward an opt-in, read-only Facebook Marketplace search beta for LiberGent. First prove that Romanian searches work repeatedly with an available, permitted access method. Treat a Muse connector as a separate distribution opportunity until a documented interface proves that Muse can supply Marketplace results to our backend.

Initial scope: user-triggered search, one results page, explicit Romanian city, price filtering, normalized listing cards and links to Facebook. Add bounded item-detail enrichment only after independently validating it. Posting, seller messaging, purchases, background monitoring and alerts are separate work.

Estimated effort for one engineer: 1–2 days for feasibility; approximately 1–2 additional weeks for a beta after access is proven. Allow 3–4 weeks overall for production hardening. These are planning estimates, excluding provider provisioning, access approval, platform review and any substantial OAuth work.

## Starting point

- The installed [search skill](../.agents/skills/search-marketplace/SKILL.md) describes Browserbase verified sessions with residential proxies. Its examples are predominantly US-based; item-detail extraction was not directly verified. Treat its location rules, pagination behavior and field names as hypotheses to test.
- `src/provider-options.js` currently supports auto, direct, Firecrawl and Cloudflare; Browserbase is not integrated.
- Reuse the existing search, normalization, relevance, ranking, caching and source-outcome machinery. Inspect the actual interfaces before choosing implementation boundaries.
- Free search is direct-only. A paid Facebook browser session must not become an implicit fallback in Free search.
- The existing developer MCP endpoint is `/api/v1/mcp`. It supports scoped bearer keys; hosted assistant OAuth linking remains unfinished. See [agent integrations](agent-integrations.md).

## Phase 1 — Prove Romanian access (1–2 days)

Owner: engineering; operator supplies runtime access if it is not already configured.

- [ ] Inspect available Browserbase account capabilities and runtime configuration without printing secrets. Verify that the skill's session options are actually available.
- [ ] Establish the supported access/permission basis for the intended beta. Provider browser capabilities alone do not establish permission to collect or redistribute Marketplace data.
- [ ] Create a bounded diagnostic script, separate from public search routing. Always release sessions, including after timeout or parsing failure.
- [ ] Resolve and validate București, Cluj-Napoca and Iași through observed Facebook location behavior. Do not invent city slugs or assume numeric IDs are invalid without testing.
- [ ] Test three representative queries in each city: a phone, furniture and a bicycle. Repeat the nine-search matrix on another day: 18 searches total.
- [ ] Record requested and resolved city, applied filters, actual currency, listing count, sample relevance, elapsed time, browser time, proxy traffic, login/region failures and partial-result reasons.
- [ ] Compare a small sample against the visible Facebook page. Never interpret a parser failure as a valid empty search.
- [ ] Probe three item links separately; report which detail fields are observed and which remain unknown.
- [ ] Save sanitized fixtures and a dated evidence report. Exclude cookies, session tokens, unnecessary seller information and raw authenticated page dumps.

Proposed go/no-go criteria:

- At least 17 of 18 searches produce a correctly scoped, parseable result or a visibly verified empty result. This is an initial feasibility threshold, not a production reliability claim.
- No accepted search silently uses a different city; all returned cards have canonical item links and observed titles. Prices/currencies are correct when present and unknown when absent.
- Login walls, access blocks and location failures produce explicit outcomes. Stop at access challenges.
- Measure latency and cost. Target a 30-second source deadline; agree a numerical cost ceiling from measured browser/proxy usage before beta enablement.
- If login is necessary, document a user-authorized connection lifecycle and isolation design before proceeding. Do not substitute a shared personal Facebook account.

Deliverable: `docs/facebook-marketplace-feasibility.md`, containing the matrix, evidence, access requirements, costs, unresolved issues and a go/no-go recommendation.

If the gate fails, retain a manual Facebook search link and investigate supported partner/feed access. Do not spend the next phase building around an unproven extractor.

## Phase 2 — Implement a bounded backend adapter (2–4 days)

Depends on Phase 1 passing.

- [ ] Choose a Worker-compatible remote browser connection or a small authenticated Node service, based on a deployment-runtime connection test. The skill's shell commands are a prototype recipe, not the production runtime.
- [ ] Add explicit configuration, source eligibility and an off-by-default Facebook feature flag. Prefer a source-specific browser transport over automatically changing every provider fallback chain.
- [ ] Implement session acquisition, deadline/cancellation handling, concurrency limits and cleanup.
- [ ] Extract structured JSON using a resilient parser; avoid relying on a single regex over nested page data. Add fixtures for missing fields, changed payloads and malformed data.
- [ ] Map records into LiberGent's existing listing model and reuse its relevance, deduplication and ranking. Preserve observed currency; never assume every Romanian listing is priced in RON.
- [ ] Use listing ID/canonical URL for identity. Keep unknown seller, condition, posting time and availability fields unknown.
- [ ] Return source outcomes for login required, wrong/unresolved location, region unavailable, rate limit, timeout and invalid payload. Preserve valid partial results.
- [ ] Include city, filters and access context in cache identity. Keep authenticated results isolated between users; honor existing shorter caching for failures/partial results.
- [ ] Add per-user quotas, a shared provider concurrency/spending bound, and an immediate source kill switch. Expiring image URLs require refresh behavior.

Acceptance: fixture tests cover real observed shapes; integration tests cover cleanup and failures; no Facebook requests occur when disabled or through Free search; deployment-runtime smoke test succeeds.

## Phase 3 — Ship an internal opt-in beta (2–3 days)

- [ ] Expose Facebook to internal testers first, with an explicit city selector and source opt-in.
- [ ] Reuse existing search progress and coverage reporting. Distinguish unavailable, partial, empty and successful results.
- [ ] Keep existing marketplaces responsive if Facebook is slow or unavailable. Facebook must not hold the entire search open beyond its deadline.
- [ ] Show freshness and canonical Facebook links. Seller contact stays on Facebook.
- [ ] Add item-detail enrichment only if Phase 1 verified it; fetch on demand with a separate bounded budget.
- [ ] If login is required, implement secure connection, expiry, reconnect and disconnect handling, with session/cache isolation tests before inviting users.
- [ ] Keep public source availability copy accurate. Source registration alone is insufficient evidence of live coverage.

Acceptance: a tester can search, compare a real card to Facebook, recover from login/location failures and continue using other sources during a Facebook outage. Disabled access produces no provider spend.

## Phase 4 — Validate reliability and decide rollout (2–4 engineering days, plus observation)

- [ ] Repeat representative live checks across several days and record success rate, useful accepted listings, latency percentiles and cost per uncached search/useful result.
- [ ] Exercise stale photos, removed listings, expired sessions, concurrent users, provider outages and quota exhaustion.
- [ ] Verify that credentials do not enter logs and that disconnect prevents reuse of the user's session.
- [ ] Establish a numerical production cost budget and latency/reliability thresholds from evidence; document retention and maintenance ownership.
- [ ] Validate the kill switch and rollback. Roll out gradually to a small opt-in cohort only when the access and reliability gates pass.
- [ ] Update the source catalog, marketplace backlog and launch notes with dated evidence.

Deliverable: rollout decision and an operating runbook. Maintain an experimental label if evidence does not justify general availability.

## Muse investigation — separate, bounded track

Timebox initial investigation to half a day. It does not block the Browserbase feasibility test and does not imply delegated agent work.

### A. Can Muse provide Marketplace data to LiberGent?

- [ ] Find primary documentation for a third-party callable interface, required permissions, Romanian availability, structured results, quotas and permitted downstream use.
- [ ] Require a documented interface plus a successful authorized sample call before considering Muse a data-provider option.
- [ ] If no such interface is available, record this route as unverified and stop implementation work on it. Access to Muse models or consumer connectors is insufficient evidence.

### B. Can Muse call LiberGent?

- [ ] Check current custom-connector transport/auth requirements against `/api/v1/mcp`.
- [ ] If compatible, test initialization, tool discovery and a simulated search with a scoped test key on a preview endpoint.
- [ ] Verify partial results, quotas, revocation and source permissions. Test real assistant behavior separately from protocol tests.
- [ ] Identify any OAuth/account-linking gap and estimate it separately.
- [ ] Prepare connector metadata and review materials only after technical compatibility is proven. Submission and public enablement are later actions.

This route makes LiberGent available to Muse users; it does not itself add Facebook inventory to LiberGent.

References checked during the assessment: [Meta connector guidelines](https://platform.muse.ai/docs), [Meta Connector Platform](https://platform.muse.ai/), [Meta Model API](https://dev.meta.ai/products/meta-model-api), [Browserbase verified browsers](https://www.browserbase.com/verified). Recheck capabilities before implementation.

## First implementation task

Start Phase 1: inspect runtime availability, implement the bounded diagnostic runner, and validate one București search before expanding to the 18-search matrix. The next decision should be based on observed Romanian listings, measured cost and documented access requirements.
