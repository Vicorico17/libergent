# LIB-14: Website Capability Matrix for Claim Governance

Date: 2026-05-13
Owner: CTO
Parent: LIB-11
Input audit: `docs/lib-12-website-audit.md`

## Purpose

This matrix ties user-facing website claims to implementation evidence so copy, roadmap, and launch messaging stay aligned.

## Capability Matrix

| Claim Area | User-facing claim (source file/section) | Implementation source of truth | Status | Owner | Notes |
|---|---|---|---|---|---|
| Platform coverage | "Găsim pe toate platformele" and platform badges include Facebook Marketplace, Storia, MerXu (`ui/src/components/sections/Platforms.tsx`) | Site adapters are `olx.ro`, `vinted.ro`, `lajumate.ro`, `okazii.ro`, `publi24.ro`, conditional `autovit.ro` (`src/sites.js`) | partial | CTO + CEO | Marketing lists unsupported platforms; should remove or mark coming soon. |
| Pricing/plans | Free vs PRO 29 RON tiers with limits/features (`ui/src/components/sections/Pricing.tsx`, `ui/src/components/sections/FAQ.tsx`) | `user_entitlements` and Premium alert gates are implemented; checkout, subscription lifecycle, and billing portal are not (`src/server.js`, `src/worker.js`, `src/supabase.js`) | partial | CEO + CTO | Premium can be assigned manually for testing. Do not imply that self-service paid subscriptions are live until the billing backlog is complete. |
| Realtime alerts | "Alerte în timp real" / immediate notifications (`ui/src/components/sections/FeaturesGrid.tsx`, `ui/src/components/sections/FAQ.tsx`) | Hourly/daily vehicle monitoring, baselining, inbox events, delivery records, and an email webhook interface are implemented (`src/alerts.js`, `src/worker.js`) | partial | CTO | The fastest mode is hourly, not realtime. Production still needs Worker secrets, cron verification, and an email provider adapter/configuration. |
| AI/advanced analysis | "Căutare inteligentă", "filtrăm zgomotul", best-offer quality language (`ui/src/components/sections/Hero.tsx`, `ui/src/components/sections/FeaturesGrid.tsx`) | Heuristic relevance and best-offer scoring implemented (`src/relevance.js`, `src/aggregate.js`, `README.md`) | partial | CTO | Intelligence exists but is heuristic, not full recommendation/ML stack. Copy should reflect this. |
| Geography/market scope | Implied broad coverage; claims suggest very wide marketplace reach (`ui/src/components/sections/Platforms.tsx`, `ui/src/components/sections/StatsBar.tsx`) | Marketplace integrations are Romania-first domains (`src/sites.js`, `README.md`) | partial | CEO + CTO | Should explicitly frame phase as Romania-first with staged EU rollout. |
| Search | Single-input search and cross-marketplace results (`ui/src/components/SearchBar.tsx`, `ui/src/app/search/SearchClient.tsx`) | `/api/search` executes live multi-site search and returns normalized results (`src/server.js`, `src/app.js`, `src/normalize.js`) | shipped | CTO | Core product value is implemented and demonstrable. |
| Trends/history | Trends dashboard and recent search analytics (`ui/src/app/trends/TrendsClient.tsx`) | `/api/history` payload with fallback to browser local storage (`src/server.js`, `src/history.js`, `src/history-base.js`) | shipped | CTO | Works today; data quality depends on search traffic volume and storage availability. |
| Auth/account | Account/login CTA and auth page (`ui/src/app/auth/page.tsx`) | UI login surface exists; no visible end-to-end auth/session/entitlement enforcement in backend | partial | CTO | Auth UX exists but product permissions and plan binding are not enforced. |

## Governance Rules

- Only claim a capability as "shipped" when there is runnable implementation in repo runtime paths.
- Treat "partial" as "usable but narrower than the claim"; adjust copy or implementation before broad launch.
- Keep "planned" capabilities in roadmap/waitlist language, not in present-tense promise language.
- Re-run this matrix whenever major marketing sections change or new marketplaces/features ship.

## Recommended Review Queue

1. CEO + UX copy pass to align platform, pricing, and alerts statements with implemented scope.
2. Complete the billing work tracked in `docs/premium-alerts-todo.md` before enabling self-service paid Premium.
3. Complete the alert acceptance test and describe the fast frequency as hourly rather than realtime.
