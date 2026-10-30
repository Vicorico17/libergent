# Release acceptance checklist

Updated: 2026-10-30. Companion to [the implementation backlog](premium-alerts-todo.md).
This file describes what to check; unchecked items have **not passed live acceptance**.
Latest local baseline: 411 backend tests + 8 UI helper/data checks passed; Worker
dry-run and UI lint/build are checked for the current reliability batch. These do
not establish staging or production readiness. PR #39 is still a draft.

## 1. What you need to prepare

| For | You provide or decide | Engineering prepares |
| --- | --- | --- |
| First staging session | Access to an isolated Supabase test project and Cloudflare; two different email-verified test accounts; access to their email inboxes | Staging origin, matching UI/Worker configuration, required schemas, Auth callback URLs and test data |
| Browser checks | Desktop plus phone, or mobile browser emulation; two separate browser profiles | Test build, route list, reproducible scenarios and error logs |
| API acceptance | Sign into both accounts; configure their temporary access tokens locally when testing | Acceptance script and results; no tokens in chat, Git, screenshots or PRs |
| Product terms | Confirm Agent duration, included sellers/products, Premium inclusion, completion criteria, cancellation/refund terms; confirm prices and support contact | Implement the confirmed rules and matching checkout/product copy |
| Payment tests, later | Stripe test-mode access and test products/webhook setup | Payment scenarios, entitlement checks and webhook replay tests; live-mode support remains unfinished |
| Agent pilot, later | A controlled test recipient you own or a willing tester; a test listing and approved message | Test bridge/channel configuration, Agent entitlement, receipts/recovery tooling; explicit approval before any real message or call |
| VINDE pilot, later | Seller test accounts/connections and a clearly identified test listing | Test publication, status reconciliation and cleanup; explicit approval before external publication |
| Production release | Choose which features are included and confirm product acceptance | Migration/deployment order, backup/rollback procedure, monitoring and release evidence |

For the first session, only the first three rows are needed. Do not configure
live charging or real outreach just to test login and developer keys.

## 2. Environment and automated checks — engineering

- [ ] Record the exact Git commit, staging origin, database project and date.
- [ ] Confirm staging UI and Worker use the same test Supabase project.
- [ ] Configure Auth site URL, `/confirm` redirect and any enabled login provider.
- [ ] Apply `supabase/developer-api.sql` for API acceptance.
- [ ] For Agent tests, apply relevant account/Agent schemas and reapply both
  `supabase/deals.sql` and `supabase/whatsapp_messages.sql` before the matching
  Worker/UI. Record which migrations actually ran and where.
- [ ] Reapply `supabase/selling.sql` before VINDE status/recovery deployment;
  deploy the revised inbound forwarder and verify its real message ID fields.
- [ ] Configure only the additional test services required for the chosen feature.
  Default `wrangler.staging.toml` has no Browser Run, scheduled jobs, billing or
  outreach secrets; it cannot prove those features work until configured.
- [ ] Run `npm run check`, `npm run check:integration-runtime`, UI lint and UI build
  for the release commit. Run `npm run verify:ui-auth-config` on the staging build.
- [ ] Confirm required remote CI checks pass on that same commit.
- [ ] With two account tokens configured locally, run:

```sh
npm run check:developer-api -- https://YOUR-STAGING-HOST
```

Use `LIBERGENT_ACCEPTANCE_SESSION_TOKEN` and
`LIBERGENT_ACCEPTANCE_SECOND_SESSION_TOKEN`. Follow the full
[staging setup](developer-api.md#staging-account-acceptance-checklist).
The script creates/revokes a test key and checks simulated API behavior;
it does not test live sources, browser journeys, payments or messaging.
Both accounts must be tested; “isolation not tested” is not a pass.

## 3. Product checks — you and engineering together

Check a row only after its expected result is observed on the recorded build.
An unfinished feature is **Blocked**, not Passed or silently skipped.

| Check | What to do | Expected result |
| --- | --- | --- |
| Login and session | Sign up/confirm, sign in/out, reload; repeat with expired session | Correct account remains visible; signed-out/expired sessions cannot perform private actions |
| Account isolation | Use accounts A and B in separate profiles; switch accounts in one profile | Keys, usage, conversations, deals, alerts and listings stay with their owner; no stale private data from the prior account |
| Free search | Search several ordinary products; vary location, condition and price; refresh | Useful matching listings, correct filters and visible source failures; refresh replaces the snapshot |
| Free cost boundary | Engineering requests a paid provider or Premium source through each Free route | HTTP 400; no paid-provider/browser work |
| Search cache recovery | Repeat complete and partially failed searches; simulate recovery | Complete snapshots last at most five minutes, partial source/page failures at most one minute; old partial entries trigger a new search |
| Source accuracy | Open sample results from each advertised source and compare title, price, URL and availability | Evidence matches source pages; inaccessible sources are reported honestly. OLX/Okazii currently remain blocked in local probes |
| Premium access | Try with an anonymous, Free and entitled account | Only the entitled account gets Premium; cache cannot bypass authorization; browser usage is bounded and recorded |
| Rate limits | Engineering exercises limits in staging, including both Free aliases and forced refresh | Denial occurs before search work, with retry guidance; unavailable enabled limiter fails closed. Edge counters are approximate per location, not a global cap |
| Developer portal | Create/copy a test key, reload, inspect usage, revoke; switch accounts | Secret shown only at creation; usage belongs to owner; revoked key fails even for cached results |
| Live developer key | Run a small, agreed live-source test after simulated acceptance | Real results, scopes and quotas behave correctly; no assumption that simulated success proves source availability |
| ChatGPT/Claude | Connect the intended endpoint in each supported client and run real conversations | Correct tools/results, errors and identity; Free connector never silently grants Premium. Hosted OAuth remains unfinished |
| Payments — blocked until ready | In test mode, test purchase, duplicate webhook, renewal, failed payment, cancellation and expiry | Correct price and entitlement state; no duplicate entitlement changes; UI agrees with server. Live enablement is a separate decision |
| Agent access | Try outreach with Free, Premium-only and Agent accounts | Outreach requires Agent access; Premium search alone does not authorize it |
| Agent acceptance/duplicates | With the controlled recipient, submit once, retry same key, double-click and reload/retry | At most one provider submission for that key; accepted response has a provider ID; unknown outcome stays unknown. Separate tabs may create different keys |
| Agent uncertain outcome | Simulate malformed receipt, provider timeout and failed history/ledger write | No fabricated delivery success and no automatic resend; operator can identify what needs reconciliation. Full reconciliation tooling remains open |
| Reply ownership | Test one seller with multiple listings/buyers, unlabelled replies and quoted replies with known/unknown original IDs | Ambiguous replies stay separate; only an exact stored outbound ID and seller match routes a quoted reply; replay cannot overwrite ownership |
| Seller stop | Controlled recipient sends STOP; try new messages and pilot calls from different accounts/listings | WhatsApp sends and new calls are blocked before provider contact; ordinary replies/history deletion do not clear the stop. Opt-in recovery remains open |
| Agent completion | Follow the approved workflow through terms, buyer approval and completion | Buyer approves commitments; seller wording alone does not mark a completed deal; promised service limits match behavior |
| Alerts | Create, trigger, deduplicate, pause and expire an alert | Correct recipient, no repeated notifications, inactive entitlement prevents scheduled work |
| VINDE — controlled pilot | Create/edit draft and images, publish approved test listing, simulate uncertain publish, refresh by external ID, remove/moderate a test advert, check a multipage Okazii feed | Only one exact receipt confirms recovery, no resend; inactive/rejected states stay distinct; feed errors never produce partial XML. Sold sync and withdrawal still require implementation/acceptance |
| Account/support lifecycle — blocked until ready | Export/delete the test account, exercise retention and contact support | Documented data behavior actually occurs; no cross-account data; support route works; stop preferences are not accidentally erased |
| Mobile and errors | Run key journeys on phone/desktop with slow/offline network; use keyboard; check landing ticker across two loops/resizes | No stuck send/loading states, duplicate action or hidden error; forms remain usable; no page overflow or ticker jump |
| Image search — blocked | Test only after provider/UI implementation exists | Correct intent/results or clear failure; do not advertise the current validation stub as working search |

## 4. When are we done?

- [ ] Define the release scope. A developer API beta can be accepted separately
  from full paid Agent/VINDE launch; unfinished features must be excluded from
  access and claims, not treated as passed.
- [ ] Every included feature has passed its checks above with recorded evidence.
- [ ] No unresolved account-isolation, duplicate-side-effect, charging or false
  success defect remains in the included scope.
- [ ] Product text, prices, service limits and support details match the build.
- [ ] Operations can see errors, limits and provider usage; alert ownership and
  rollback steps are documented and exercised. Global caps remain separate work.
- [ ] Migrations, matching Worker/UI deployment and rollback compatibility are
  reviewed; production deployment is explicitly authorized and recorded.
- [ ] After deployment, repeat a small production smoke test for included features
  and check logs/metrics. Staging results alone do not mark production accepted.
- [ ] Remove/revoke test keys, clear local session tokens and clean up any approved
  test publications/subscriptions. Record cleanup failures for follow-up.

## 5. Evidence sheet — fill during testing

| Build / environment | Check | Status: Not run / Pass / Fail / Blocked / Out of scope | Expected vs actual | Evidence link, no secrets | Issue / owner / retest |
| --- | --- | --- | --- | --- | --- |
| Not recorded | Staging acceptance | Not run | Awaiting configured test environment | — | Owner + engineering |

For a failure, record steps, account A/B, timestamp, browser/device, request ID
if available, and a screenshot or sanitized log. Do not record passwords, access
tokens, full API keys or real seller personal data in shared evidence.
