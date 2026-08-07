# Premium, Product, and Launch TODO

Last reviewed: 2026-08-07

This is the source of truth for launching Premium vehicle alerts, completing
paid Premium subscriptions, and tracking the next product work. A checked item
is implemented or has been explicitly confirmed in the target environment;
unchecked operational items must be completed before the corresponding test or
launch.

## Recently completed product work

- [x] Show a clear Premium or Free marker on the account page.
- [x] Require a valid Premium entitlement for Premium search.
- [x] Make the Premium loading screen expandable so users can inspect searched sources.
- [x] Present the closest good match and new-price benchmark as separate special-result cards.
- [x] Remove the unsupported `Ajută rankingul: Bun / Slab` controls from search results.
- [x] Remove the `Copiază mesaj` button and its unused clipboard logic.

## Product and customer-acquisition backlog

### Login, signup, and purchase flow

- [ ] Rework the login/signup email experience, including validation, OTP feedback, loading states, error messages, resend behavior, and callback handling.
- [ ] Test Google login and email OTP end to end on production, mobile, and desktop.
- [ ] Design the complete customer-acquisition funnel: landing page → pricing → signup/login → checkout → Premium entitlement → onboarding → first Premium search or alert.
- [ ] Define acquisition analytics and conversion events for every funnel step.
- [ ] Add abandoned-checkout and failed-payment recovery paths.
- [ ] Add a post-purchase confirmation page that clearly explains the active plan and next action.

### Search and marketplace access

- [ ] Add search by picture: upload an image, identify the product, let the user edit extracted keywords, and then run the normal search pipeline.
- [ ] Publish a clear customer-facing list of Free and Premium marketplaces.
- [ ] Explain why each source is Free or Premium: access method, query relevance, reliability, browser/API requirements, and operational cost.
- [ ] Measure cost per search and cost per useful result for each paid/browser-backed marketplace before finalizing the Premium source list.
- [ ] Validate every advertised source with representative searches and demote sources that repeatedly return no useful results.
- [ ] Evaluate the installed Facebook Marketplace search skill for a compliant, user-authorized, read-only Libergent integration.
- [ ] Define Facebook Marketplace session, location, privacy, rate-limit, reliability, and seller-contact rules before exposing it in production.
- [ ] Keep the detailed source inventory and integration status synchronized with `docs/marketplace-integration-todo.md`.

### Libergent operating-cost model

- [ ] Build a monthly fixed-versus-variable cost breakdown and calculate cost per active user, search, Premium search, alert scan, message, and call.
- [ ] Record phone-number rental, verification, and messaging charges.
- [ ] Record Libergent text-model API input, output, tool, and search costs.
- [ ] Record Libergent voice-model API transcription, synthesis, realtime, and call-minute costs.
- [ ] Record the OpenClaw VPS cost, storage, bandwidth, backups, and monitoring.
- [ ] Record Cloudflare Workers, Browser Rendering, requests, CPU, storage, queues, and related API costs.
- [ ] Include Supabase, email delivery, billing-provider fees, observability, domains, and other production services.
- [ ] Compare total service cost with the Premium price and define a target gross margin and fair-usage limits.

### Seller messaging and calls

- [x] Allow seller messaging actions only for logged-in users.
- [x] Group message chat and history by listing for the owning account.
- [ ] Test the full “reach out for me” flow in production: contact discovery, user confirmation, outbound delivery, provider receipt, inbound reply, history, and failure recovery.
- [ ] Make delivery state explicit: queued, sent, delivered, failed, replied, or unavailable.
- [ ] Confirm each marketplace permits the selected contact mechanism and preserve link-out contact where direct sending is unsupported.
- [ ] Add calls as the next communication channel only after messaging delivery and consent are reliable.
- [ ] Define call consent, disclosure, recording, retention, phone-number ownership, abuse prevention, handoff, and escalation rules.
- [ ] Add per-listing call history, status, duration, cost, transcript/summary, and follow-up action.

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
- [ ] Decide whether the first test is inbox-only or includes email delivery.
- [ ] If testing email, configure `ALERT_EMAIL_WEBHOOK_URL` and, if required, `ALERT_EMAIL_WEBHOOK_TOKEN`.
- [x] Run `npm run build:ui` successfully in the pre-deployment or CI environment.
- [x] Review the dirty worktree and stage only the changes intended for the alert release.

## Alert acceptance test

- [ ] A free account receives the Premium-required state and cannot create an alert.
- [ ] The Premium test account can create an alert with structured vehicle filters.
- [ ] A sixth active alert is rejected.
- [ ] Pause, resume, and delete work only for the owning account.
- [ ] The first scheduled/manual scan stores listing state and creates no historical notifications.
- [ ] A later scan can create a deduplicated new-match or price-drop event.
- [ ] The event appears in the correct account inbox and can be marked read.
- [ ] Inbox-only mode records email delivery as `skipped` when no webhook is configured.
- [ ] Email mode records `sent` or a useful `failed` error without losing the in-account event.
- [ ] An inactive, expired, cancelled, or past-due entitlement blocks access and pauses scheduled alerts.
- [ ] The hourly Cloudflare cron invokes the due-alert runner in the deployed environment.

## Premium billing backlog

- [ ] Confirm the paid plan name, price, currency, billing interval, trial policy, and alert limits.
- [ ] Select and configure the billing provider; Stripe is the current expected integration.
- [ ] Create production and test-mode Stripe Product and Price records.
- [ ] Add authenticated Checkout Session creation and success/cancel return flows.
- [ ] Store a durable mapping between the Supabase user, Stripe customer, and subscription.
- [ ] Add a signed, idempotent Stripe webhook endpoint.
- [ ] Translate subscription lifecycle events into `user_entitlements` updates.
- [ ] Handle `active`, trial, `past_due`, cancelled, expired, refunded, and grace-period behavior.
- [ ] Add a customer billing portal for payment-method changes, invoices, and cancellation.
- [ ] Connect pricing and account UI to real checkout and subscription status.
- [ ] Define cancellation, refund, entitlement-expiry, and reactivation rules.
- [ ] Add webhook replay, duplicate-event, failed-payment, cancellation, and authorization tests.
- [ ] Add operational logging and a reconciliation job for Stripe/Supabase entitlement drift.
- [ ] Document production secrets, webhook rotation, support procedures, and rollback steps.
