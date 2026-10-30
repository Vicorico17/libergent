# Premium, Product, and Launch TODO

Last prioritized: 2026-10-19
Implementation and production status audit: 2026-09-13 (unless noted below)

See [the September launch audit](launch-audit-2026-09-13.md) for the comparison
with the owner's full list, current code evidence, dependencies, and newly
identified gaps. Historical deployment checkmarks below were not reverified.

This is the source of truth for launching Premium vehicle alerts, completing
paid Premium subscriptions, and tracking the next product work. A checked item
is implemented or has been explicitly confirmed in the target environment;
unchecked operational items must be completed before the corresponding test or
launch.

## Original review list — current status, 2026-10-30

This reconciles the owner's project review list. PR #38 supplied the canonical
Developer API; follow-up work is on PR #39. A pushed change is not a deployment.
Live staging/account acceptance is deferred until the owner is ready.

| Priority | Workstream | Current status | What remains |
| --- | --- | --- | --- |
| P0 | MCP regressions | Fixed and tested in PR #39 | Merge/deploy and hosted-client acceptance. |
| P0 | Developer API backend | Implemented, with SQL/Worker/runtime tests and staging tooling | Staging migration/configuration, two verified accounts, browser acceptance and live-key check. |
| P0 | Production payments | Stripe test flow exists; live keys remain blocked | Explicit live-mode support, configured products/webhooks, renewal/failure/cancellation acceptance. Do not enable charging before final policies. |
| P0 | Product/service boundaries | Premium/Agent access checks exist | Finalize Agent duration, seller/product counts, Premium inclusion, completion, cancellation/refund terms and Agent checkout. |
| P0 | Source reliability | Fair samples, deduplicated URLs and short partial caches implemented | Repair/revalidate advertised sources from production; local OLX/Okazii failures remain unresolved. |
| P1 | Agent outreach/completion | Deal workflow and buyer-approved drafts exist | Provider receipts, reliable reply attribution, one-off send idempotency, follow-ups, notifications and controlled end-to-end pilot. |
| P1 | VINDE | Drafts, images, OLX/Okazii/assisted workflows exist | Real seller connections/publication acceptance, ambiguous-failure recovery, sold synchronization and cross-platform withdrawal. |
| P1 | ChatGPT/Claude connectors | Separate Free trial and API-key MCP implementations exist | Actual owner conversations, OAuth for hosted clients, paid-call identity/metering/limits and release acceptance. |
| P1 | Browser journeys | Backend, protocol, SQL and local Worker acceptance coverage expanded | Automated browser login/search/checkout/alerts/selling journeys, mobile and account switching. CLI acceptance is not browser coverage. |
| P1 | Operations and cost controls | Durable API quotas, source probes, Free-provider boundary and local-tested edge burst limits exist | Deploy/tune edge limits; strict worldwide quotas, production dashboards/alerts, cost measurements, provider outage acceptance and rollback exercises. |
| P1 | Account/support lifecycle | Authentication and private account features exist | Account deletion/export, retention execution, concrete support route and product-policy reconciliation. |
| P2 | Image search | Validation stub only | Integrate a provider, validate results and complete UI/API flow before advertising. |
| P2 | Documentation | API and this backlog reconciled | Continue correcting older Premium-vs-Agent and implementation-vs-production claims. |
| P2 | Maintainability | Large search page and Worker remain | Gradual extraction around tested responsibilities; no broad refactor completed. |

Deferred expansion: passkeys, verified adult-product retailers, services search,
and location-based property/land search. These do not block the current API tests.

## Free search ingress protection — 2026-10-30

- [x] Add Worker burst limits shared across public Free aliases and forced refreshes,
  before cache reads, history writes or marketplace requests.
- [x] Configure 60 requests/minute per IP and 300/minute shared across clients;
  staging has separate namespaces. Shared networks share the IP allowance.
- [x] Return uncached 429 with retry guidance on denial; fail closed with 503
  when enabled bindings are missing, malformed or unavailable.
- [x] Test cross-alias/client accounting, no work after denial, failure handling
  and successful Free searches. Local Node development is outside this edge guard.
- [ ] Deploy and tune with actual traffic; Cloudflare limits are approximate and
  per location. Strict worldwide quotas, dashboards and cost caps remain open.

## Free search cost boundary — 2026-10-30

- [x] Restrict `/api/search` and `/api/search/free` to `auto`/`direct`, resolving
  both to direct retrieval, in the Worker and Node server.
- [x] Restrict explicit source selection to the registered Free sources; paid or
  experimental sources require the authenticated Premium workflow.
- [x] Reject disallowed requests before cache lookup or any network/browser use;
  retain separate CLI/admin provider controls.
- [x] Regression tests plus a localhost HTTP check cover both public aliases.
- [ ] Deploy and verify the public boundary. Global website ingress quotas and
  cost/error monitoring remain separate operational work.

## Repository reconciliation and checks — 2026-10-30

- [x] Preserve the developer API, authenticated MCP, Durable Object quotas and
  canonical `supabase/developer-api.sql` migration merged through PR #38.
  The competing local SQL-quota implementation was superseded before pushing.
- [x] Reject explicit Premium requests in the separate Free-only MCP trial instead
  of silently downgrading; preserve the adult-confirmation error.
- [x] Cover missing/broken trial quotas, search denial and isolated routing.
- [x] Check developer key-management availability before displaying controls.
- [x] Include existing statistics tests in `npm run check`; expose runtime and
  staging acceptance commands.
- [x] Add full-app staging configuration and two-account acceptance checker,
  with PostgreSQL/Worker tests for ownership and cleanup/error-redaction tests.
- [ ] Run self-service acceptance against a configured staging Supabase project;
  no staging account credential is available in this session.
- [ ] Production acceptance remains separate from local checks and a branch push.

## Developer search reliability — 2026-10-30

- [x] Share the 20-candidate sample across sources instead of letting the first
  source consume it; preserve per-source order and deduplicate listing URLs.
- [x] Treat malformed source collections as failures while retaining useful
  results from other sources.
- [x] Cache partial source/detail failures for at most one minute, including
  older snapshots with longer expiry. Complete results retain the 15-minute TTL.
- [x] Regression coverage for source fairness, duplicate enrichment, malformed
  responses and recovery from partial snapshots.
- [ ] Verify multi-source sampling and outage recovery on the deployed API.

## Direct source retry behavior — 2026-10-30

- [x] Recheck OLX and Okazii from local Node: `iphone 15` still returns HTTP
  403 from OLX and a Cloudflare challenge from Okazii, before parser execution.
  This is not evidence of production recovery or a parser defect.
- [x] Stop repeating direct HTML requests rejected with permanent 4xx or 429
  across header-profile and whole-search retry layers; JSON failures also retain
  their upstream status and avoid immediate retry on these responses.
- [x] Preserve bounded recovery for temporary errors (including 408/425/5xx)
  and the existing Vinted challenge behavior, except when throttled with 429.
- [x] Regression coverage checks exact upstream request counts, returned status
  metadata and successful recovery after temporary failures.
- [ ] Restore/revalidate OLX and Okazii access from the production runtime.
  Retry changes reduce wasted requests; they do not restore blocked sources.

## Website search cache recovery — 2026-10-30

- [x] Limit useful partial Free/Premium snapshots to 60 seconds when a source
  fails or pagination is interrupted. Complete snapshots retain five minutes.
- [x] Reject empty, failed-only and malformed payloads from search caching.
- [x] Enforce snapshot age on reads as well as cache TTL; old partial entries
  and legacy entries without a trustworthy cache timestamp trigger a new search.
- [x] Verify cross-alias reuse, expiry/refetch and legacy-entry recovery through
  Worker routes. Existing Premium authorization, forced-refresh, MCP and adult
  cache isolation regression checks pass.
- [ ] Deploy and measure recovery/cost with actual source outages. More frequent
  refreshes of partial results can increase direct and Premium fallback requests.

## Agent message acceptance evidence — 2026-10-30

- [x] Require a valid provider message ID before reporting a send as accepted;
  remove fabricated outbound IDs for missing or malformed bridge receipts.
- [x] Treat unconfirmed/transport outcomes as unknown, explicit provider
  rejections as failed, and support nested delivery-status receipts.
- [x] Do not save successful outbound history for uncertain sends; retain deal
  attempt reservations so replay cannot contact the bridge again.
- [x] Test malformed responses, provider rejection, transport-error redaction,
  nested receipts and unknown deal-attempt replay without real seller contact.
- [ ] One-off sends still need durable idempotency. Provider receipt callbacks,
  reconciliation of unknown attempts and the controlled live pilot remain open.

## Current launch checklist — 2026-10-14

This is the active owner-requested to-do list. It supersedes the older execution
order and product packaging below. Detailed historical checklists remain useful
implementation references; a checked implementation is not proof of production
acceptance. This update reviewed repository code and documentation, not live
payments, seller conversations, or marketplace publication.

### Confirmed product split

- [x] **Premium = premium search.** Expanded search and offer comparison at
  **49 RON/week or 499 RON/year**, with **3 days free** on the first subscription.
  Premium does not include seller outreach or negotiation on the buyer's behalf.
- [x] **Libergent Agent = acting on your behalf.** The separate **999 RON** service
  contacts sellers, checks details and availability, follows up, negotiates within
  the buyer's budget, and helps arrange the deal with the buyer's approval.

### Landing-page ticker finalization — 2026-10-19

- [ ] **Finalize the seamless scrolling text bar.** The repeated-group CSS loop
  replaces the jump-to-zero animation. Verify at least two full loops on desktop,
  mobile and wide screens, including font loading, resizing and reduced-motion
  preferences. Confirm there is no visible jump, gap or horizontal page overflow
  on the deployed landing page before marking complete. Local lint and TypeScript
  checks passed; production visual acceptance remains open.

### Priority and execution order

1. [ ] **Implement the confirmed product split and finalize service limits.**
   Keep premium search under Premium and outreach/negotiation under Agent.
   Finalize included sources, search/alert limits, whether Agent includes Premium,
   number of products/sellers, service duration, fee basis, completion criteria,
   cancellation and refund rules. Separate Agent access checks and a private
   entitlement table are implemented locally; apply the migration and verify
   production grants before marking this workstream complete.
2. [ ] **Implement production payments.** Build on the existing Stripe test flow.
   Add explicit live-mode configuration (the current billing guard accepts only
   `sk_test_`), configure weekly/annual products and webhooks, and verify the
   first-subscription trial, successful/failed payments, renewals, cancellation,
   duplicate events, account ownership and access activation/expiry. Add a
   separate Agent checkout after its fee basis is decided. Remove test-payment
   copy only when the live flow is ready.
3. [ ] **Make the Agent work end to end.** Connect buyer request and budget →
   suitable offers → seller contact → replies and negotiation → agreed terms →
   buyer-approved next step and buyer-confirmed purchase. Build on the existing
   deal brief, stages, proposal generation and pause/resume controls. Verify
   persistent state, recovery, notifications and budget limits with a controlled
   pilot before enabling autonomous follow-ups. See [the deal-agent plan](premium-deal-agent.md).
4. [ ] **Implement reliable Agent outreach.** Choose the best supported route for
   each source; provide a manual handoff where direct contact is unavailable.
   Verify delivery receipts, inbound reply attribution, durable duplicate-send
   prevention, retries, follow-up limits, stop controls and buyer approval.
   Keep seller acceptance separate from confirmed purchase. Add calls only after
   messaging works reliably; validate the calling pilot before advertising it.
5. [ ] **Make the Vinde button work end to end in production.** The route, listing
   form, photos, saved announcements, OLX integration, Okazii feed and assisted
   posting already have implementations. Finish database/storage configuration,
   provider access and seller connections; verify draft → upload → submit →
   actual publication/status recovery. Test expired authorization, duplicates,
   provider failures and reloads. Keep manual posting and feed submission distinct
   from confirmed publication. Define edit, sold and withdrawal behavior.
   See [VINDE setup and remaining limits](selling-publishing-setup.md).
6. [ ] **Improve Discovery.** Build on the existing source directory, status,
   probe results and shop submission. Improve browsing, filtering, categories,
   clear Free/Premium coverage, last-checked dates and useful search entry points.
   Decide whether product recommendations also belong here. Validate mobile,
   loading, empty, stale and error states; make the next action obvious.
7. [ ] **Add and improve sources.** Prioritize useful coverage, repair unreliable
   advertised sources, and add new adapters only after representative queries
   verify relevance, prices, availability, images, links and duplicates. Record
   freshness, latency, cost and failure behavior; keep experimental sources
   clearly labeled. See [the marketplace inventory](marketplace-integration-todo.md).
8. [ ] **Build ChatGPT and Claude connectors.** Define the shared authenticated
   API/MCP capabilities and each client's supported connection method. The goal
   is to make Libergent's search, decisions and workflows available in both chats;
   the clients must present Libergent's recommendations and must not choose a
   replacement winner.
   Owner reaffirmed this task on **2026-10-19**. The connector must expose
   **Libergent's own search, decisions, explanations and workflows**; clients
   present those results rather than independently choosing replacement offers.
   The MCP implementation is committed in the repository. It exposes
   `search_products`, `get_listing_details`, and `list_sources`; search uses
   Libergent's ranking, price analysis and Jev decisions. The endpoint remains
   disabled in production. The owner's immediate goal is to call Libergent from
   their own ChatGPT and Claude accounts, inspect actual search behavior, then
   decide the Premium per-call rate. Connector Free stays free; connector Premium
   is charged per call. Do not charge during the owner's initial trial. Complete
   in this order:
   1. [x] **Prepare a limited test release.** Keep Free searches free. The first
      public connector trial is Free-only: Premium is unavailable until customer
      identity and per-call charging are in place. Keep account features and write
      actions unavailable. The isolated MCP-only worker and kill switch are
      implemented locally; request and search quotas are configured. Confirm the
      search timeout and source/cost ceilings before broader live traffic.
   2. [ ] **Record Free test usage without charging.** Meter each call with a
      request ID, query, duration, cache state, source coverage, result count and
      outcome. Avoid caller IPs, tokens and unnecessary personal account data;
      set log retention. Use the owner's test traffic to learn which searches the
      clients send and estimate cost per call. Structured logging is implemented
      locally; verify Workers Logs retention and access in Cloudflare.
   3. [x] **Deploy the isolated test endpoint over HTTPS.** The `/mcp` endpoint
      is live at `https://libergent-mcp-test.vic-cazacu.workers.dev/mcp`; a remote
      MCP handshake confirmed all three tools and 12 Free sources. All other
      paths return 404 and the test environment has no scheduled jobs. See the
      [owner connection and usage guide](connector-test.md).
   4. [ ] **Connect the owner's ChatGPT and Claude accounts.** Add the remote
      endpoint from the guide and confirm each client can discover the tools.
   5. [ ] **Run the owner's live search trial.** Try representative Romanian and
      English prompts, filters and follow-up questions in both clients. Compare
      the query sent, sources actually searched, Libergent's selected offers and
      explanation, response time, failures and cache behavior. Fix issues in
      Libergent's search or the MCP input/output mapping based on those results.
   6. [ ] **Turn on Premium pay-per-call from observed usage.** Set the Premium
      price per call and define when a call is billable, how cache hits and
      failed/partial searches are handled, customer confirmation, usage display,
      refunds and spend limits. Add customer identity, a metering ledger, payment
      integration and receipts. Premium stays unavailable in the connector until
      this work is complete. Free searches must never incur a connector fee.
   7. [ ] **Add account-linked and paid features after the trial.** Implement
      OAuth, token revocation and per-user scopes when private or paid access is
      needed. Premium search must check Premium entitlement; outreach,
      negotiation and calls must independently check Libergent Agent. Require
      approval for messages, calls, purchases or publishing. Add alerts, saved
      offers, deal status and Vinde tools only as their underlying workflows are
      ready.
   8. [ ] **Harden and release broadly.** Verify quotas, cost ceilings, privacy,
      monitoring, failure handling, account isolation and rollback. Prepare
      onboarding, support/privacy information and platform-specific public
      distribution materials only when broader access is intended.

### Adult product search with age confirmation — 2026-10-26

- [x] Add a separate **18+ sexual-wellness product category** (local implementation), including product
  searches such as Lovense vibrators. Scope is non-pornographic product discovery
  and comparison, not pornography.
- [x] Require explicit confirmation that the user is **18 or older** (local implementation) before
  accessing the category, running an adult-product search, or showing its results.
  Define confirmation lifetime and enforce the gate on both UI and API paths,
  including direct links and cached results; declining or leaving it unanswered
  must not expose adult-product results.
- [ ] Identify suitable retailers with permitted search routes; validate product
  relevance, prices, availability and links before advertising coverage. Add
  source and niche documentation only when the actual integration is verified.
- [x] Define and add local acceptance tests for confirmation, refusal, missing/expired
  confirmation, direct API requests, cached-result leakage and representative
  Lovense queries, while preserving ordinary search behavior.

The gate is implemented locally; it has not been published or deployed. See
[implementation, configuration and limitations](adult-product-search.md).
Retailer coverage and production acceptance remain open.

### Services and location-based real estate — planning only

- [ ] Define services search: requested service, location/service area, price and
  scope, availability, provider evidence, comparable quotes and clear unknowns.
  Validate suitable sources and ranking before implementation.
- [ ] Define real-estate/land deal finding for the requested location. Compare
  total price, price per square metre, area, intravilan/extravilan status, road
  access, utilities and planning evidence. Label missing or unverified facts as
  unknown and link supporting evidence. Rank the best fit/value using these
  factors and buyer constraints, not the cheapest listing alone.
- [ ] Specify location matching, comparable parcels, source freshness, duplicate
  listings and verification steps. Services and land categories are TODO-only;
  no category implementation is included in the adult-search work.

### Completed foundations from the recent work

- [x] Implement separate Agent entitlement checks for deals, proposals, calls and
  all outbound seller messages, with denial/expiry/independence tests. Local code
  only: `supabase/agent_entitlements.sql` still needs deployment and live acceptance.

- [x] Three pricing offers: Free, Premium search pack and Libergent Agent at 999 RON.
- [x] Premium leads with 49 RON/week and a 3-day trial; 499 RON/year remains available.
- [x] Fixed pricing frame, compact cards, mobile plan selector and details/checkout dialog.
- [x] Animated Agent mascot with reduced-motion support.
- [x] Stripe test checkout/portal helpers, price validation, trial handling and
  billing UI exist (`src/billing.js`, `src/billing.test.js`,
  `ui/src/components/BillingAction.tsx`, `supabase/billing.sql`). Live acceptance remains open.
- [x] Deal workflow and proposal groundwork exist (`src/deals.js`, `src/deal-ai.js`,
  `supabase/deals.sql`). A completed autonomous negotiation service remains open.
- [x] VINDE route, publishing groundwork and authenticated selling CLI exist
  (`ui/src/app/vinde/page.tsx`, `src/selling.js`, `src/selling-agent.js`).
- [x] Discovery source directory, status/probe components and shop submission exist
  (`ui/src/app/discovery/page.tsx`). Quality improvements and live source acceptance remain open.

### Other existing lists and launch checks

- This file retains the detailed product, billing and alert checklist below.
- [Marketplace integration TODO](marketplace-integration-todo.md) tracks source coverage.
- [Deal-agent plan](premium-deal-agent.md) tracks the negotiation workflow.
- [VINDE publishing setup](selling-publishing-setup.md) tracks configuration and limitations.
- [September TODO reconciliation](audit-2026-09-16/todo-reconciliation.md) is a historical
  audit, not a current completion report.

Keep production Google/email sign-in, account isolation, scheduled-alert delivery,
source reliability, service costs and failure recovery in the release checks.
The repository shows substantial progress; do not mark the remaining launch work
complete merely because a UI, endpoint or mocked test exists.

## Detailed backlog and historical evidence

Priorities and checkmarks below retain their historical meaning unless explicitly
updated. Use the current launch checklist above for execution order and packaging.
Older references to a “Premium deal agent” describe the implementation being
split into the separate Libergent Agent offer.

## P0 progress — 2026-09-15

See [the P0 implementation and evidence report](p0-progress-2026-09-15.md).
Matching, login recovery, delivery-status display and dated source reporting are
implemented locally. All 117 sources received two direct smoke queries; 10 Free
sources were also checked through production search. These are bounded probes,
not complete human price/relevance or authenticated production acceptance.
Production browser login, controlled-recipient messaging, contact-policy evidence,
and post-deployment visual acceptance remain open.

## Recently completed product work

- [x] **P0** — Step 3 accuracy batch: tolerate malformed/empty retail offers, keep product prices/photos within their own cards, prefer structured/current prices over delivery/installment/old amounts, exclude structured unavailable offers, distinguish new/used/unknown condition, and require matching phone model/storage for new-price savings (local September 25). Live source validation, pagination improvements and broader configuration comparisons remain open.
- [x] **P0** — Step 2: fix ambiguous vehicle makes and substring routing; preserve complete phones with dual SIM, USA origin or replaced components and consoles with included controllers; use same-model description evidence for unspecified phone variants while ignoring comparisons (local September 25; regression fixtures added, production search acceptance remains open).
- [x] Automatically use Premium search for Premium accounts, including old Free search links; hide the Free selector, wait for account resolution, and record the actual tier in history (local implementation 2026-09-25; authenticated browser acceptance and deployment remain open).
- [x] Return a recoverable error when entitlement lookup fails instead of classifying the account as Free (local implementation 2026-09-25).
- [ ] **P0** — Verify automatic Premium search in an authenticated browser: homepage search, old `tier=free` links, subsequent searches, sign-out, and entitlement outages.
- [x] Show a clear Premium or Free marker on the account page.
- [x] Require a valid Premium entitlement for Premium search.
- [x] Make the Premium loading screen expandable so users can inspect searched sources.
- [x] Present the closest good match and new-price benchmark as separate special-result cards.
- [x] Render listing photos on both special-result cards, with image fallback and an unavailable state.
- [x] Add deterministic final ranking tie-breakers and five-minute Free Worker search snapshots.
- [x] Label search collection time instead of claiming cached results are live.
- [x] Remove the unsupported `Ajută rankingul: Bun / Slab` controls from search results.
- [x] Remove the `Copiază mesaj` button and its unused clipboard logic.

- [x] Add the manual `/health` Free-search check and footer link (2026-09-15; production acceptance remains open).
- [x] Normalize `chrome hearths` to `chrome hearts` with query/classification regression coverage (2026-09-15).

## Product and customer-acquisition backlog

### Owner priorities — 2026-09-25

Full Notes mapping and refresh investigation: [September 25 improvement plan](improvement-plan-2026-09-25.md).

- [ ] **P0 acceptance** — Verify snapshot restore and new-scan behavior in a deployed browser with Free/Premium accounts, rejected matches, changed filters, a failed scan and disabled/full browser storage. Cross-device snapshots and shared concurrent-scan coalescing remain separate follow-ups.

- [x] **P0** — Preserve results, recommendation, mapped ordering and rejected matches on ordinary reloads using account/tier/query/location-scoped tab snapshots (September 25, local). Retain up to five searches for 24 hours; handle unavailable browser storage explicitly. Storage/API regression tests pass; deployed browser acceptance remains open.
- [x] **P0** — Separate reload from “Verifică oferte noi”: explicit scans bypass the Free/Premium search response cache, summarize inventory/price/recommendation changes and failed sources, and retain prior displayed results on failed updates (September 25, local).
- [ ] **P0** — Improve scraping of existing tech marketplaces before broad expansion: stable search routes, representative captured fixtures, correct final prices/configuration/condition, pagination and useful-result monitoring.
- [ ] **P0** — Strengthen existing retail results and the new-price comparison: exact comparable model/storage/variant, valid payable price, image and source link; clearly explain missing retail evidence.
- [ ] **P0** — Finish the existing seller communication panel: account-owned conversations per listing, confirmed recipient and send action, incoming replies, delivery/error states and history persistence; production acceptance before claiming delivery.
- [ ] **P0** — Verify pictures on special recommendation cards on mobile and desktop, including failed/missing image fallback. Rendering exists; acceptance remains open.

### Login, signup, and purchase flow

- [x] **P0** — Rework email-link validation, feedback, separate loading states, recoverable errors, resend cooldown and callback handling (local implementation September 15; production acceptance below remains open).
- [ ] **P0** — Test Google login and email OTP end to end on production, mobile, and desktop.
- [ ] **P2** — Enable Supabase Passkeys with `libergent.com` as the stable WebAuthn Relying Party ID and configure the exact production origins.
- [ ] **P2** — Add optional passkey sign-in to the login page while keeping Google and email as enrollment and recovery methods.
- [ ] **P2** — Add Account security controls to register, list, rename, and revoke passkeys for confirmed users.
- [ ] **P2** — Test passkeys across supported devices and browsers, including cancellation, multiple credentials, lost-device recovery, expired challenges, and revocation.
- [ ] **P2** — Keep passkeys labeled beta and monitor Supabase's experimental API for breaking changes before making them a primary login method.
- [ ] **P1** — Design the complete customer-acquisition funnel: landing page → pricing → signup/login → checkout → Premium entitlement → onboarding → first Premium search or alert.
- [ ] **P1** — Define acquisition analytics and conversion events for every funnel step.
- [ ] **P2** — Add abandoned-checkout and failed-payment recovery paths.
- [ ] **P1** — Add a post-purchase confirmation page that clearly explains the active plan and next action.

### Search and marketplace access

- [ ] **P2** — Add search by picture: upload an image, identify the product, let the user edit extracted keywords, and then run the normal search pipeline.
- [x] Publish a registry-backed Free/Premium source list on pricing, labeling experimental sources.
- [ ] **P1** — Explain why each source is Free or Premium: access method, query relevance, reliability, browser/API requirements, and operational cost.
- [ ] **P1** — Measure cost per search and cost per useful result for each paid/browser-backed marketplace before finalizing the Premium source list.
- [ ] **P0** — Validate every advertised source with representative searches and demote sources that repeatedly return no useful results.
- [ ] **P2** — Evaluate the installed Facebook Marketplace search skill for a compliant, user-authorized, read-only Libergent integration.
- [ ] **P2** — Define Facebook Marketplace session, location, privacy, rate-limit, reliability, and seller-contact rules before exposing it in production.
- [ ] **P1** — Review the Kitesurf fallback per marketplace against direct access and Chromium, measuring useful-result recovery, false successes, failures, latency, browser duration, and cost.
- [ ] **P1** — Tighten Kitesurf eligibility where repeated runs spend browser time without recovering useful results, and verify the Chromium recovery allowlist and instant rollback switch.
- [x] **P0** — Keep the detailed source inventory and integration status synchronized with `docs/marketplace-integration-todo.md`.

### Weak-match feedback loop

- [ ] **P1** — Define what counts as a poor match before restoring any public ranking-feedback controls.
- [ ] **P1** — Let logged-in users report a poor match with specific reasons such as wrong product, accessory/part, wrong model or variant, damaged item, duplicate, unavailable listing, misleading price, or wrong location.
- [ ] **P1** — Capture the search query, filters, listing snapshot, marketplace, rank, score explanation, and selected reason with each report.
- [ ] **P2** — Add an internal review view that groups repeated problems by query, source, product category, and feedback reason.
- [ ] **P1** — Turn reviewed reports into regression fixtures and offline ranking tests instead of changing live ranking directly from a single vote.
- [ ] **P1** — Measure whether each scoring change improves poor-match rate, top-result relevance, useful-result coverage, and marketplace balance before release.
- [ ] **P1** — Add abuse protection, deduplication, account ownership, retention, and privacy rules for feedback data.
- [ ] **P2** — Close the loop for users by acknowledging reports and, where useful, explaining that future results were improved from verified feedback.

### Libergent operating-cost model

- [ ] **P1** — Build a monthly fixed-versus-variable cost breakdown and calculate cost per active user, search, Premium search, alert scan, message, and call.
- [ ] **P1** — Record phone-number rental, verification, and messaging charges.
- [ ] **P1** — Record Libergent text-model API input, output, tool, and search costs.
- [ ] **P1** — Record Libergent voice-model API transcription, synthesis, realtime, and call-minute costs.
- [ ] **P1** — Record the OpenClaw VPS cost, storage, bandwidth, backups, and monitoring.
- [ ] **P1** — Record Cloudflare Workers, Browser Rendering, requests, CPU, storage, queues, and related API costs.
- [ ] **P1** — Include Supabase, email delivery, billing-provider fees, observability, domains, and other production services.
- [ ] **P1** — Compare total service cost with the Premium price and define a target gross margin and fair-usage limits.

### Seller messaging and calls

- [x] Allow seller messaging actions only for logged-in users.
- [x] Group message chat and history by listing for the owning account.
- [x] Implement a local Premium deal brief, explicit stage transitions, price ceiling, pause/resume, buyer acceptance, and buyer-confirmed purchase outcome (September 28; SQL deployment and production acceptance open).
- [x] Add buyer-approved follow-up replies and durable idempotency for deal-linked WhatsApp sends (September 28; provider receipt and channel-permission acceptance open).
- [x] Add an optional structured AI reply proposal behind Premium and buyer approval (September 28; requires model configuration and live provider acceptance).
- [ ] **P1** — Build the Premium deal-agent pilot in [the deal-agent plan](premium-deal-agent.md): buyer brief, verified channel, durable deal and message state, reply and follow-up controls, explicit terms, pause/stop, and buyer-confirmed outcome.
- [ ] **P1** — Add bounded autonomous negotiation after the pilot proves correct reply attribution, delivery, channel permission, and buyer-controlled limits.
- [ ] **P0** — Test the full “reach out for me” flow in production: contact discovery, user confirmation, outbound delivery, provider receipt, inbound reply, history, and failure recovery.
- [x] **P0** — Display provider-evidenced queued, sent, delivered, failed, replied and unavailable states; preserve unknown delivery for historical records (September 15). Real provider receipt callbacks and production delivery acceptance remain open.
- [ ] **P0** — Confirm each marketplace permits the selected contact mechanism and preserve link-out contact where direct sending is unsupported.
- [ ] **P3** — Add calls as the next communication channel only after messaging delivery and consent are reliable.
- [ ] **P3** — Define call consent, disclosure, recording, retention, phone-number ownership, abuse prevention, handoff, and escalation rules.
- [ ] **P3** — Add per-listing call history, status, duration, cost, transcript/summary, and follow-up action.

## Implemented in the repository

- [x] Premium entitlement model backed by `user_entitlements`.
- [x] Authenticated Premium-only alert management API.
- [x] Five-active-alert limit per account.
- [x] Structured car criteria: query, maximum price, minimum year, maximum mileage, and location.
- [x] Daily and hourly alert frequencies.
- [x] First-scan baseline that does not notify users about existing inventory.
- [x] New strong match, price drop, and better-than-tracked-offers events.
- [x] Durable listing state, alert events, and notification delivery records.
- [x] In-account notification inbox with read state.
- [x] Pause, resume, and delete controls.
- [x] Vendor-neutral email webhook interface.
- [x] Hourly Cloudflare cron configuration.
- [x] Backend tests, UI lint, and TypeScript checks pass.

## Required before alert testing

- [x] Run `supabase/search_tracking.sql` in the target Supabase project.
- [x] Add the test account to `user_entitlements` with `plan = 'premium'` and `status = 'active'`.
- [x] Confirm the entitlement is recognized for the intended Premium test account.
- [x] Configure the Worker secret `SUPABASE_URL`.
- [x] Configure the Worker secret `SUPABASE_SECRET_KEY` with the Supabase secret/service-role key.
- [x] Configure the Worker secret `LIBERGENT_ADMIN_TOKEN` for manual alert-run testing.
- [ ] **P1** — Decide whether the first test is inbox-only or includes email delivery.
- [ ] **P1** — If testing email, configure `ALERT_EMAIL_WEBHOOK_URL` and, if required, `ALERT_EMAIL_WEBHOOK_TOKEN`.
- [x] Run `npm run build:ui` successfully in the pre-deployment or CI environment.
- [x] Review the dirty worktree and stage only the changes intended for the alert release.

## Alert acceptance test

- [ ] **P1** — A free account receives the Premium-required state and cannot create an alert.
- [ ] **P1** — The Premium test account can create an alert with structured vehicle filters.
- [ ] **P1** — A sixth active alert is rejected.
- [ ] **P1** — Pause, resume, and delete work only for the owning account.
- [ ] **P1** — The first scheduled/manual scan stores listing state and creates no historical notifications.
- [ ] **P1** — A later scan can create a deduplicated new-match or price-drop event.
- [ ] **P1** — The event appears in the correct account inbox and can be marked read.
- [ ] **P1** — Inbox-only mode records email delivery as `skipped` when no webhook is configured.
- [ ] **P1** — Email mode records `sent` or a useful `failed` error without losing the in-account event.
- [ ] **P1** — An inactive, expired, cancelled, or past-due entitlement blocks access and pauses scheduled alerts.
- [ ] **P1** — The hourly Cloudflare cron invokes the due-alert runner in the deployed environment.

## Premium billing backlog

Stripe launch checklist expanded on **2026-10-19**. The core subscription flow
exists, but currently accepts test keys only. The earlier billing audit ran
`node --test src/billing.test.js` with **4/4 mocked tests passing**; this is not
Stripe sandbox or production acceptance. Deployed secrets, migrations and the
Stripe account still need verification. This checklist supersedes older billing
implementation statuses in this document.

### Existing foundations

- [x] Premium prices: **49 RON/week** (`4900`, `ron`) or **499 RON/year**
  (`49900`, `ron`), with a **3-day first-subscription trial** and card collection.
- [x] Authenticated Checkout and Customer Portal endpoints, server-side price
  validation, success/cancel navigation and pricing/account buttons.
- [x] Raw-body webhook signature verification, current-subscription retrieval,
  customer/subscription mapping migration and Premium entitlement updates.
- [x] Active/trial access, immediate `past_due` denial and cancellation mapping.
  Return URLs alone do not grant access. Operational verification remains open.

### Product and billing decisions

- [ ] Confirm the existing weekly/yearly prices, trial duration and trial eligibility.
- [ ] Finalize included Premium search/alert limits and enforce them consistently.
- [ ] Decide tax-inclusive versus tax-exclusive pricing, supported customer
  countries, B2C/B2B billing details and applicable tax/invoicing requirements
  with the accountant; configure tax collection accordingly.
- [ ] Define period-end versus immediate cancellation, weekly/yearly plan changes,
  proration, failed-payment grace period, reactivation and entitlement expiry.
- [ ] Define refunds and disputes, including their effect on access; publish the
  billing terms, renewal/trial disclosures, refund policy and support details.
- [ ] Decide whether the **999 RON Agent service** launches with Premium payments;
  finalize fee basis, service duration, completion criteria and refund rules.
  Agent remains a separate product and entitlement.

### Stripe account, infrastructure and configuration

- [ ] Activate the Stripe business account and complete verification, payout bank
  details, support contacts, statement descriptor and branding.
- [ ] Create separate sandbox and live Premium Products/Prices for 49 RON/week
  and 499 RON/year. Verify currency, amount, recurrence and tax behavior.
- [ ] Configure Customer Portal payment-method updates, invoices, cancellation and
  permitted plan changes, including trial behavior and proration.
- [ ] Configure receipts, trial/renewal communications, failed-payment emails and
  payment recovery/retry settings to match the agreed policies.
- [ ] Verify `supabase/search_tracking.sql`, then `supabase/billing.sql`, in each
  target database, including service-only writes and account ownership isolation.
- [ ] Configure each environment's Worker secrets/settings: `STRIPE_SECRET_KEY`,
  `STRIPE_WEEKLY_PRICE_ID`, `STRIPE_ANNUAL_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`,
  `LIBERGENT_PUBLIC_URL`, `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (or supported
  service-role credential). Never expose secrets through `NEXT_PUBLIC_*`.
  `STRIPE_PRICE_ID` is optional legacy monthly reconciliation only.
- [ ] Register `https://libergent.com/api/billing/webhook` for snapshot events:
  `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`
  and `invoice.payment_failed`. Use separate local/sandbox/live signing secrets.
- [ ] For local acceptance, forward Stripe CLI events to
  `http://127.0.0.1:8787/api/billing/webhook` and set the UI return origin to
  `http://localhost:3000`. Verify deployed HTTPS return URLs before launch.

### Production implementation

- [ ] Replace the `sk_test_`-only guard with explicit test/live configuration and
  environment validation. Show the test-payment notice only in test mode.
- [ ] Prevent concurrent/repeated checkout requests from creating duplicate
  customers or subscriptions: persist the customer and pending checkout, reuse
  eligible sessions, and pass stable operation-specific Stripe idempotency keys.
- [ ] Add durable event-ID deduplication and concurrency-safe webhook processing.
  Verify replay and out-of-order delivery beyond the existing timestamp guard;
  record completion only after successful processing so retries recover failures.
- [ ] Pin a supported Stripe API version and test request/event compatibility.
- [ ] Persist selected price, raw subscription status, trial history, billing
  period/renewal date and scheduled cancellation in addition to access status.
- [ ] Show current plan, trial end/next payment, scheduled cancellation and payment
  problems in the account. Poll authenticated server status after Checkout until
  activation is confirmed; provide pending/error recovery and a useful next action.
- [ ] Implement the agreed refund/dispute and payment-failure access policies.
- [ ] Add structured operational logging, webhook-failure alerts, replay/support
  procedures and scheduled Stripe/Supabase reconciliation for entitlement drift.
- [ ] If Agent is included, implement separate one-time Checkout after fee-basis
  confirmation, durable orders, payment-confirmed fulfillment, Agent entitlement
  grants and refund handling. The Premium subscription handler does not cover it.

### Acceptance and release

- [ ] Test both plans with real Stripe sandbox sessions and authenticated accounts:
  first-time trial, returning subscriber without another trial, trial conversion
  and recurring renewal; advance time with test clocks where supported.
- [ ] Test declined cards, authentication-required payments, failed renewal,
  payment recovery and the corresponding loss/restoration of Premium access.
- [ ] Test trial cancellation, period-end cancellation, expiry, reactivation and
  all enabled Portal actions, including plan switching and trial preservation.
- [ ] Test duplicate clicks, concurrent requests, abandoned/expired Checkout
  sessions, duplicate/delayed/out-of-order webhooks and webhook replay.
- [ ] Test database/API outages and retries, invalid signatures, wrong prices,
  wrong-account access and test/live separation. Verify SQL behavior against a
  real test database; mocked endpoint tests alone are insufficient.
- [ ] Verify refunds/disputes and, if included, Agent order fulfillment without
  duplicate service grants or accidental Premium/Agent entitlement crossover.
- [ ] Document secrets and webhook rotation, monitoring, reconciliation, support
  and rollback. Disabling new purchases must preserve existing billing handling.
- [ ] Deploy the verified live configuration and perform an explicitly authorized
  real purchase/refund smoke test; confirm receipts, Portal access and entitlement
  activation/expiry. Mark live acceptance complete only with recorded evidence.

Execution order: finalize policies → configure sandbox → harden checkout and
webhooks → complete account status UI → pass end-to-end acceptance → configure
and deploy live billing → verify the authorized production smoke test.

References: [billing implementation](../src/billing.js),
[billing migration](../supabase/billing.sql),
[billing tests](../src/billing.test.js),
[Stripe account setup](https://docs.stripe.com/get-started/account/set-up),
[webhooks](https://docs.stripe.com/webhooks),
[Customer Portal](https://docs.stripe.com/customer-management).
