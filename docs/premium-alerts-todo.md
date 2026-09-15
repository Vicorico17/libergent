# Premium, Product, and Launch TODO

Last prioritized: 2026-09-15
Implementation and production status audit: 2026-09-13 (unless noted below)

See [the September launch audit](launch-audit-2026-09-13.md) for the comparison
with the owner's full list, current code evidence, dependencies, and newly
identified gaps. Historical deployment checkmarks below were not reverified.

This is the source of truth for launching Premium vehicle alerts, completing
paid Premium subscriptions, and tracking the next product work. A checked item
is implemented or has been explicitly confirmed in the target environment;
unchecked operational items must be completed before the corresponding test or
launch.

## Priority and execution order

Priorities reflect the owner-confirmed focus on second-hand technology in Romania.
Within each priority, follow the order below and complete prerequisites before
activating dependent features. Priority does not mean implementation is complete.

- **P0 — Now:** search relevance, trustworthy source results, basic authentication,
  and acceptance of currently exposed messaging. These protect the core experience.
- **P1 — Before paid launch:** unit economics, billing, onboarding, Premium alert
  acceptance, and operational recovery. Required before selling the relevant service.
- **P2 — After the core and paid flow work:** picture search, passkeys, new tech
  sources, deeper feedback tooling, and acquisition optimization.
- **P3 — Later:** calls and expansion beyond the initial technology niche.

| Order | Priority | Workstream | Completion evidence / dependency |
| --- | --- | --- | --- |
| 1 | P0 | Tech query matching, model/variant/condition accuracy, used versus new comparisons | Dated representative queries and regression fixtures; wrong products and accessories excluded; usable prices and photo fallbacks verified |
| 2 | P0 | Validate advertised sources and search health | Dated source results, useful counts, explicit errors/cache state; fix or demote unreliable sources; details in the marketplace TODO |
| 3 | P0 | Email/Google login and account ownership | New and returning users pass mobile/desktop acceptance, expiry, resend, callback and ownership checks |
| 4 | P0 | Existing seller messaging | Controlled-recipient delivery, replies, failures and consent verified; explicit delivery states and supported contact routes |
| 5 | P1 | Source costs and total service economics | Actual usage/rates, cost per useful result and alert scan, margin and fair-use limits for 99 RON/month |
| 6 | P1 | Billing policy and subscription implementation | Confirm trial/tax/limits, then provider and prices → customer mapping/checkout → signed webhooks/lifecycle → portal/reconciliation and tests |
| 7 | P1 | Paid onboarding and acquisition measurement | Funnel plan can start now; validate checkout → entitlement → first search/alert after billing works |
| 8 | P1 | Deployed Premium alert acceptance | Choose inbox/email mode, configure it, then complete every acceptance item below; verify expiry and cron before advertising alerts |
| 9 | P1 | Feedback protection and ranking evaluation | Validate existing reports and ownership, retention/deduplication; reviewed fixtures and measured quality before scoring releases |
| 10 | P2 | Image search, passkeys, feedback review tooling, checkout recovery optimization | Core acceptance first; provider/device tests and bounded costs before activation |
| 11 | P2 | Additional tech sources and Facebook feasibility | Existing-source quality first; useful coverage and supported access/runtime demonstrated before production exposure |
| 12 | P3 | Calls and other product niches | Reliable messaging first for calls; strong tech search first for niche expansion |

Unchecked tasks below carry a priority. Checked items retain their historical
status; this prioritization does not reverify production configuration. The
marketplace TODO uses the same priorities. The launch audit remains historical.

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

- [ ] **P0** — Rework the login/signup email experience, including validation, OTP feedback, loading states, error messages, resend behavior, and callback handling.
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
- [ ] **P0** — Keep the detailed source inventory and integration status synchronized with `docs/marketplace-integration-todo.md`.

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
- [ ] **P0** — Test the full “reach out for me” flow in production: contact discovery, user confirmation, outbound delivery, provider receipt, inbound reply, history, and failure recovery.
- [ ] **P0** — Make delivery state explicit: queued, sent, delivered, failed, replied, or unavailable.
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

- [x] Owner confirmed LiberGent Premium at **99 RON/month**. Future Stripe Price: currency `ron`, unit amount `9900`, recurring interval `month`; server-owned price ID.
- [ ] **P1** — Confirm trial policy, tax treatment and alert limits before checkout activation.
- [ ] **P1** — Select and configure the billing provider; Stripe is the current expected integration.
- [ ] **P1** — Create production and test-mode Stripe Product and Price records.
- [ ] **P1** — Add authenticated Checkout Session creation and success/cancel return flows.
- [ ] **P1** — Store a durable mapping between the Supabase user, Stripe customer, and subscription.
- [ ] **P1** — Add a signed, idempotent Stripe webhook endpoint.
- [ ] **P1** — Translate subscription lifecycle events into `user_entitlements` updates.
- [ ] **P1** — Handle `active`, trial, `past_due`, cancelled, expired, refunded, and grace-period behavior.
- [ ] **P1** — Add a customer billing portal for payment-method changes, invoices, and cancellation.
- [ ] **P1** — Connect pricing and account UI to real checkout and subscription status.
- [ ] **P1** — Define cancellation, refund, entitlement-expiry, and reactivation rules.
- [ ] **P1** — Add webhook replay, duplicate-event, failed-payment, cancellation, and authorization tests.
- [ ] **P1** — Add operational logging and a reconciliation job for Stripe/Supabase entitlement drift.
- [ ] **P1** — Document production secrets, webhook rotation, support procedures, and rollback steps.
