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

## Current launch checklist — 2026-10-14

This is the active owner-requested to-do list. It supersedes the older execution
order and product packaging below. Detailed historical checklists remain useful
implementation references; a checked implementation is not proof of production
acceptance. This update reviewed repository code and documentation, not live
payments, seller conversations, or marketplace publication.

### Landing-page ticker finalization — 2026-10-19

- [ ] **Finalize the seamless scrolling text bar.** The repeated-group CSS loop
  replaces the jump-to-zero animation. Verify at least two full loops on desktop,
  mobile and wide screens, including font loading, resizing and reduced-motion
  preferences. Confirm there is no visible jump, gap or horizontal page overflow
  on the deployed landing page before marking complete. Local lint and TypeScript
  checks passed; production visual acceptance remains open.

### Priority and execution order

1. [ ] **Define Premium vs. Libergent Agent.** Premium is the search pack:
   **49 RON/week or 499 RON/year, with 3 days free on the first subscription**.
   Agent is the separate **999 RON** seller-contact and negotiation service.
   Finalize included sources, search/alert limits, whether Agent includes Premium,
   number of products/sellers, service duration, fee basis, completion criteria,
   cancellation and refund rules. Implement separate entitlements: the existing
   deal pilot is still Premium-gated and must match the new packaging.
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
   API/MCP capabilities and each client's supported connection method. Start with
   search and offer comparison; expose account-scoped alerts, deal status and
   selling only with the appropriate entitlement and explicit approval for sends,
   publishing or purchases. Implement connection, revocation, scopes, ownership,
   errors and setup instructions. Verify a complete real-client flow separately
   in ChatGPT and Claude. The existing selling CLI is not a shipped connector;
   local MCP work is not completion until committed, deployed and tested in both.

### Completed foundations from the recent work

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

- [x] Current Premium pricing is **49 RON/week or 499 RON/year**, with a **3-day first-subscription trial**. Server-validated Stripe amounts are `4900`/week and `49900`/year in `ron`. This supersedes the historical 99 RON/month proposal.
- [ ] **P1** — Finalize tax treatment and alert limits; verify enforcement of the confirmed 3-day first-subscription trial before live checkout activation.
- [ ] **P1** — Configure Stripe for production; test-mode integration exists, but live billing is not yet enabled.
- [ ] **P1** — Create production and test-mode Stripe Product and Price records.
- [x] Authenticated Checkout Session creation and success/cancel return flows implemented for test billing; production acceptance remains open.
- [ ] **P1** — Store a durable mapping between the Supabase user, Stripe customer, and subscription.
- [ ] **P1** — Add a signed, idempotent Stripe webhook endpoint.
- [ ] **P1** — Translate subscription lifecycle events into `user_entitlements` updates.
- [ ] **P1** — Handle `active`, trial, `past_due`, cancelled, expired, refunded, and grace-period behavior.
- [x] Billing portal session creation and account UI implemented; production portal configuration and acceptance remain open.
- [x] Pricing and account UI connected to billing endpoints; test-mode only, with live checkout acceptance still open.
- [ ] **P1** — Define cancellation, refund, entitlement-expiry, and reactivation rules.
- [ ] **P1** — Add webhook replay, duplicate-event, failed-payment, cancellation, and authorization tests.
- [ ] **P1** — Add operational logging and a reconciliation job for Stripe/Supabase entitlement drift.
- [ ] **P1** — Document production secrets, webhook rotation, support procedures, and rollback steps.
