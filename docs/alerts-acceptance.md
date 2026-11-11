# Account alerts: behavior, setup and acceptance

Updated: 2026-11-11. This supersedes the earlier Premium-only vehicle alert plan.
Implemented locally; no hosted migration, deployment or real email was performed.

## How it works

1. Sign in, search for a product and choose **Creează o alertă**, or open
   **Contul meu → Alerte**. A signed-out visitor is sent through login with the
   alert query preserved.
2. Enter a product (for example iPhone 15, gravel bike or BMW 320d), optional
   maximum price and location. Vehicle year/mileage filters are optional.
3. Choose **new products and price drops** or **only good deals and price drops**,
   then an hourly check or daily summary. Each account can have five active alerts;
   a Premium subscription is not required and expiry does not disable alerts.
4. The first successful scan for each marketplace stores its current inventory
   without sending historical notifications. Later scans identify newly observed
   matching products, strong deals, better offers or meaningful price drops.
5. Notifications appear in the account inbox. Email is optional infrastructure:
   the UI explicitly says when it is unavailable. Pause, resume, delete and mark
   read are authenticated and scoped to the owning account.

“New” means first observed after that source's baseline, not independently proven
publication time. Products mode requires relevance >=70. Deal mode uses existing
recommendation score >=65 and confidence >=40; better offers need score >=70 and
at least 10 points above previously tracked offers. Price drops require 1000 RON
or 5%. Ranking is a heuristic, not a guarantee that an offer is the lowest price.
Sources are the direct, category-appropriate Free search marketplaces; no paid
browser/provider calls or search credits are used for these scans. Location is
text matching with diacritic normalization; geographic radius is not supported.

## Persistence and failure behavior

- `alert_profiles` has a database trigger enforcing five active alerts using a
  per-account transaction advisory lock. API checks are only early feedback.
- Each scan claims a two-minute lease. The database rejects stale, paused or
  replaced claims. Pausing clears the claim. Up to three scans run concurrently,
  with twenty due profiles per scheduler invocation.
- `commit_alert_scan` writes state, deduplicated events, email batches and the
  successful scan timestamp in one transaction. Failed scans cannot advance the
  baseline. Complete source results are processed independently; a failed source
  establishes its own baseline on recovery without flooding historical events.
- Listing state reads paginate. Duplicate listing URLs are collapsed before writes.
  Missing/nonpositive prices and non-HTTP listing URLs do not match.
- `alert_email_outbox` stores immutable batches. Daily alerts queue one summary;
  hourly alerts queue individual events. Email claims use row locks, with at most
  twenty per invocation. Paused alerts do not claim pending emails; deleting an
  alert removes its states, events and outbox rows.
- Explicit webhook rejections can retry on a later hourly run, at most three
  attempts. Requests time out after fifteen seconds. Network uncertainty, 5xx,
  missing receipts and interrupted sends become `unknown` and are not automatically
  resent. An operator must reconcile these with the email provider. No operator
  reconciliation UI is included. A stable `Idempotency-Key` accompanies each batch;
  the receiver should honor it. A receipt means provider acceptance, not inbox delivery.
- With no email webhook/address, delivery is `skipped`; in-account events remain.
  The older `notification_deliveries` table is historical; new deliveries use the outbox.

## Setup before trying the hosted flow

1. Reapply `supabase/search_tracking.sql` to the target project before deploying
   the matching Worker/UI. This adds leases, per-source baselines, quota trigger,
   outbox and service-only RPCs. Existing profiles/events are retained; existing
   profiles establish fresh source baselines on their next successful scan.
2. Keep Supabase URL/service credentials and login configuration aligned. The
   alert tables and RPCs are service-only; browsers use authenticated Worker APIs.
3. Deploy the matching Worker/UI and retain the hourly minute-15 cron. Node dev
   provides the management API; scheduled execution belongs to the Worker.
4. Start inbox-only. To enable email, configure `ALERT_EMAIL_WEBHOOK_URL` and
   optional `ALERT_EMAIL_WEBHOOK_TOKEN`. The receiver accepts `{to,subject,text,
   html,metadata}`, returns `{id:"provider-receipt"}` or `{messageId:"..."}` on
   acceptance, and honors `Idempotency-Key`. Real transport still needs testing.
5. An authenticated admin can POST `/api/admin/alerts/run` using
   `LIBERGENT_ADMIN_TOKEN`. It runs only due profiles and pending deliveries;
   it does not force every profile or bypass pause/leases. Never expose this
   token through the UI or store it in an acceptance report.

## Local evidence

Current shared-worktree result: **25 alert tests pass; all 499 backend tests pass**.
The isolated alert branch also passes `npm run check`: **475 backend tests and
13 UI data tests**, plus UI lint, TypeScript and the Webpack production build.
The different totals exclude unrelated work in the shared checkout.

`npm run test:alerts` covers matching, real Worker routes with REST/email fixtures,
cron dispatch and real PostgreSQL semantics using PGlite. The SQL tests cover
quota enforcement, many paused profiles, migration replay, transaction rollback,
source recovery, stale leases, deduplication, outbox claiming/retry limits,
unknown outcomes, pause/delete and denied public privileges.

PGlite uses one connection: simultaneous independent PostgreSQL transactions still
need staging verification. REST fixtures validate ownership filters but do not
substitute for real Auth/PostgREST/browser acceptance. No live marketplace or
provider sends occur in these tests.

UI TypeScript and ESLint checks pass. `npx next build --webpack` passes with static
account/search pages. Default Turbopack compilation stalled locally and was
stopped. The in-app browser execution tool was unavailable, so desktop/mobile
visual acceptance remains open.

## Hosted acceptance still to run

- [ ] Record build, project and migration version; use two verified test accounts.
- [ ] Free account creates a generic product alert; anonymous access is rejected.
- [ ] Follow search → login → prefilled alert; test both modes and optional filters.
- [ ] Baseline stays silent; controlled new inventory and price changes produce
      the expected account events. Replay does not duplicate events/email batches.
- [ ] Verify actual source access, partial failures, recovery and daily/hourly timing.
- [ ] Create/resume simultaneously from separate transactions at the active limit;
      no sixth active alert. Verify account B cannot access or change A's records.
- [ ] Pause/resume/delete, reload, mark read, logout and switch accounts on desktop
      and mobile. Confirm no stale private state or silent failed actions.
- [ ] Real email receiver accepts the stable batch key, delivers to the test inbox,
      and handles explicit rejection, timeout and reconciliation without duplication.
- [ ] Observe deployed minute-15 cron, more than twenty due profiles and backlog
      drain. Measure scan cost, provider throttling and suitable global quotas
      before opening account alerts broadly. The per-account cap is not a global cap.
- [ ] Clean up test alerts and restore settings; record results without credentials.
