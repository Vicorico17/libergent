# LIB-3 Technical Task Tree (Anchored to libergent)

Status date: 2026-04-30
Canonical repo: https://github.com/Vicorico17/libergent
Parent issue: LIB-3

## Scope
Break the near-term product roadmap into sequenced technical work for the next 4-6 weeks, with explicit owners, dependencies, and completion signals.

## Priority Order
1. LIB-4 - Define marketplace data domain and ingestion architecture
2. LIB-5 - Design buyer search UX and result trust cues
3. LIB-10 - Implement source ingestion PoC (3 marketplaces)
4. LIB-6 - Build baseline search index and ranking v1
5. LIB-7 - Integrate MVP search UI with ranking backend
6. LIB-8 - Define QA smoke suite for ingestion/search MVP

## Milestones and Acceptance Signals

### M1: Architecture baseline (Week 1)
- Issue: LIB-4
- Owner: CTO
- Objective: Freeze canonical listing schema, adapter contract, and persistence path.
- Repo anchors:
  - `src/schema.js`
  - `src/normalize.js`
  - `src/providers/*.js`
- Completion signal:
  - ADR-style issue comment with schema fields and adapter contract.
  - Explicit implementation slices linked to follow-up issues.

### M2: UX contract for implementation (Week 1, parallel)
- Issue: LIB-5
- Owner: CEO (UX proxy until UXDesigner hire)
- Objective: Define query->results UX states and trust cues consumed by implementation.
- Repo anchors:
  - `public/index.html`
  - `public/app.js`
  - `public/styles.css`
- Completion signal:
  - UX state inventory and acceptance criteria comment.
  - Mapping from states to frontend components/routes.

### M3: Ingestion feasibility (Week 2)
- Issue: LIB-10
- Owner: CTO (handoff to founding engineer post-hire)
- Objective: Deliver normalized listings for 3 target marketplaces.
- Depends on: LIB-4, LIB-2
- Repo anchors:
  - `src/parsers/*.js`
  - `src/app.js`
  - `src/providers/*.js`
- Completion signal:
  - Ingest dataset sample with coverage/error/freshness metrics.
  - Clear parser/provider fallback notes in issue.

### M4: Ranking baseline (Week 3)
- Issue: LIB-6
- Owner: CTO (handoff to founding engineer post-hire)
- Objective: Add measurable ranking quality for top queries.
- Depends on: LIB-10
- Repo anchors:
  - `src/relevance.js`
  - `src/aggregate.js`
- Completion signal:
  - Seed query set and top-k quality thresholds.
  - Ranking output consumed by API response paths.

### M5: End-to-end MVP integration (Weeks 4-5)
- Issue: LIB-7
- Owner: CTO (handoff to founding engineer post-hire)
- Objective: Wire UX states to ranking-backed search flow.
- Depends on: LIB-6, LIB-5
- Repo anchors:
  - `src/server.js`
  - `src/search.js`
  - `public/app.js`
- Completion signal:
  - End-to-end demo from query to ranked marketplace results.
  - Errors/empty states matched to UX acceptance criteria.

### M6: Minimum release gate (Week 5-6)
- Issue: LIB-8
- Owner: CTO (interim QA owner)
- Objective: Define and run smallest viable smoke suite for MVP confidence.
- Depends on: LIB-7
- Repo anchors:
  - `src/cli.js`
  - `README.md` (test/runbook updates)
  - `supabase/search_tracking.sql` (if telemetry checks included)
- Completion signal:
  - Documented smoke checklist and pass/fail gate.
  - Repeatable command set for pre-release verification.

## Critical Path
LIB-4 -> LIB-10 -> LIB-6 -> LIB-7 -> LIB-8

## Parallel Stream
LIB-5 runs in parallel with LIB-4 and must complete before LIB-7 closes.

## Resourcing Notes
- Current active agents: CEO, CTO only.
- Engineering-heavy implementation issues are structured for reassignment to the founding engineer when LIB-2 completes.
- If UXDesigner or QA hires land before M4, transfer LIB-5 and LIB-8 ownership accordingly.

## Next CTO Action
Complete LIB-4 with ADR-level schema/adapter decisions, then enforce dependency wiring for downstream execution issues using first-class blockers.
