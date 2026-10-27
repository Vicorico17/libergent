# Project improvements — 2026-09-25

Repository based on `06a5164` from `main`. This review combines the existing project backlog, the September 16 audit, and the owner's request that Premium accounts always search with Premium. This batch is prepared for Git handoff and user testing; deployment is not verified.

## Where the full TODO list lives

- [Product, Premium and launch TODO](premium-alerts-todo.md): authoritative product execution order, authentication, messaging, feedback, operating costs, billing and alerts.
- [Marketplace integration TODO](marketplace-integration-todo.md): source reliability, parsing, browser recovery and proposed integrations.
- [TODO reconciliation](audit-2026-09-16/todo-reconciliation.md): September 16 inventory of 210 overlapping checkbox/prose/table items; 54 done, 43 partial, 85 not started and 28 not locally verifiable. These are historical audit counts, not a freshly verified completion tally.
- [Code audit](audit-2026-09-16.md): defects, evidence and subsystem maps.

## Implemented in this review

- Premium account entitlement determines the search tier, even when an incoming URL contains `tier=free` or no tier.
- Premium users see the Premium badge without a Free/Premium selector. Subsequent searches and result links use the effective tier; account history records it.
- Search waits for account/plan resolution, avoiding an initial Free request while the Premium plan is loading.
- An unavailable entitlement lookup returns HTTP 503, rather than `premium_required`; the UI shows a recoverable error instead of silently running Free search.

## Recommended execution order

| Priority | Work | Evidence and acceptance |
| --- | --- | --- |
| P0 | Complete Premium browser acceptance | Verify homepage → search, an old Free link, a second query, sign-out, expired entitlement and lookup outage with controlled accounts. No Free request for a verified Premium account. |
| P0 | Stable search snapshots and recommendations | Same snapshot and inputs must preserve results and winner on reload. Add identity/coverage diagnostics and a deliberate check-for-new-offers flow; investigate concurrent misses and source failures. |
| P0 | Fix tech classification and false exclusions | Reproduced locally: `iphone 13 mini`, `ipad mini`, and `smart tv samsung` resolve to vehicles; complete phones mentioning `dual sim` or `adus din USA` are rejected as parts. Add contextual category/part rules and regression fixtures. |
| P0 | Fix model/variant matching | Previous review reproduced a Pro Max description being accepted for a Pro query when the title only says `iPhone 15`. Preserve description evidence for unspecified variants without accepting unrelated comparison text. |
| P0 | Repair price and condition accuracy | Reproduced a retail parser crash on JSON-LD `offers: []`. Code inspection confirms `Ca nou` matches the API's new-condition filter. Add realistic parser and condition fixtures before trusting savings estimates. |
| P0 | Validate advertised source coverage | Repeat representative tech queries, inspect final prices and relevance, and retain blocked/empty/error evidence. Adapter counts and September 15 snapshots do not establish current reliability. |
| P0 | Protect seller contact and preserve conversation status | Code inspection confirms phone lookup has no authentication gate; it can reach browser recovery. Add server authorization and matching client headers, then quotas. Previous review reproduced `S-a vândut` followed by `Mulțumesc` resetting an unavailable conversation to replied. |
| P0 | Finish login and messaging acceptance | Production mobile/desktop Google and email flows; controlled-recipient delivery, replies, failure handling and private history. These remain open in the product TODO. |
| P1 | Bound paid provider usage and measure costs | Audit notes that anonymous Free requests can explicitly select paid providers; confirm and restrict server-side eligibility. Measure cost per useful result, browser recovery and alert scan before selling subscriptions. |
| P1 | Finish billing and onboarding | Checkout, durable customer mapping, signed/idempotent webhooks, entitlement lifecycle, billing portal, reconciliation and first-search onboarding. |
| P1 | Add ongoing source and alert monitoring | Scheduled source checks, repeated-zero alerts, alert cron/expiry acceptance, and useful delivery failure records. |
| P1 | Make product claims match evidence | Remove residual “live” wording for cached results and derive landing source claims from the registry. Add feedback deduplication and measured ranking evaluation. |
| P2 | Expand only after core quality | Picture search with editable extracted keywords, passkeys, deeper refurbished inventory, Facebook feasibility and feedback review tooling. Calls and broader niches remain P3. |

## Owner Notes list, merged September 25

| Owner request | Existing work and next step |
| --- | --- |
| Premium accounts always use Premium | Implemented locally in this review; browser acceptance and deployment remain. |
| Implement JEV | Owner clarified it is an LLM and explicitly deferred it. P3, among the last items; evaluate and integrate only in a later workstream. |
| Better scraping | P0: repair existing tech routes/parsers, pagination and price/condition extraction; verify actual useful inventory. |
| Add retail results | Retail adapters, benchmark cards and a separate retail result section already exist. P0: improve coverage and exact comparisons, retain retail context when filtering used offers. |
| Seller communication panel | `ConversationCenter` and seller message actions already exist. P0: complete private history, inbound replies, delivery states and production acceptance. |
| Email/Google login testing | Existing P0 production mobile/desktop acceptance task. |
| Premium purchase flow | Existing P1 billing and onboarding tasks; checkout is not complete. |
| Search by picture | Existing P2 image-to-keywords flow with user review before search. |
| Public Free/Premium marketplace list | Registry-backed source catalog exists; verify marketing consistency and evidence labels. |
| Marketplace selection and per-source costs | Existing P1 useful-result, reliability, latency, access method and provider cost evaluation. |
| Facebook Marketplace skill assessment | Existing P2 feasibility task; skill availability does not mean production integration. |
| Full operating costs | Existing P1 cost model covers phone number, Libergent text model, voice APIs, OpenClaw VPS, Cloudflare APIs/browser usage, plus database, email and payment fees. |
| Test “reach out for me” and messaging | Existing P0 controlled-recipient production acceptance, receipts, replies and error recovery. |
| Marketplace messaging compliance | Existing P0 marketplace contact-method review and supported link-out fallback. |
| Voice, seller calls and call history | Existing P3 voice/calling flow, consent, history, duration, costs and transcript/summary tasks after messaging works. |
| Full alert acceptance / test alerts | Existing P1 checklist covers ownership, quota, baseline, new matches, price drops, inbox/email, pause/resume/delete, expiry and deployed cron. |
| Stripe subscription/cancellation/customer portal | Existing P1 checkout, signed webhooks, customer mapping, lifecycle, portal and reconciliation backlog. |
| Complete customer acquisition flow | Existing P1 landing → pricing → signup → checkout → entitlement → onboarding → first useful search/alert, with funnel events. |
| Pictures on special recommendations | Rendering and fallbacks exist. Added explicit P0 visual acceptance rather than claiming a new implementation. |
| Automated feedback from poor matches | Structured reporting partly exists. P1: deduplicate and review reports, generate regression cases and evaluate scoring before release. Do not let individual reports directly retrain live rankings. |
| Passkeys | Existing P2 enrollment, recovery, security controls and device/browser acceptance. |
| Kitesurf fallback | Already wired into Premium. P1: evaluate recovered useful offers, cost, latency and false successes; tune eligibility and rollback. |
| Same search changes on refresh | New explicit P0 snapshot/recommendation trust workstream; investigation below. |

## Why refreshing can change results

Confirmed by local code inspection; the owner's particular production refresh has not been captured, so these are mechanisms, not a proven diagnosis of that event.

1. `src/worker.js` stores Free and Premium searches for 300 seconds. The key includes tier, query, condition, provider, site, page/limit settings and viewer location. The same word alone does not identify the same search.
2. Cache lookup failures become misses. Empty/failed searches are not saved, and cache write failures are swallowed. After expiry or a miss, sources are scraped again. There is no request coalescing around the read/search/write path, so concurrent misses can generate separate snapshots.
3. Premium recovery selects Kitesurf and Chromium sources based on failed/empty direct results. Source success and recovered inventory can differ between scans.
4. `src/aggregate.js` scores candidates against comparable price medians and comparison pools. Different available listings can change scores and the winning recommendation even if a particular listing has not changed. Deterministic tie-breakers already exist; they do not make changing inputs identical.
5. `ui/src/app/search/page.tsx` filters the recommendation against visible results, and temporary feedback exclusions are cleared on a new response. A refresh after rejecting an offer can therefore restore it. The earlier account-resolution race could also start an unwanted Free search; this review addresses that race.

Proposed acceptance contract: identical snapshot + account tier + location + filters + persisted feedback produces the same listings, order and special recommendations. A deliberate new scan may update inventory, prices and availability, but must show its timestamp, coverage changes and why the recommended offer changed. Snapshot retention should be bounded; never imply an old offer is guaranteed still available.

Implementation work: attach a snapshot identifier and ranking version; record cache/coverage diagnostics; preserve viewed snapshots and relevant feedback across reloads; coalesce equivalent concurrent scans using a suitable shared runtime mechanism; provide an explicit new-scan action and a change summary. Verify both tiers against source failures, cache expiry, concurrent requests and changed inventory. The tab-local portion is implemented below. Shared cross-device snapshots and distributed concurrent-scan coalescing remain future work.

## Review limits

Current review used local source inspection and targeted offline reproductions. The September audit contains additional leads that were not all reproduced again. Production source health, deployed database permissions, billing configuration and authenticated browser behavior have not been verified in this review.

## Step 2 implementation — matching accuracy

- Explicit tech families take precedence over ambiguous car makes. Mini, Smart, DS, MG and Seat require supporting model or vehicle context; actual Mini Cooper, Smart Fortwo, DS 7, MG ZS and Seat Leon searches retain vehicle routing.
- Car routing uses complete words and no longer treats fuel/type words alone or an arbitrary year plus product code as vehicle evidence. Regression queries include electric guitars, refrigerators, automatic vacuums, Diesel perfume and Samsung S24 with a year.
- Main-product intent checks distinguish explicit phone attributes (dual SIM, USA origin, replaced battery/display) and console bundle phrases from standalone parts/accessory offers. Matching and displayed text retain those attributes; broken-product and real-part exclusions remain.
- When the phone title omits a variant, an explicit repetition of the same model in the description can supply Pro/Max/Ultra/etc. Negation, upgrade and comparison text cannot supply that evidence. An unrelated MacBook Pro mention cannot turn a base iPhone into a Pro match.
- Validation: full backend suite passed 185 tests, including positive product fixtures, negative accessory/broken-product fixtures, vehicle routing and comparison/variant cases. This is bounded regression coverage, not a claim that every marketplace phrasing is understood. No deployment or production source probe performed.

## Step 3 implementation — scraping and retail accuracy

- Generic retail JSON-LD parsing skips malformed/empty offer entries without losing other products, respects explicit unavailable stock, preserves used/refurbished condition, and accepts image objects. Structured data takes precedence over guessed card amounts.
- Product-card boundaries replace wide overlapping anchor windows in generic retail and evoMAG extraction. Adjacent cards retain their own prices and images; cards without prices cannot borrow the next card's price. Current-price elements are preferred; shipping, monthly payments, voucher amounts and crossed-out prices are excluded when identified.
- Condition filtering recognizes like-new/refurbished grades as used, preserves ungraded second-hand inventory without inventing a condition, and retains retail reference inventory alongside used-filtered results. UI condition labels keep missing evidence unknown.
- Refurbished/used offers from retail sites are classified as secondary inventory, not new-price benchmarks. New benchmarks require explicit new-condition evidence. For phones, used/new comparisons require matching title model/variant and known storage capacity; incompatible retail configurations remain browsable without a savings claim.
- Regression fixtures cover malformed schema data, neighboring cards, misleading price amounts, unavailable stock, refurbished inventory, condition filters and incompatible phone storage. These are synthetic fixtures, not freshly captured production markup.
- This batch does not establish live marketplace health, improve every adapter's pagination, or solve exact configuration comparison for every non-phone category. Those remain source-specific follow-ups; no deployment performed.

## Step 1 implementation — local completion

- Browser `sessionStorage` pins the last five searches for up to 24 hours in the current tab. Identity includes account, tier, query, explicit location, page count and limit. The mapped listings are saved as well as the response so date-dependent mapping cannot reshuffle the same snapshot on reload. Current filters retain their existing persistence.
- Rejected-match exclusions survive reload and explicit rechecks. Snapshot age does not reset on restore or feedback edits. An unavailable/full store produces a visible warning.
- “Verifică oferte noi” explicitly bypasses the Worker response cache for Free and authenticated Premium requests. The new snapshot reports additions, missing offers, changed prices, recommendation changes and source errors. Existing upstream provider caches may still apply; a scan is not proof of current seller availability.
- A request failure or total source transport outage preserves the earlier displayed results. Responses and loader timers from abandoned requests cannot overwrite the next search.
- Remaining live-search wording was replaced with collection/update wording in the search UI.
- Validation: 29 snapshot/Worker tests pass; UI TypeScript and ESLint pass; diff whitespace check passes. Tests cover retention, exact restore, account/tier/location isolation, rejected matches, storage failures, eviction, change summaries and cache bypass with Premium authorization retained.
- Limits: not deployed; authenticated browser/visual acceptance was unavailable because no browser automation runtime was exposed. Closing the tab, the five-search cap, expiry, or unavailable storage can end snapshot retention. Simultaneous fresh scans across tabs/devices are not coordinated by this implementation.

## Continued implementation — pagination, retail routes and seller contact

- Classifieds pagination now checks actual forward links and disabled controls, including the first page. A terminal page prevents unnecessary additional fetches. Autovit structured prices match by URL or an unambiguous title instead of array position, and card boundaries prevent footer prices leaking into results.
- The pre-contact-fix backend run passed 203 tests. That result predates the latest retail-route, title-prefix and seller-contact changes; it is not validation of the final commit. No new tests were run in this continuation.
- Saved a six-source local direct-fetch baseline in [source probe](source-probe-2026-09-25.md). OLX returned 403. Vinted, Flip and Klap yielded accepted offers. Production Worker coverage remains unverified.
- Corrected evoMAG's route using its public search handler and scoped extraction to its result section, excluding navigation promotions. The sampled Samsung search returned zero results on the actual search route; usable evoMAG inventory remains unresolved. eMAG's `Telefon mobil` prefix now qualifies for phone-attribute handling; no post-fix acceptance count is claimed.
- Seller phone lookup authenticates before cached phone results, marketplace fetches or browser recovery. The search UI supplies the signed-in session token. Existing contact fixtures were adapted to the authentication contract. Per-account lookup quotas remain open.
- Conversation status walks backward to the latest meaningful seller state, so a courtesy reply preserves unavailable, agreed or negotiating status. This remains heuristic text classification; explicit reopening/status controls and production messaging acceptance remain open.

### User testing handoff

1. Premium account: open an old Free search URL and confirm Premium remains selected without a Free switch.
2. Search, reject a match, reload the same tab: results/recommendation and the rejection should persist. Use **Verifică oferte noi** for a deliberate new scan.
3. Compare phone variants/storage and new versus refurbished labels; review eMAG `Telefon mobil Samsung Galaxy S24` matches and retail prices.
4. Sign in before seller contact lookup; signed-out API calls should return 401 without retrieving a phone number.
5. With a controlled conversation, follow an unavailable/agreed reply with a courtesy reply and confirm the status is preserved.
6. Run the complete backend and UI checks before merging. Production login, billing, alert and controlled-recipient delivery acceptance remain on the backlog.
