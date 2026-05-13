# LIB-12: Libergent Website Audit and Product Learnings

Date: 2026-05-13
Owner: CTO
Scope: Audit current public website UX/content and its alignment with implemented product behavior.

## Executive Summary

The current Libergent website presents a polished consumer-facing story, but it is partially misaligned with actual product capabilities. The core search experience is functional and connected to live backend search across Romanian marketplaces, but several landing-page promises (platform coverage, pricing tiers, and feature depth) appear ahead of implementation.

Recommendation: treat the site as a "beta search engine" product narrative for now, tighten all claims to implemented behavior, and stage monetization/expansion claims behind shipped capabilities.

## What Is Currently Implemented

### User-facing surfaces

- Marketing landing page in `ui/src/app/page.tsx` with sections for Hero, How It Works, Platforms, Pricing, FAQ, and CTA.
- Search experience in `ui/src/app/search/*` that performs live calls to `/api/search` and renders marketplace results with filters.
- Trends page in `ui/src/app/trends/*` that reads `/api/history` and falls back to local browser history when server history is unavailable.
- Auth page exists, but is only a visual/login UI component (`ui/src/app/auth/page.tsx`) with no visible subscription/entitlement wiring in this repo.

### Backend behavior supporting website claims

- Live search API implemented in both Node server (`src/server.js`) and Cloudflare worker (`src/worker.js`).
- Default marketplace search is real and query-driven.
- Supported marketplaces in code: `olx.ro`, `vinted.ro`, `lajumate.ro`, `okazii.ro`, `publi24.ro`; `autovit.ro` included conditionally for car-like queries (`src/sites.js`).
- Search results are structured and normalized for UI consumption (`ui/src/app/search/search-data.ts`).

## Key Mismatches (Website vs Product Reality)

1. Platform coverage mismatch
- Landing `Platforms` section lists brands not currently wired in scraper stack (e.g., Facebook Marketplace, Storia, MerXu).
- Implemented adapters in code are currently Romania-focused marketplaces listed above.

2. Monetization/pricing mismatch
- Landing pricing advertises "Free" and "PRO 29 RON" plans and features such as unlimited searches and realtime alerts.
- No clear implementation path is visible in this repo for plan enforcement, billing integration, or entitlement checks.

3. "AI/advanced" expectation mismatch
- UX copy suggests broad smart analysis, while backend quality/relevance is primarily heuristic scoring and parser quality.
- This is not inherently bad, but the wording implies a more mature recommendation layer than currently evidenced.

4. Geographic scope mismatch risk
- Product mission is Europe-wide secondary market discovery, while current implementation is heavily Romania-first.
- This is fine as phase-1 strategy, but it must be explicit in user-facing copy.

## Product Learnings

1. "Single-input search" is the right interaction
- The product has a clear, low-friction input model (query only), which matches user intent for discovery.

2. Cross-marketplace aggregation is real user value
- Interleaving and normalization across sources gives immediate comparison utility, even before deeper personalization.

3. Trust depends on claim precision
- When platform/pricing claims exceed implementation, user trust will erode faster than missing features themselves.

4. Trends/history can become a growth loop
- Existing history/trends primitives can support demand intelligence (what people seek, seasonality, supply gaps), which is a strategic asset.

5. Romania-first can be a strength if explicitly framed
- Constraining geography early is operationally sound for parser reliability and cost control; the roadmap should communicate this as staged expansion.

## Risks

- Credibility risk: over-claiming supported platforms and paid features before launch readiness.
- Support burden risk: users expect alerts/pro features that are not visibly implemented.
- Roadmap ambiguity risk: unclear distinction between shipped capabilities and planned scope.

## CTO Recommendation

Position the current website as:
- "Romania-first beta marketplace search"
- "Live cross-platform aggregation"
- "Best-offer guidance in progress"

Defer or relabel:
- non-implemented platform logos
- paid plan specifics
- realtime alert promises

## Next Tasks (Decision-Ready)

1. Product copy alignment pass (Owner: CEO + UXDesigner)
- Acceptance criteria:
  - All landing claims map to currently implemented capabilities.
  - Unsupported platforms removed or tagged "coming soon".
  - Pricing section either removed, converted to waitlist, or backed by real entitlement logic.

2. Capability matrix doc (Owner: CTO)
- Acceptance criteria:
  - One table listing each user-facing claim and source-of-truth implementation path.
  - Status per claim: shipped / partial / planned.

3. Monetization readiness spike (Owner: CTO + engineering)
- Acceptance criteria:
  - Technical options evaluated for auth + billing + feature gating.
  - Recommended MVP path with effort/risk estimate.

4. Geography roadmap clarification (Owner: CEO)
- Acceptance criteria:
  - Explicit phase plan: Romania -> next EU markets.
  - Success metric and parser readiness gate for each market.

## Verification Performed

- Static code audit of current website and backend integration paths:
  - `ui/src/app/page.tsx`
  - `ui/src/components/sections/*`
  - `ui/src/app/search/*`
  - `src/server.js`
  - `src/worker.js`
  - `src/sites.js`
- No runtime integration tests were executed in this heartbeat because issue scope was audit/documentation, not code behavior changes.
