# Feedback-driven matching improvement

## Outcome

Turn confirmed matching mistakes into repeatable checks, then use those checks to assess proposed corrections. Keep matching, pricing, duplicates and availability separate. User reports are evidence to review; they do not directly change global rules.

## In-app implementation

Implemented in the application code (deployment and signed-in browser acceptance remain pending):

- Search feedback saves observed description, raw condition, seller type and price fields alongside the existing context. Unknown prices stay unknown. These are explicitly `client_report` evidence, not authenticated server snapshots; client-submitted review metadata is discarded.
- On a subsequent search, authenticated users load their saved reports. The latest decision for an exact listing determines whether a matching-related dislike hides it. This affects the results, selected recommendation cards and comparison candidates. It does not rerank the shared engine response or choose a replacement winner.
- Query matching is exact after trimming, including case and spacing. There is no cross-query or similarity-based permanent exclusion. Price, availability, duplicate and other complaints do not create permanent exclusions. Reads are limited to the most recent 200 reports for the query, with a visible truncation notice.
- `/feedback`, linked from search, shows the account's reports. Deleting a report removes repeat reports with the same query/fingerprint for that account and allows the listing to appear again. Associated review labels are also removed. Browser snapshots no longer restore obsolete session exclusions.
- Reviewers can switch the same page to the shared queue, inspect captured evidence and current classifier decisions, then confirm an expected acceptance/rejection or leave a report pending/rejected. Confirmation requires explicit evidence verification and only matching-related reasons qualify. Confirmed cases are replayed automatically whenever the queue loads; results show false accepts and false rejects. The latest 200 reports bound both the queue and its evaluation, and truncation is explicit.
- A review label does **not** automatically alter global matching rules. Shared fixes still follow Stage 3, using confirmed cases as their evaluation evidence. No model training or autonomous code changes run in this release.
- A failed feedback insert now returns an error; it never writes private feedback into public search-event statistics.

### Activation

Deploy the UI and both API runtime changes together. This uses existing `offer_feedback` columns, including its `offer` JSONB field; no additional schema migration is required. Existing `supabase/search_tracking.sql` must already be applied, with RLS enabled, no anon/authenticated table grants, and service-role access. Backend requests use the verified session's user ID, never a submitted owner ID.

Set server-only `LIBERGENT_FEEDBACK_REVIEWER_IDS` to comma-separated Supabase auth user UUIDs allowed to inspect all reports. Empty disables shared review but leaves personal feedback available. Do not set this as a `NEXT_PUBLIC_` variable or put service-role credentials in the browser. Both Node and Worker runtimes use the same feedback service. Reviewer status comes exclusively from this server allowlist, not editable user metadata.

Endpoints:

- `POST /api/feedback`: existing authenticated submission, now with richer observed evidence.
- `GET /api/feedback?query=...`: owner-scoped recent reports; omit query for the account management page.
- `DELETE /api/feedback` with `{ "id": "feedback-uuid" }`: remove only the authenticated account's matching report group.
- `GET /api/feedback/review`: reviewer-only queue, triage and evaluation.
- `PATCH /api/feedback/review`: reviewer-only `{ "id", "status", "expectedCandidate", "evidenceChecked" }`; statuses are pending, rejected, confirmed. Expected candidate and checked evidence are required for confirmation.

### Acceptance before production rollout

1. Sign in as account A, report a wrong-model listing, reload the same query, and verify the exact listing stays hidden in cards and comparisons. Check a different query and account B remain unaffected.
2. Open `/feedback`, delete the report, and return to the search. The listing is eligible for display again if still returned by the source.
3. Submit price/availability complaints and verify they do not persist as matching exclusions. Simulate a failed save/load and verify the UI reports it honestly.
4. As an allowlisted reviewer, confirm both a good and bad example, reload the queue, and check evaluation counts. Verify account B receives 403 for shared review and cannot read/delete account A's reports.
5. Review API latency and the 200-report limits before increasing traffic. The queue currently evaluates observed browser inputs and is not a faithful replay of all historical server decisions.

Automated checks: `node --test src/feedback-app.test.js src/feedback.test.js src/feedback-learning.test.js src/supabase.test.js src/worker.test.js` and `npm run test:ui-data`. API/storage tests use mocked Supabase responses; they do not establish that the production database is configured correctly.

## Stage 1 — Offline triage and replay (implemented)

- Read a JSON array of exported `offer_feedback` rows or normalized API feedback payloads.
- Group by normalized query and listing fingerprint, falling back to URL and then title. Count distinct authenticated user IDs separately from report volume; flag conflicting positive/negative labels.
- Route reasons to matching, pricing, deduplication, freshness or manual review. Only relevant likes and matching-related dislikes suggest candidate labels.
- Replay explicitly reviewed cases through `classifyListingIntent`, reporting false accepts and false rejects separately. Any failed case exits nonzero.
- Start with five synthetic cases derived from existing relevance tests: exact phone, wrong model, vehicle, toy mismatch and explicitly requested toy. These are baseline checks, not customer feedback or evidence of improved production quality.

Commands, from the repository root:

```sh
node scripts/feedback-loop.js triage /private/tmp/offer-feedback.json
npm run feedback:evaluate
node scripts/feedback-loop.js evaluate /private/tmp/reviewed-cases.json
```

The triage report omits user IDs, listing URLs and free-form corrections, but query/title text can still be sensitive. Keep raw exports and real-user triage reports outside the repository. No database access, external calls or production writes occur in these commands.

To promote a report, review the query and original listing evidence, decide the expected candidate eligibility, and add a sanitized case with a unique `id`, `reviewed: true`, `query`, `listing`, and boolean `expectedCandidate`. Preserve classifier inputs (`title`, `description`, `condition`, `sellerType`, `price`, `priceRon`) when available. Mark missing evidence rather than inventing it. Add a related good-match control alongside each negative case. A group with conflicting labels needs resolution before promotion.

Acceptance: repeated votes do not inflate distinct-user counts; price/availability complaints never imply irrelevant products; unreviewed cases cannot run; regressions fail the command; positive controls continue passing. Covered by `src/feedback-learning.test.js`.

## Stage 2 — Reliable capture and review queue (next)

1. Capture the original server-side classifier inputs and engine revision with a search/listing identifier. Current feedback captures only a partial listing and labels its payload `feedback-loop-v1`; that value is not a ranking-engine revision.
2. Associate feedback with the stored server snapshot rather than trusting browser-supplied scores or features. Retain bounded snapshots and apply the account access/retention policy.
3. Feedback storage failures are now explicit and the legacy search-event fallback has been removed.
4. The bounded review flow now supports pending, confirmed and rejected states with reviewer/time metadata. Remaining: complete server snapshots, a dedicated review audit history, idempotent submissions, pagination and durable reviewed datasets beyond the latest queue window.
5. Cluster confirmed cases by failure signature across listings (for example model mismatch), showing supporting cases and distinct users. Stage 1 groups the same query/listing only; it does not discover semantic patterns.

Acceptance: a saved report can replay the original decision; submitted features cannot replace the stored snapshot; repeated reports are idempotent; conflicting and incomplete cases remain pending; ordinary users cannot export other users' feedback.

## Stage 3 — Proposed fixes and evaluation gate

1. Generate a proposed rule, synonym, parsing fix or ranking change for a confirmed pattern, with the examples that motivate it.
2. Add the confirmed cases and positive controls to a reviewed development dataset. Maintain a separate held-out set to reduce overfitting.
3. Compare baseline and candidate engine revisions on both datasets. Initially require all regression cases to pass and inspect false accepts and false rejects by category.
4. Extend evaluation beyond candidate eligibility to ranking quality (top results and pairwise preferences). Pricing, availability and duplication need their own evaluators.
5. Submit changes as reviewable patches with before/after reports. User text is data, never executable instructions. Review releases initially.

Acceptance: every proposed fix has reproducible evidence, improves its target cases, and passes the existing suite and positive controls. No autonomous live mutation of matching rules.

## Stage 4 — Controlled rollout and monitoring

Version releases; compare candidate behavior in shadow evaluation before a limited rollout. Track confirmed bad matches per displayed result, good matches wrongly rejected, coverage, latency and cost. Include positive sampling and result-impression denominators so raw dislike counts are not mistaken for quality. Establish minimum sample sizes and rollback thresholds from observed traffic before enabling automatic promotion.

## Current limits

Stage 1 is an offline foundation. It neither fetches production feedback nor creates fixes automatically. Its replay checks classifier eligibility, not end-to-end retrieval or deal ranking. Historical feedback lacks full classifier inputs, so it cannot faithfully reconstruct every original decision. Anonymous or missing user IDs contribute to report counts but never to distinct-user counts. Fingerprint/URL aliases can split groups; title fallback can merge similar listings. Review is required even when all reports agree.
