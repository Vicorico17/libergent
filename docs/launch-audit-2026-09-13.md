# Libergent launch audit — 2026-09-13

Compared the owner's September list with the repository TODOs and code. This is
a local implementation audit, not production acceptance. No payments, seller
messages, calls, database migrations, or deployments were performed.

Owner clarification: start with **second-hand technology**, retaining retail
shops as new-price references to help decide between used and new. Premium is
**99 RON/month** (9900 minor units, `ron`, monthly); trial and tax treatment remain
undecided. Pricing surfaces share the same amount; checkout is still unavailable.

The retail comparison now remains visible when used-condition/type or budget
filters are applied, while respecting explicit marketplace exclusions and
feedback. It compares the displayed used and new prices in RON and percent,
states when retail is cheaper, and shows an unavailable-reference message when
no new price is found. Differences are indicative, not proof of identical
configuration, included delivery, warranty or current stock.

## Owner list versus implementation

| Workstream | Evidence and status | Remaining work |
| --- | --- | --- |
| Email and Google authentication | `GoogleSignIn.tsx` implements magic links and Google OAuth; callback and safe-next-path code exist | Browser acceptance for new/returning users, mobile/desktop, expired links, resend, cancellation, account switching, and return-to-checkout |
| Premium purchase, Stripe, cancellation, portal | Premium entitlement checks exist; Stripe checkout/webhooks/customer mapping do not | Confirm price/currency/interval and Stripe account; implement durable subscription mapping, signed idempotent webhooks, portal, reconciliation, recovery, and lifecycle tests |
| Picture search | `/api/image-search` exists but `extractImageSearchIntent()` always throws provider-not-configured | Select vision provider/model, authenticated bounded uploads, keyword extraction, review/edit UI, request limits, usage costs, and image privacy policy |
| Public Free/Premium list | Implemented in this batch at `/pricing#surse`, backed by `/api/sources` | Validate every advertised source with dated representative searches; replace experimental status only with evidence |
| Source selection and costs | Registry routes by query; direct/Kitesurf/Chromium fallback logic exists | Measure incremental useful offers, latency, billable duration, failures, final-price accuracy, and cost per useful offer per source |
| Facebook Marketplace skill | Local skill and prior assessment exist; no production adapter | Validate Romanian location/session behavior, provision supported runtime, assess permitted use, minimize retained seller data, preserve partial/error states and contact link-out |
| Full operating costs, phone, text/voice model, VPS, Cloudflare | Environment variable placeholders are not evidence of configured services or paid plans | Obtain actual provider names, contracted rates, usage exports, and invoices; use the cost worksheet below |
| “Reach out for me” / messaging | Authenticated outbound bridge and owner-scoped conversation history exist, with backend tests | Production controlled-recipient delivery/receipt/reply/failure tests, provider status callbacks, retry idempotency, and per-source contact-policy review |
| Voice/calls/history | `call-pipeline.js` builds validated jobs and accepts an injected call function | Real telephony adapter, consent/disclosure requirements, user controls, durable jobs/callbacks, status, duration, cost, transcript retention, handoff, and history UI |
| Alerts | Premium API, baseline/delta logic, inbox, email webhook, cron configuration exist | Full deployed acceptance checklist in `premium-alerts-todo.md`, including ownership, sixth-alert rejection, baseline silence, deduplication, entitlement expiry, retries, and email outcomes |
| Marketing/acquisition | Landing, pricing, authentication, leads, analytics component exist | Checkout activation and first-value onboarding; consent-aware funnel events, recovery paths, attribution, conversion reporting, and validated customer segment |
| Photos on special recommendations | Implemented in this batch with existing image fallback hook | Visual QA with real photos, broken images, mobile and desktop |
| Weak-match feedback | Authenticated structured reports and local-session exclusions exist | Review/group reports, deduplicate and rate-limit, produce reviewed regression fixtures, evaluate quality before rollout; do not silently train ranking from one vote |
| Passkeys | No passkey UI or implementation found | Verify current authentication-provider support, then enrollment/revocation/recovery, relying-party/origin configuration and cross-device acceptance |
| Kitesurf fallback | Worker fallback, provider implementation, benchmark script and tests exist | Run dated direct/Kitesurf/Chromium comparison with account credentials and budget; tune eligibility using useful recovery rather than raw cards |
| Repeat-search trust | Added stable final tie-breakers and Free five-minute Worker caching; Premium already cached | Durable shared versioned snapshots and explicit refresh if identical results across devices/regions are required; distinguish source outage from inventory change |

## What was missing from the existing TODO

- Repeat-search consistency and an explicit freshness contract.
- Photos on closest-offer and new-price special cards.
- Accurate adapter inventory: **117**, with **12 Free and 105 experimental Premium**; older docs said 43.
- Explicit separation between endpoint/helper scaffolding and a working image/voice feature.
- Distinct local-test, production-configuration, and production-acceptance states.
- Unit economics based on incremental useful results, including failed attempts and cache hits.

## Search trust: diagnosed contributors and limits

Free Worker searches previously fetched live sources on every request. Source
failures, changing pages, and inventory changes alter the candidate set and its
price median, which can change recommendation scores. Ranking was local, not a
random language-model decision, but equal scores/prices inherited input order.

This batch adds a stable listing-identity tie-breaker and reuses successful,
nonempty Free payloads for five minutes. Location, filters and tier remain
separate; Premium still authenticates before reading its cache. Empty/failed
searches are not pinned. The UI shows collection time instead of “Live”.

This reduces refresh drift; it does not promise immutable live inventory.
Cloudflare Cache API is edge-local and evictable, concurrent cold requests can
still differ, and local Node development does not use this cache. A stronger
contract needs a shared snapshot store with a search/version ID, coalesced cold
requests, explicit refresh and a change summary. Fresh alert scans must remain
independent of a buyer's frozen snapshot.

## Romania deal-quality acceptance

Use the owner's scraping notes to select the first niche and fixtures. For each
query, preserve a dated source snapshot and human judgments for product/model,
condition, accessory versus main product, currency, payable price, location,
availability, duplicate status and seller evidence. Compare top-result relevance,
valid unique offers, wrong-model/accessory rate, verifiable savings, response time,
source failures and cost. An adapter count is not a deal-quality metric.

Prefer official feeds or permitted first-party product data when available.
Treat transport success with zero relevant cards as no useful recovery. Preserve
the direct-first policy and stop on access challenges. Add new sources only when
they improve useful coverage in the selected Romanian niche.

## Operating-cost worksheet

Actual amounts are **unknown**, not zero. No account billing exports or provider
contracts were supplied. Keep all rows in one reporting currency and record the
invoice month, conversion rate/date, taxes and discounts. Avoid double-counting
bundled provider charges.

| Cost component | Fixed monthly input | Variable inputs |
| --- | --- | --- |
| Phone number | Rental, number verification/setup amortization | SMS/verification attempts, carrier surcharges |
| Seller messaging | Provider/bridge subscription | Outbound and inbound messages, templates/conversations, retries |
| Text/vision model | Minimum commitment, if any | Input/cached/output tokens, images, tool/search calls by model |
| Voice model | Minimum commitment, if any | Audio input/output tokens OR transcription/synthesis minutes, as billed |
| Telephony | Voice provider subscription | Connected minutes, ringing if billed, recording/storage, transfers |
| OpenClaw VPS | Instance, backups, monitoring | Extra storage, bandwidth, egress |
| Cloudflare | Workers/Browser plan commitments | Requests, CPU, billable browser sessions/duration, storage/queues/egress |
| Supabase | Database/auth plan | Compute, storage, egress, active users beyond allowance |
| Email | Delivery plan | Authentication and alert email, retries |
| Billing | Billing subscription if any | Payment percentage/fixed fee, currency conversion, refunds/disputes |
| Other | Domain amortization, logs, support tools | Log volume, support, acquisition spend reported separately |

For every metered row: `variable cost = max(0, usage - included allowance) × unit rate`.
Model tiered rates explicitly when a contract uses tiers.

- Monthly service cost = fixed cost + variable cost.
- Cost per active user = monthly service cost / active users (undefined at zero users).
- Cost per search, Premium search, alert scan, message and call = attributed
  variable cost / corresponding count; report fixed allocation separately.
- Per-source cost per useful offer = attributed source cost / valid unique offers
  contributed, including failed attempts in the numerator (undefined at zero offers).
- Service gross margin = (net subscription revenue - service cost) / net subscription revenue.
- Model low/base/high usage, cache-hit rates and hourly-alert load before selecting
  Premium limits. Keep marketing acquisition cost separate from service margin.

## Release evidence for this batch

- Backend suite: 159 tests passed, including shuffled source/listing ranking,
  snapshot reuse, location/filter isolation and simulated expiry.
- UI lint, TypeScript checks and the production static build passed.
- Browser visual verification and all production acceptance remain open.
- No deployment performed.
