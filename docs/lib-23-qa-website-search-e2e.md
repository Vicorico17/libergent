# LIB-23 QA website search engine end to end

Date: 2026-05-13 (UTC)
Branch: chore/lib-23-qa-search-e2e
Scope: Manual end-to-end verification of website search API flow and aggregation behavior.

## Environment

- Repo: `https://github.com/Vicorico17/libergent`
- Runtime: Node.js local server (`src/server.js`)
- Endpoint under test: `GET /api/search?q=<query>&site=all&provider=auto&pages=1`

## Verification performed

1. Started API server locally:
   - `PORT=8792 HOST=127.0.0.1 node src/server.js`
2. Ran end-to-end search query via HTTP:
   - `curl "http://127.0.0.1:8792/api/search?q=iphone%2015%20pro&site=all&provider=auto&pages=1"`
3. Re-ran with a second query:
   - `curl "http://127.0.0.1:8793/api/search?q=riftbound&site=all&provider=auto&pages=1"`

## Results summary

- Marketplace execution succeeded end-to-end for all configured sites in both runs (`successfulMarketplaces = marketplaces = 5`).
- No provider credit usage (`creditsUsed = 0`) on both runs, confirming direct parser path.
- Multi-marketplace payload returns listings and summary stats as expected.

## Findings

### 1) Global best offer missing in `site=all` response

- Severity: Medium
- Repro:
  1. Call `GET /api/search?q=iphone%2015%20pro&site=all&provider=auto&pages=1`
  2. Observe payload has populated per-site results but top-level `bestOffer` is `null`.
- Expected: top-level aggregate `bestOffer` should be present when at least one marketplace has valid listings.
- Actual: `bestOffer` remains `null` even when successful listings are returned.
- Impact: UI-level recommendation can appear empty despite healthy marketplace results.
- Suggested fix: Inspect aggregate selection path in `searchAcrossSites` / aggregation logic to ensure best-offer scoring emits a non-null top-level value whenever qualifying items exist.

### 2) Query quality risk (cross-product leakage for model suffixes)

- Severity: Low
- Repro:
  1. Call `GET /api/search?q=iphone%2015%20pro&site=all&provider=auto&pages=1`
  2. Observe many `iPhone 15 Pro Max` results accepted in top results.
- Expected: stronger intent matching for exact model variant when suffix token (`pro`) is explicit.
- Actual: mixed variant matching (`pro` + `pro max`) is common.
- Impact: recommendation quality may drift for users searching exact device trims.
- Suggested fix: tighten token weighting or add negative weighting for conflicting variant tokens in relevance scorer.

## Recommendation

- Treat finding #1 as next engineering fix before claiming recommendation UX is complete.
- Keep this QA issue as complete once follow-up implementation issue(s) are linked and assigned.
