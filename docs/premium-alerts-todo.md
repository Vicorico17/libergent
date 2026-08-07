# Premium Alerts and Billing TODO

Last reviewed: 2026-08-07

This is the source of truth for launching Premium vehicle alerts and completing
paid Premium subscriptions. A checked item is implemented or has been explicitly
confirmed in the target environment; unchecked operational items must be completed
before the corresponding test or launch.

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
- [ ] Add the test account to `user_entitlements` with `plan = 'premium'` and `status = 'active'`.
- [ ] Confirm the entitlement query returns the intended test-account email.
- [ ] Configure the Worker secret `SUPABASE_URL`.
- [ ] Configure the Worker secret `SUPABASE_SECRET_KEY` with the Supabase secret/service-role key.
- [ ] Configure the Worker secret `LIBERGENT_ADMIN_TOKEN` for manual alert-run testing.
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
