# LIB-13 Website Copy Alignment Spec

Date: 2026-05-13
Owner: UXDesigner
Audience: CTO (implementation handoff)

## Goal
Align all public website copy with shipped capabilities to reduce trust risk and expectation mismatch.

Strategic frame to preserve:
- Romania-first beta marketplace search
- Live cross-platform aggregation
- Best-offer guidance in progress

## Scope Reviewed
- `ui/src/components/sections/Hero.tsx`
- `ui/src/components/sections/StatsBar.tsx`
- `ui/src/components/sections/HowItWorks.tsx`
- `ui/src/components/sections/Platforms.tsx`
- `ui/src/components/sections/FeaturesGrid.tsx`
- `ui/src/components/sections/Testimonials.tsx`
- `ui/src/components/sections/Pricing.tsx`
- `ui/src/components/sections/FAQ.tsx`

## Implementation-Ready Copy/Treatment Decisions

1. Hero (`Hero.tsx`)
- Risky claim removed: broad "zeci de platforme" phrasing.
- Applied copy: Romania-scoped multi-platform language.
- Rationale: cognitive load and trust; users should immediately understand current scope.

2. Stats (`StatsBar.tsx`)
- Risky claim removed: unverified vanity counts (`12.400+`, `48`, `6`).
- Applied copy: capability-safe indicators (`5+ platforme active`, `căutare unificată`, `beta gratuit`).
- Rationale: trust signals must match reality.

3. How It Works (`HowItWorks.tsx`)
- Risky claim removed: "în timp real" and large-scale scanning wording.
- Applied copy: active Romania platform coverage + unified relevant results.
- Rationale: plain language and expectation control.

4. Platforms (`Platforms.tsx`)
- Risky claim removed: unsupported logos/platforms (Facebook Marketplace, Storia, MerXu).
- Applied treatment: implemented sources only (OLX, Vinted, LaJumate, Okazii, Publi24, `Autovit*` conditional note for auto queries).
- Added `id="platforme"` for existing footer deep-link consistency.
- Rationale: information scent and credibility.

5. Features Grid (`FeaturesGrid.tsx`)
- Risky claim removed: realtime alerts, push/email alert promises, over-broad platform count language.
- Applied copy: relevance sorting, duplicate/noise reduction, comparison workflow, trend visibility, staged expansion.
- Rationale: progressive disclosure for planned capabilities.

6. Social Proof Section (`Testimonials.tsx`)
- Risky claim removed: fabricated-looking testimonial quotes and star ratings.
- Applied treatment: converted to neutral "Exemple" usage scenarios.
- Rationale: trust and compliance; avoid unverified social proof.

7. Pricing (`Pricing.tsx`)
- Risky claim removed: paid `PRO` plan (`29 RON`) and entitlement promises.
- Applied treatment: single `Beta` tier, `0 RON`, no commercial plans yet, transparent future-note.
- Added `id="planuri"` for existing footer deep-link consistency.
- Rationale: no billing/plan enforcement in shipped flow.

8. FAQ (`FAQ.tsx`)
- Risky claims removed: unsupported platform list, paid-plan details, realtime sync and alerts availability.
- Applied copy: implemented marketplace list + explicit "alerts not available yet".
- Rationale: error prevention; users should not assume non-existent features.

## Desktop/Mobile Risk Notes
- Pricing card remains one-tier and should reduce cognitive load on mobile.
- Platforms row now uses similar chip lengths; line wraps remain stable at small widths.
- `Testimonials` -> `Exemple` keeps same card grid and spacing model, minimizing layout regression risk.
- Added conditional footnote in Platforms; verify legibility at 320px width.

## CTO Acceptance Criteria
- No landing-page copy claims paid plans, realtime alerts, or unsupported platforms.
- Platform names on website match implemented adapters and conditional Autovit behavior.
- Beta/free access language replaces commercial tier commitments.
- Social-proof section does not present unverifiable user testimonials.
- Footer/nav links to `#platforme` and `#planuri` resolve to existing anchors.

## Verification Notes
- Copy alignment verified by source-level inspection of edited files listed above.
- Runtime visual verification still required at desktop and mobile viewports before final closure.

### Verification Attempt (This Heartbeat)
- Attempted to run local screenshot verification with Playwright against `http://127.0.0.1:3000`.
- Blocked by runtime dependency: `libglib-2.0.so.0` missing for headless Chromium in current execution environment.
- This is an environment limitation, not a product copy issue.

### QA Execution Steps (CTO/QA)
1. Run `npm --prefix ui run dev -- --hostname 127.0.0.1 --port 3000`.
2. Open `/` at desktop (>=1440px) and mobile (~390px) widths.
3. Confirm acceptance criteria from this document, with focus on:
   - Platforms list/footnote readability.
   - Pricing single-tier beta framing.
   - `Exemple` cards spacing and line-wrapping.
