# Subsystem map: Build, deploy, CI, cron, scripts, environment variables, external integrations and agent skills

Generated 2026-09-16 by a read-only code-reading agent. Evidence is `path:line` on commit 81c8e23. Claims were not independently re-verified unless noted in the [summary](../audit-2026-09-16.md).

## Summary

The build/deploy surface is small and Cloudflare-centric. package.json (32 lines, ESM, engines node>=22) declares one runtime dependency (@cloudflare/puppeteer 1.3.0) and one devDependency (wrangler 4.93.1, exact pin); `npm run deploy` = `build:ui` (npm --prefix ui ci && next build, static export to ui/out) -> `verify:ui-auth-config` (greps the built chunks for NEXT_PUBLIC_SUPABASE_URL/PUBLISHABLE_KEY) -> `wrangler deploy`. wrangler.toml (17 lines) points main at src/worker.js with nodejs_compat, serves ui/out through the ASSETS binding, declares the BROWSER (Browser Rendering) binding, one hourly cron `15 * * * *`, and a single plain var OPENCLAW_BRIDGE_URL hardcoded to a Hostinger VPS hostname; every other production setting must be a dashboard/`wrangler secret` value and no complete list of those exists in the repo. Two GitHub Actions workflows exist: ui-lint.yml (PR + push main; Node 20; NODE_ENV=production; runs `npm run check`, `lint:ui:ci`, `next build` without Supabase env) and deploy-cloudflare.yml (push main + manual; Node 22; `npm run check` then `npm run deploy` with four repository secrets) — the deploy job does not depend on the lint job, so a UI lint/type failure on main does not block a production deploy. At runtime the Worker's `applyEnv` (src/worker.js:48-62) copies every string binding into a synthetic `globalThis.process.env` and sets LIBERGENT_RUNTIME=cloudflare-worker, so backend modules read config uniformly via `process.env` (Node) or the `env` parameter (Worker); the Node dev server (src/server.js:37) and CLI load `.env.local`/`.env` through the homegrown parser in src/env.js. The cron entry point `scheduled` (src/worker.js:1443-1446) calls `runDuePremiumAlerts` (533-539), which pulls up to 20 due alert profiles from Supabase, re-checks Premium entitlement, runs a live direct search hardcoded to autovit.ro/bestauto.ro (504), diffs listing state, inserts events, and posts single or digest emails to a vendor-neutral ALERT_EMAIL_WEBHOOK_URL (453-494); the same routine is reachable manually via POST /api/admin/alerts/run behind LIBERGENT_ADMIN_TOKEN (1026-1030). External integrations are: Cloudflare Browser Rendering via the BROWSER binding (Kitesurf/Chromium in src/providers/cloudflare-browser.js) and via REST API keys (src/providers/cloudflare.js), Firecrawl REST (src/providers/firecrawl.js), Supabase REST/auth (src/supabase.js, worker.js:274-291), the OpenClaw WhatsApp bridge (outbound: worker.js:1217-1260 and src/providers/openclaw.js; inbound: POST /api/openclaw/inbound guarded by OPENCLAW_INBOUND_TOKEN at worker.js:762-770), Google Analytics gtag in the UI, and an OpenAI Realtime config builder that never calls OpenAI (src/outreach.js:90-104). The scripts/ directory holds VPS-side helpers (openclaw-bridge.js HTTP server that shells out to `openclaw gateway call send`, openclaw-inbound-forwarder.js that polls OpenClaw session JSONL files every 3s and POSTs to the Worker), an ops benchmark (benchmark-kitesurf.js, defaults to hitting https://libergent.com across all 117 adapters), the deploy-time auth-config verifier, and a Paperclip-agent git push helper that reads a GitHub PAT from fixed container paths. The audit/ folder contains two one-off scripts from an external OpenAI-tool session (import `@oai/artifact-tool`, which is not installed, and reference /Users/vicorico/code/libergent) that generated docs/libergent-feature-tracker.xlsx on 2026-08-02; they cannot run here and their 133-test baseline is stale versus today's 172. .agents/skills/search-marketplace/SKILL.md is a Browserbase Facebook Marketplace (US-metro) skill with skills-lock.json pointing at a local path on another machine; nothing in src/ references Facebook, so it is unwired. .playwright-cli/ is committed Playwright-CLI debug output (console logs and accessibility snapshots) from 2026-03-13 against the old UI on 127.0.0.1:8787 and olx.ro. Documentation drift is material: .env.example omits at least 20 variables the code reads (including the undocumented LIBERGENT_PREMIUM_ALERTS_BETA=1 flag that grants Premium to every authenticated user), contains two variables nothing reads (CALLING_ENABLED, OPENAI_API_KEY), disagrees with README on PREMIUM_BROWSER_FALLBACK_LIMIT (2 vs 5; code default is 5), and README:456's claim that GA is opt-in is contradicted by a hardcoded measurement ID fallback in ui/src/app/layout.tsx:60.

## Entry points

- npm test / npm run check (package.json:12-13): node --test src/*.test.js src/parsers/*.test.js src/providers/*.test.js after `node src/cli.js --help`
- npm run deploy (package.json:21): build:ui -> verify:ui-auth-config -> wrangler deploy
- npm run dev (src/dev.js): spawns src/server.js on 127.0.0.1:8787 and ui `next dev`
- npm run dev:worker: wrangler dev against wrangler.toml
- npm run search:live (package.json:9): LIBERGENT_MOCK_SEARCH=0 live CLI (forbidden here)
- npm run benchmark:kitesurf (scripts/benchmark-kitesurf.js): hits {base}/api/admin/browser-benchmark per site
- GitHub Actions: .github/workflows/ui-lint.yml on pull_request and push main; .github/workflows/deploy-cloudflare.yml on push main and workflow_dispatch
- Cloudflare cron '15 * * * *' (wrangler.toml:14) -> export default.scheduled (src/worker.js:1443) -> runDuePremiumAlerts (533)
- export default.fetch (src/worker.js:1434): /api/* -> handleApi, else env.ASSETS.fetch
- POST /api/admin/alerts/run (src/worker.js:1026) manual cron trigger behind LIBERGENT_ADMIN_TOKEN
- GET /api/admin/browser-benchmark (src/worker.js:1079) and GET /api/health/sources?live=1 (1061) behind LIBERGENT_ADMIN_TOKEN
- POST /api/openclaw/inbound (src/worker.js:762) behind OPENCLAW_INBOUND_TOKEN; fed by scripts/openclaw-inbound-forwarder.js
- POST /api/whatsapp/send (src/worker.js:1217) -> {OPENCLAW_BRIDGE_URL}/whatsapp/send (scripts/openclaw-bridge.js:83)
- node scripts/openclaw-bridge.js (VPS): GET /health, POST /whatsapp/send
- node scripts/openclaw-inbound-forwarder.js (VPS): setInterval poller
- scripts/paperclip-git-push.sh <branch>: agent git push
- node audit/build-feature-tracker.mjs / verify-feature-tracker.mjs (not runnable here: missing @oai/artifact-tool)

## External dependencies

- Cloudflare Workers runtime with nodejs_compat; ASSETS binding (wrangler.toml:6-8, src/worker.js:1441); BROWSER Browser Rendering binding (wrangler.toml:10-11; src/worker.js:340,720,731,863,1086,1100) — requires a Workers plan with Browser Rendering
- Cloudflare cron trigger '15 * * * *' (wrangler.toml:13-14)
- Cloudflare Browser Rendering REST API https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/browser-rendering/* (src/providers/cloudflare.js:66) with CLOUDFLARE_API_TOKEN
- Firecrawl scrape API (src/providers/firecrawl.js) with FIRECRAWL_API_KEY
- Supabase project: REST tables via SUPABASE_URL + SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY (src/supabase.js:33-55); GET /auth/v1/user with SUPABASE_ANON_KEY|SECRET_KEY|SERVICE_ROLE_KEY (src/worker.js:278-285, src/server.js:66-70); browser client via NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY|ANON_KEY (ui/src/lib/supabase-browser.ts)
- OpenClaw WhatsApp bridge at OPENCLAW_BRIDGE_URL (wrangler.toml:17 hardcodes https://bridge.srv1648069.hstgr.cloud) with OPENCLAW_BRIDGE_TOKEN; bridge itself shells to `openclaw gateway call send` inside docker container OPENCLAW_DOCKER_CONTAINER (scripts/openclaw-bridge.js:41-55)
- OpenClaw session files on the VPS at OPENCLAW_SESSIONS_DIR default /docker/openclaw-dngq/data/.openclaw/agents/main/sessions (scripts/openclaw-inbound-forwarder.js:4)
- Vendor-neutral email webhook ALERT_EMAIL_WEBHOOK_URL (+ optional ALERT_EMAIL_WEBHOOK_TOKEN) accepting {to,subject,text,html,metadata} (src/worker.js:453-494)
- Google Analytics gtag.js with measurement id (ui/src/app/layout.tsx:60,132-135; ui/src/components/GoogleAnalytics.tsx:44)
- GitHub Actions repository secrets: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (.github/workflows/deploy-cloudflare.yml:41-44)
- Paperclip agent host files /paperclip/.github-token, /docker/paperclip-aiym/.github-token, /docker/paperclip-aiym/.env (scripts/paperclip-git-push.sh:14-24)
- Browserbase `bb` and `browse` CLIs + verified residential proxy sessions (only for .agents/skills/search-marketplace/SKILL.md; unused by code)
- @oai/artifact-tool npm package (audit/*.mjs:2; not in package.json or lockfile)
- OpenAI Realtime: only OPENAI_REALTIME_MODEL name is read (src/outreach.js:94); no API call exists; OPENAI_API_KEY/CALLING_ENABLED in .env.example are never read
- Node.js >=22 (package.json:24; wrangler 4.93.1 engines node>=22.0.0) vs ui-lint.yml Node 20 (Next 16.2.4 engines node>=20.9.0)

## Key files

| Path | Role |
| --- | --- |
| `package.json` | Root scripts (test/check/build:ui/verify:ui-auth-config/lint:ui:ci/dev/deploy), engines node>=22, deps @cloudflare/puppeteer ^1.3.0, devDeps wrangler 4.93.1 |
| `package-lock.json` | lockfileVersion 3; resolves wrangler 4.93.1 and @cloudflare/puppeteer 1.3.0; @oai/artifact-tool (needed by audit/*.mjs) is absent |
| `wrangler.toml` | Worker config: main src/worker.js, compatibility_date 2026-03-13, nodejs_compat, ASSETS from ./ui/out, BROWSER binding, cron '15 * * * *', [vars] OPENCLAW_BRIDGE_URL hardcoded |
| `.github/workflows/ui-lint.yml` | PR/main check: Node 20, NODE_ENV=production, npm ci, npm run check, lint:ui:ci, next build (no Supabase env) |
| `.github/workflows/deploy-cloudflare.yml` | Push-to-main/manual production deploy: Node 22, npm run check, npm run deploy with CLOUDFLARE_API_TOKEN/ACCOUNT_ID and NEXT_PUBLIC_SUPABASE_* secrets; concurrency cancel-in-progress |
| `.env.example` | Documented env template; incomplete vs code and contains two orphan vars |
| `.gitignore` | Ignores .env, results/, data/, .wrangler/, OpenClaw env/state files; does not ignore .playwright-cli/ |
| `src/env.js` | loadEnv (.env.local then .env, no override) and requireEnv (throws on missing keys); used by Node server/CLI and by cloudflare/firecrawl providers |
| `src/dev.js` | npm run dev launcher: spawns src/server.js (HOST/PORT/LIBERGENT_DEMO_CITY) and ui dev (LIBERGENT_API_BASE) |
| `src/provider-options.js` | Provider credential keys (FIRECRAWL_API_KEY; CLOUDFLARE_ACCOUNT_ID+API_TOKEN) and isProviderConfigured(env) used to add remote fallbacks |
| `src/worker.js` | Cloudflare entry: applyEnv (48-62), PREMIUM_* env parsing (74-100), admin auth (265-272), Supabase auth (274-291), alert email/digest delivery (453-494), runAlertProfile/runDuePremiumAlerts (496-539), /api/openclaw/inbound (762), /api/admin/alerts/run (1026), /api/admin/browser-benchmark (1079), /api/whatsapp/send (1217), default export fetch+scheduled (1433-1447) |
| `src/supabase.js` | getSupabaseConfig reads SUPABASE_URL/SECRET_KEY/SERVICE_ROLE_KEY and 15 table-name vars (33-55); readPremiumEntitlement with LIBERGENT_PREMIUM_EMAILS allowlist and LIBERGENT_PREMIUM_ALERTS_BETA bypass (403-418) |
| `src/providers/openclaw.js` | sendWhatsAppViaOpenClaw: POST {bridge}/whatsapp/send with Bearer OPENCLAW_BRIDGE_TOKEN |
| `src/providers/cloudflare.js` | Cloudflare Browser Rendering REST provider; requireEnv(CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN); LIBERGENT_MOCK_PROVIDER=1 mock |
| `src/providers/firecrawl.js` | Firecrawl scrape provider; requireEnv(FIRECRAWL_API_KEY) |
| `src/providers/cloudflare-browser.js` | BROWSER binding usage via @cloudflare/puppeteer; Kitesurf vs Chromium launch; benchmark and multi-site search |
| `src/app.js` | Runtime detection via VERCEL/CF_PAGES/LIBERGENT_RUNTIME (20-30), mock switch LIBERGENT_MOCK_SEARCH (32-34), remote fallback selection via isProviderConfigured (104-108) |
| `src/history.js` | Local JSON history file; DATA_ROOT switches on legacy VERCEL env (line 6) |
| `src/outreach.js` | buildOpenAIRealtimeConfig reads OPENAI_REALTIME_MODEL only; explicitly never dials or contacts OpenAI |
| `src/server.js` | Node dev API: loadEnv(ROOT), PORT/HOST, LIBERGENT_ADMIN_TOKEN, Supabase auth key chain, LIBERGENT_DEMO_CITY |
| `ui/package.json` | Next 16.2.4 / React 19.2.4 / supabase-js; scripts dev/build/lint/lint:ci |
| `ui/next.config.ts` | output: export, trailingSlash, inlines NEXT_PUBLIC_SUPABASE_URL/PUBLISHABLE_KEY/ANON_KEY, dev-only /api rewrite to LIBERGENT_API_BASE |
| `ui/src/lib/supabase-browser.ts` | Returns null client when NEXT_PUBLIC_SUPABASE_* absent (the state PR CI builds in) |
| `ui/src/app/layout.tsx` | GA id from NEXT_PUBLIC_GA_MEASUREMENT_ID // NEXT_PUBLIC_GOOGLE_ANALYTICS_ID // hardcoded 'G-R8P7G7PWR7' (60,132-135); NEXT_PUBLIC_SITE_URL default |
| `scripts/verify-ui-auth-config.js` | Deploy gate: throws unless Supabase URL and publishable key strings appear in ui/out/_next/static/chunks/*.js |
| `scripts/benchmark-kitesurf.js` | Ops benchmark hitting /api/admin/browser-benchmark for every SITES adapter; defaults base URL to https://libergent.com; needs LIBERGENT_ADMIN_TOKEN |
| `scripts/openclaw-bridge.js` | VPS-side HTTP bridge (127.0.0.1:8788): GET /health, POST /whatsapp/send with Bearer OPENCLAW_BRIDGE_TOKEN; spawns docker exec/openclaw CLI |
| `scripts/openclaw-inbound-forwarder.js` | VPS-side poller: reads OpenClaw session JSONL every 3s, POSTs inbound WhatsApp messages to LIBERGENT_INBOUND_WEBHOOK_URL with LIBERGENT_INBOUND_WEBHOOK_TOKEN, dedupes via state file |
| `scripts/paperclip-git-push.sh` | Paperclip-agent git push helper; reads GITHUB_PAT_TOKEN from /paperclip/.github-token, /docker/paperclip-aiym/.github-token or .env; temp GIT_ASKPASS |
| `docs/github-workflow.md` | Branch+PR process, conventional commits, push via paperclip helper, 'CEO approval' for direct main pushes |
| `docs/openclaw-bridge.md` | How to run scripts/openclaw-bridge.js on the VPS; states inbound needs a separate forwarder (one now exists but is undocumented) |
| `docs/lib-18-github-push-access.md` | Placeholder: 'Result: Pending push verification in this commit' never resolved |
| `.agents/skills/search-marketplace/SKILL.md` | Browserbase Facebook Marketplace search skill (US metros, bb/browse CLIs); not referenced by any code |
| `skills-lock.json` | Locks the skill to /Users/vicorico/.config/browserbase/... (path on another machine) |
| `audit/build-feature-tracker.mjs` | One-off generator of docs/libergent-feature-tracker.xlsx via @oai/artifact-tool (not installed), hardcoded /Users/vicorico/code/libergent, baseline 133 tests dated 2026-08-02 |
| `audit/verify-feature-tracker.mjs` | One-off xlsx inspector/renderer via @oai/artifact-tool; writes to /tmp |
| `docs/libergent-feature-tracker.xlsx` | Exists; QA tracker workbook produced by audit/build-feature-tracker.mjs (not opened) |
| `.playwright-cli/` | 11 committed Playwright-CLI debug artifacts (console logs + a11y page snapshots) from 2026-03-13 sessions against 127.0.0.1:8787 and olx.ro |
| `ui/AGENTS.md` | Next.js agent rule stub (read node_modules/next/dist/docs); ui/CLAUDE.md just includes it |
| `ui/README.md` | Untouched create-next-app template (mentions Vercel deploy) |

## Notable design decisions

- ENV TABLE FORMAT: NAME — read at (path:line) | .env.example: yes/no | README: yes/no | notes
- ENV: FIRECRAWL_API_KEY — src/providers/firecrawl.js:17,23,55,61; src/provider-options.js:5 | .env.example: yes (line 1, non-empty placeholder 'fc-your-key') | README: no (only 'Firecrawl credentials' prose at 228)
- ENV: CLOUDFLARE_ACCOUNT_ID — src/providers/cloudflare.js:64,66; src/provider-options.js:6; deploy-cloudflare.yml:42 | .env.example: yes (3) | README: no
- ENV: CLOUDFLARE_API_TOKEN — src/providers/cloudflare.js:64,71; src/provider-options.js:6; deploy-cloudflare.yml:41 | .env.example: yes (4) | README: no
- ENV: PREMIUM_KITESURF_ENABLED — src/worker.js:87 (off only for '0','false','off','no') | .env.example: yes (6) | README: yes (282,289)
- ENV: PREMIUM_KITESURF_FALLBACK_LIMIT — src/worker.js:91 (unset -> all eligible sites) | .env.example: yes (7 =100) | README: yes (283 =100)
- ENV: PREMIUM_KITESURF_CONCURRENCY — src/worker.js:97 (clamp 1..8, default 4) | .env.example: yes (8) | README: yes (284)
- ENV: PREMIUM_BROWSER_FALLBACK_LIMIT — src/worker.js:75 (default 5 = 4 PREMIUM_BROWSER_SITE_KEYS + okazii.ro, worker.js:35-36) | .env.example: yes (10 =2) | README: yes (285 =5) — DRIFT
- ENV: PREMIUM_BROWSER_CONCURRENCY — src/worker.js:81 (clamp 1..4, default 3) | .env.example: yes (11) | README: yes (286)
- ENV: SUPABASE_URL — src/supabase.js:34; src/worker.js:278; src/server.js:66 | .env.example: yes (12) | README: yes (398)
- ENV: SUPABASE_SECRET_KEY — src/supabase.js:35; src/worker.js:279; src/server.js:67 | .env.example: yes (13) | README: yes (399)
- ENV: SUPABASE_SERVICE_ROLE_KEY — legacy alias, src/supabase.js:35; src/worker.js:279; src/server.js:67 | .env.example: no | README: no
- ENV: SUPABASE_ANON_KEY — auth-only, first in chain, src/worker.js:279; src/server.js:67 | .env.example: no | README: no
- ENV: SUPABASE_SEARCH_EVENTS_TABLE — src/supabase.js:36 | yes (14) | yes (400)
- ENV: SUPABASE_QUERY_STATS_TABLE — src/supabase.js:37 | no | no
- ENV: SUPABASE_KEYWORD_STATS_TABLE — src/supabase.js:38 | no | no
- ENV: SUPABASE_FEEDBACK_TABLE — src/supabase.js:39 | no | no
- ENV: SUPABASE_EMAIL_LEADS_TABLE — src/supabase.js:40 | yes (15) | yes (401,420)
- ENV: SUPABASE_SAVED_SEARCHES_TABLE — src/supabase.js:41 | no | no
- ENV: SUPABASE_WHATSAPP_MESSAGES_TABLE — src/supabase.js:42 | no | no
- ENV: SUPABASE_VEHICLE_PRICE_OBSERVATIONS_TABLE — src/supabase.js:43 | no | no
- ENV: SUPABASE_SHOP_SUGGESTIONS_TABLE — src/supabase.js:44 | no | no
- ENV: SUPABASE_USER_ENTITLEMENTS_TABLE — src/supabase.js:45 | yes (16) | yes (402)
- ENV: SUPABASE_ALERT_PROFILES_TABLE — src/supabase.js:46 | yes (17) | yes (403)
- ENV: SUPABASE_ALERT_LISTING_STATE_TABLE — src/supabase.js:47 | yes (18) | yes (404)
- ENV: SUPABASE_ALERT_EVENTS_TABLE — src/supabase.js:48 | yes (19) | yes (405)
- ENV: SUPABASE_NOTIFICATION_DELIVERIES_TABLE — src/supabase.js:49 | yes (20) | yes (406)
- ENV: LIBERGENT_PREMIUM_EMAILS — src/supabase.js:404 (comma allowlist -> Premium) | yes (22) | yes (409)
- ENV: LIBERGENT_PREMIUM_ALERTS_BETA — src/supabase.js:406 ('1' -> every authenticated user is Premium, source 'beta') | .env.example: NO | README: NO — undocumented paywall bypass
- ENV: ALERT_EMAIL_WEBHOOK_URL — src/worker.js:454,458,478,480 | yes (24) | README: no (docs/premium-alerts-todo.md:161 only)
- ENV: ALERT_EMAIL_WEBHOOK_TOKEN — src/worker.js:462,482 | yes (25) | README: no
- ENV: LIBERGENT_MOCK_SEARCH — src/app.js:33; src/worker.js:126 (read from process.env in the Worker too) | yes (26 =1) | yes (224)
- ENV: LIBERGENT_MOCK_PROVIDER — src/providers/cloudflare.js:5 | yes (27 =1) | yes (225)
- ENV: LIBERGENT_DEMO_CITY — src/dev.js:10; src/server.js:255,308 | yes (28) | yes (123)
- ENV: LIBERGENT_ADMIN_TOKEN — src/worker.js:270; src/server.js:58; scripts/benchmark-kitesurf.js:40 | .env.example: NO | README: yes (357,362); docs/premium-alerts-todo.md:159
- ENV: OPENCLAW_INBOUND_TOKEN — src/worker.js:767 | .env.example: NO | README: NO; docs/openclaw-bridge.md: NO (forwarder sends LIBERGENT_INBOUND_WEBHOOK_TOKEN, a differently named var that must equal it)
- ENV: OPENCLAW_BRIDGE_URL — src/providers/openclaw.js:5; src/worker.js:1225,1246; wrangler.toml:17 [vars] | yes (38) | README: no (docs/openclaw-bridge.md:33 yes)
- ENV: OPENCLAW_BRIDGE_TOKEN — src/providers/openclaw.js:6; src/worker.js:1225,1251; scripts/openclaw-bridge.js:7 | yes (39) | README: no (docs/openclaw-bridge.md:8,33)
- ENV: OPENAI_REALTIME_MODEL — src/outreach.js:94 | yes (37) | README: no ('OpenAI Realtime configuration' prose at 228)
- ENV: OPENAI_API_KEY — READ NOWHERE | yes (36) | no — orphan
- ENV: CALLING_ENABLED — READ NOWHERE | yes (35) | no — orphan
- ENV: LIBERGENT_RUNTIME — set by src/worker.js:55; read src/app.js:24,29 | no | no (internal)
- ENV: VERCEL — src/app.js:22; src/history.js:6 | no | no (legacy hosting)
- ENV: CF_PAGES — src/app.js:23 | no | no (legacy hosting)
- ENV: HOST — src/dev.js:8; src/server.js:32 (default 127.0.0.1) | no | no
- ENV: PORT — src/dev.js:9; src/server.js:31 (default 8787) | no | README mentions 8787 only (219)
- ENV: LIBERGENT_API_BASE — src/dev.js:17; ui/next.config.ts:25 (dev rewrite) | no | no
- ENV: NODE_ENV — ui/next.config.ts:5; ui-lint.yml:14 | no | no
- ENV: NEXT_PUBLIC_SUPABASE_URL — ui/next.config.ts:12; ui/src/lib/supabase-browser.ts:6; scripts/verify-ui-auth-config.js:5; deploy-cloudflare.yml:43 | yes (30) | README: no by name
- ENV: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — ui/next.config.ts:13; supabase-browser.ts:7; verify-ui-auth-config.js:7; deploy-cloudflare.yml:44 | yes (31) | README: no by name
- ENV: NEXT_PUBLIC_SUPABASE_ANON_KEY — legacy alias, ui/next.config.ts:14; supabase-browser.ts:8; verify-ui-auth-config.js:8 | no | no
- ENV: NEXT_PUBLIC_GA_MEASUREMENT_ID — ui/src/app/layout.tsx:133 | yes (29, real id G-R8P7G7PWR7) | yes (456) — but layout.tsx:60 hardcodes the same id as fallback
- ENV: NEXT_PUBLIC_GOOGLE_ANALYTICS_ID — alias, ui/src/app/layout.tsx:134 | no | no
- ENV: NEXT_PUBLIC_SITE_URL — ui/src/app/layout.tsx:59; ui/src/app/page.tsx:11 (default https://libergent.com) | no | no
- ENV: LIBERGENT_BENCHMARK_URL — scripts/benchmark-kitesurf.js:39 (default https://libergent.com) | no | no (README:363 uses --base-url)
- ENV: OPENCLAW_BRIDGE_HOST / OPENCLAW_BRIDGE_PORT / OPENCLAW_DOCKER_CONTAINER — scripts/openclaw-bridge.js:5,6,8 | no | README no; docs/openclaw-bridge.md:9-11 yes
- ENV: OPENCLAW_BIN — scripts/openclaw-bridge.js:55 | no | no
- ENV: OPENCLAW_SESSIONS_DIR / LIBERGENT_INBOUND_WEBHOOK_URL / LIBERGENT_INBOUND_WEBHOOK_TOKEN / OPENCLAW_INBOUND_POLL_MS / OPENCLAW_INBOUND_STATE_FILE — scripts/openclaw-inbound-forwarder.js:4-8 | no | no (forwarder undocumented anywhere)
- ENV: GITHUB_PAT_TOKEN — scripts/paperclip-git-push.sh:16,23,31 | no | README no; docs/github-workflow.md:77 yes
- BINDINGS (not env vars): ASSETS (wrangler.toml:8; src/worker.js:1441), BROWSER (wrangler.toml:11; src/worker.js:340,720,731,863,1086,1100)
- GITHUB SECRETS: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (deploy-cloudflare.yml:41-44); no other Worker secrets are provisioned by CI — SUPABASE_*, LIBERGENT_ADMIN_TOKEN, OPENCLAW_*_TOKEN, PREMIUM_*, ALERT_EMAIL_* must be set out-of-band
- DESIGN: Worker normalizes config by copying all string bindings into globalThis.process.env per request (src/worker.js:48-62) so Node-style modules work unchanged; Node side uses a homegrown .env parser (src/env.js) rather than dotenv
- DESIGN: Static Next export (ui/next.config.ts:9) is served by the Worker's ASSETS binding; API and UI ship in one `wrangler deploy`; public Supabase config is inlined at build time and verified post-build by scripts/verify-ui-auth-config.js before deploy
- DESIGN: Two CI workflows are independent; deploy is triggered by any push to main (deploy-cloudflare.yml:3-7) and gated only by `npm run check`
- DESIGN: Cron is a single hourly trigger; alert scanning is sequential (src/worker.js:537), capped at 20 profiles per run (535), and vehicle-only (504)
- DESIGN: Premium entitlement precedence: LIBERGENT_PREMIUM_EMAILS allowlist > LIBERGENT_PREMIUM_ALERTS_BETA global flag > Supabase user_entitlements row (src/supabase.js:403-418)
- DESIGN: Admin auth accepts Bearer header, x-libergent-admin-token header, or ?token= query (src/worker.js:265-267; src/server.js:48-55)
- DESIGN: Calling is intentionally provider-neutral and unimplemented (src/outreach.js:90-93; .env.example:33-34)
- DESIGN: OpenClaw integration is split: outbound via HTTPS bridge on a Hostinger VPS; inbound via a file-polling forwarder on the same VPS posting to the Worker (docs/openclaw-bridge.md:33 predates the forwarder)
- DESIGN: Repo workflow assumes Paperclip AI-agent operators (scripts/paperclip-git-push.sh; docs/github-workflow.md:68-78,105)

## Unfinished or stubbed

- `.env.example:35` — CALLING_ENABLED=0 is documented but never read by any code (grep across src/ui/scripts returns nothing); calling feature is explicitly unimplemented (src/outreach.js:90-93 'does not dial a number or contact OpenAI')
- `.env.example:36` — OPENAI_API_KEY is documented but never read anywhere; only OPENAI_REALTIME_MODEL (src/outreach.js:94) is consumed
- `.env.example:1` — FIRECRAWL_API_KEY=fc-your-key is a non-empty placeholder; after `cp .env.example .env` (README:207) isProviderConfigured('firecrawl') is true (src/provider-options.js:22-25) and a doomed Firecrawl fallback is queued (src/app.js:104-107) whenever mocks are off
- `src/supabase.js:406` — LIBERGENT_PREMIUM_ALERTS_BETA === '1' short-circuits entitlement to Premium for every authenticated user; feature flag defaulting off, undocumented in .env.example, README and docs/, untested
- `src/image-search.js:17` — extractImageSearchIntent() unconditionally throws 'Image search provider is not configured yet.'; src/worker.js:1119-1123 maps it to HTTP 501 (tracker ERR-002)
- `docs/lib-18-github-push-access.md:5` — 'Result: Pending push verification in this commit' — placeholder verification doc never updated
- `docs/openclaw-bridge.md:33` — States inbound messages 'still need a separate OpenClaw plugin/forwarder' and no generic inbound webhook exists; scripts/openclaw-inbound-forwarder.js and POST /api/openclaw/inbound (src/worker.js:762) now exist but are documented nowhere, including the OPENCLAW_INBOUND_TOKEN / LIBERGENT_INBOUND_WEBHOOK_TOKEN pairing
- `wrangler.toml:17` — OPENCLAW_BRIDGE_URL hardcoded to https://bridge.srv1648069.hstgr.cloud (a specific Hostinger VPS) as a committed plain var
- `scripts/openclaw-inbound-forwarder.js:4` — Hardcoded VPS defaults /docker/openclaw-dngq/data/.openclaw/agents/main/sessions (line 4) and /home/ubuntu/libergent/.openclaw-inbound-forwarder-state.json (line 8); path rewrite at line 33 assumes the docker-internal prefix
- `scripts/paperclip-git-push.sh:14` — Token discovery hardwired to /paperclip/.github-token, /docker/paperclip-aiym/.github-token and /docker/paperclip-aiym/.env — only works on the Paperclip agent host
- `audit/build-feature-tracker.mjs:2` — Imports @oai/artifact-tool which is not in package.json or package-lock.json; outputDir hardcoded to /Users/vicorico/code/libergent/docs (line 4); baseline row records '133/133 tests passed' on 2026-08-02 (line 74) vs 172 today — dead one-off tooling
- `audit/verify-feature-tracker.mjs:2` — Same missing @oai/artifact-tool dependency and hardcoded /Users/vicorico path (line 4); writes /tmp/libergent-feature-tracker-summary.png (line 10)
- `skills-lock.json:5` — Skill source pinned to /Users/vicorico/.config/browserbase/skills/facebook.com/search-marketplace-m9gyrc — a local path on another developer's machine; cannot be re-resolved here
- `.agents/skills/search-marketplace/SKILL.md:1` — Browserbase Facebook Marketplace search skill (US city slugs, USD examples, bb/browse CLIs); no Facebook adapter or reference exists in src/ (grep 'facebook' in src/*.js returns nothing) — unwired to the product
- `.playwright-cli/console-2026-03-13T04-23-03-762Z.log:1` — Directory of 11 committed Playwright-CLI debug artifacts (console logs, a11y snapshots of the March-2026 UI on 127.0.0.1:8787 and olx.ro 404 pages); not referenced by anything and not covered by .gitignore
- `ui/README.md:1` — Untouched create-next-app template including 'Deploy on Vercel' guidance that contradicts the Cloudflare deployment
- `src/app.js:22` — Runtime detection still checks legacy VERCEL and CF_PAGES env vars (also src/history.js:6 writes to /tmp/libergent when VERCEL is set) — remnants of pre-Worker hosting
- `README.md:456` — Claims 'Google Analytics is enabled only when NEXT_PUBLIC_GA_MEASUREMENT_ID is present' but ui/src/app/layout.tsx:60 hardcodes defaultGoogleAnalyticsId='G-R8P7G7PWR7' used at 132-135, so GA is always on
- `README.md:285` — Documents PREMIUM_BROWSER_FALLBACK_LIMIT=5 while .env.example:10 sets 2; code default is 5 (src/worker.js:35-36,75-77)
- `README.md:228` — Claims optional integrations 'use the variables documented in .env.example' but .env.example omits ~20 variables the code reads (see ENV table entries marked .env.example: no)
- `docs/github-workflow.md:44` — Tells contributors to run `npm install && npm run test`, while CI gates are `npm run check` + `lint:ui:ci` + `next build` (.github/workflows/ui-lint.yml:32-39)
- `docs/premium-alerts-todo.md:161` — ALERT_EMAIL_WEBHOOK_URL/TOKEN not yet configured (open P1); with it unset every cron delivery records status 'skipped' (src/worker.js:454,478)

## Risks and smells

- **high** `src/supabase.js:406` — Undocumented global flag LIBERGENT_PREMIUM_ALERTS_BETA='1' grants Premium (search + alerts) to every authenticated user before the Supabase entitlement lookup; no test, no mention in .env.example/README — a single mis-set Worker var silently disables the paywall
- **medium** `src/worker.js:266` — Admin token accepted from the ?token= query string (also src/server.js:54); tokens end up in Cloudflare logs/analytics, browser history and any Referer; combined with the untimed `===` comparison at 271
- **medium** `.github/workflows/deploy-cloudflare.yml:36` — Production deploy fires on every push to main and is gated only by `npm run check` (backend tests + CLI help); the UI lint/type/build job in ui-lint.yml is a separate workflow with no `needs` relationship, so a failing UI lint or type error on main still deploys
- **medium** `.github/workflows/ui-lint.yml:23` — PR checks run on Node 20 while package.json:24 declares engines >=22, deploy-cloudflare.yml:26 uses 22, and wrangler 4.93.1 declares engines node>=22.0.0; PRs are validated on a Node major production never uses. NODE_ENV=production at job level (line 14) also makes root `npm ci` skip devDependencies (currently harmless, fragile)
- **medium** `src/worker.js:1443` — The cron `scheduled` handler, runDuePremiumAlerts (533), runAlertProfile (496), deliverAlertEmail (453), deliverAlertDigest (477) and POST /api/admin/alerts/run (1026) have zero automated coverage (no test file references scheduled/runDuePremiumAlerts/ALERT_EMAIL_WEBHOOK)
- **medium** `src/worker.js:504` — Cron alerts hardcode siteKeys ['autovit.ro','bestauto.ro'] and process up to 20 profiles sequentially with live marketplace fetches every hour (535-537); vehicle-only despite the owner-confirmed tech-first direction, and a slow source can push the scheduled run toward Cloudflare's wall-clock limit
- **medium** `scripts/openclaw-inbound-forwarder.js:105` — setInterval scans are not serialized: a scan longer than POLL_MS (3s) overlaps the next; `state.seen.add` runs only after the awaited POST (95-96), so overlapping scans can forward the same message twice. If postInbound throws, saveState (100) is skipped so persisted dedupe state lags and a restart replays messages. Every tick re-reads and re-parses all session JSONL files (46)
- **medium** `scripts/benchmark-kitesurf.js:39` — Defaults base URL to production https://libergent.com and iterates every SITES adapter (63, 117 sites) with concurrency up to 4 (44) through /api/admin/browser-benchmark, each launching a paid Browser Rendering session; an accidental run spends production browser minutes and load
- **medium** `wrangler.toml:17` — Publishes the OpenClaw VPS hostname bridge.srv1648069.hstgr.cloud in the public repo as a plain var; the bridge (scripts/openclaw-bridge.js:16-19) uses a non-constant-time `===` token compare and forwards an unvalidated `media` URL to OpenClaw as mediaUrl (51), giving any token holder an SSRF-style fetch primitive from the VPS
- **medium** `ui/src/app/layout.tsx:60` — Hardcoded GA measurement id fallback means analytics load unconditionally (contradicting README:456) with no consent gate — relevant for an EU/Romanian consumer site
- **medium** `.env.example:12` — No authoritative list of required production Worker secrets exists: .env.example omits SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, 7 SUPABASE_*_TABLE overrides, LIBERGENT_ADMIN_TOKEN, OPENCLAW_INBOUND_TOKEN, LIBERGENT_PREMIUM_ALERTS_BETA, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_GOOGLE_ANALYTICS_ID, LIBERGENT_BENCHMARK_URL and all forwarder vars, while README:228 says it is the reference; only three secrets are ticked in docs/premium-alerts-todo.md:157-159
- **medium** `README.md:285` — PREMIUM_BROWSER_FALLBACK_LIMIT documented as 5 in README but 2 in .env.example:10 (code default 5 at src/worker.js:36); README:283 shows KITESURF limit 100 whereas the unset default is 'all eligible sites' (worker.js:92) — operators cannot tell what production actually runs
- **low** `src/worker.js:126` — Worker reads LIBERGENT_MOCK_SEARCH from process.env (populated from bindings by applyEnv); setting the var in the dashboard, or wrangler dev picking up a copied .env with LIBERGENT_MOCK_SEARCH=1, makes the deployed API serve mock listings with no guard or log
- **low** `src/env.js:33` — requireEnv calls loadEnv(process.cwd()) which uses fs.existsSync/readFileSync; it is reachable inside the Worker from src/providers/cloudflare.js:64 and firecrawl.js:17,55 when CLOUDFLARE_*/FIRECRAWL secrets are set (applyEnv copies them at worker.js:57-61). Behavior of node:fs and process.cwd() under nodejs_compat is unverified here
- **low** `src/worker.js:48` — applyEnv mutates a process-global env object with all bindings (including secrets) on every request and only after module evaluation; module-level constants such as src/history.js:6 DATA_ROOT read env before applyEnv runs — order-dependent config
- **low** `scripts/verify-ui-auth-config.js:29` — Deploy gate only runs inside `npm run deploy` (package.json:21); ui-lint.yml builds the UI with no Supabase env, so PR CI cannot catch auth-config regressions (supabase-browser.ts:10 silently returns null). The check is a literal substring grep of chunk files and will false-fail if the bundler ever splits or encodes the string
- **low** `.github/workflows/deploy-cloudflare.yml:11` — concurrency cancel-in-progress: true can cancel an in-flight `wrangler deploy` (asset upload + script publish) when two pushes land close together
- **low** `audit/build-feature-tracker.mjs:2` — Two checked-in scripts depend on an uninstalled package (@oai/artifact-tool) and absolute paths on another machine; they cannot run and their embedded QA baseline is stale — dead tooling that misleads readers
- **low** `.playwright-cli/page-2026-03-13T04-23-04-332Z.yml:1` — Committed debug artifacts (11 files) from a March-2026 Playwright session; .gitignore:1-11 does not exclude the directory so future sessions will keep adding noise
- **low** `skills-lock.json:5` — Lock file references a path on another user's machine and the locked skill (Facebook Marketplace via Browserbase) is unrelated to any adapter in src/sites.js; misleading about integrations that exist
- **low** `scripts/paperclip-git-push.sh:16` — Reads a GitHub PAT from fixed container paths and exports it into the environment of the shell (31) before writing it into a temp askpass script; fine on the intended host but silently non-functional anywhere else, and docs/github-workflow.md:71 presents it as the standard push path
- **low** `src/worker.js:1253` — Worker forwards only {target, message} to the bridge while src/providers/openclaw.js:18 (the tested helper) sends {target, message, media, replyTo}; two divergent client implementations of the same bridge contract

## Test coverage

CI runs `npm run check` (node src/cli.js --help + `node --test` over 34 test files, 172 passing per the orchestrator's baseline) plus `eslint .` and `next build` for the UI; there is no coverage tooling, no separate `tsc --noEmit` step (next build type-checks), no UI unit/e2e tests (no *.test.* under ui/), and no test touches anything under scripts/ or audit/. COVERED in my area: sendWhatsAppViaOpenClaw (src/providers/openclaw.test.js:5 happy path, :23 'requires bridge configuration'); the Worker's /api/whatsapp/send path including missing bridge token and non-success bridge payloads (src/worker.test.js:332,385,599); Premium gating through the LIBERGENT_PREMIUM_EMAILS allowlist (src/worker.test.js:173,196,215); Kitesurf-then-Chromium fallback ordering in Premium search (src/worker.test.js:237,281 — these exercise the BROWSER binding via injected launch but do not set PREMIUM_* env vars, so getPremiumBrowserFallbackLimit/Concurrency/isPremiumKitesurfEnabled/getPremiumKitesurfFallbackLimit/Concurrency env parsing (src/worker.js:74-100) is untested); the Browser Rendering provider (src/providers/cloudflare-browser.test.js, 8 tests incl. Kitesurf launch, benchmark, challenge detection); buildOpenAIRealtimeConfig/instructions (src/outreach.test.js:29) and the consent-gated call runner (src/call-pipeline.test.js); mock-provider and Cloudflare REST fallback selection in Node via process.env toggles (src/app.test.js sets LIBERGENT_MOCK_SEARCH/PROVIDER, CLOUDFLARE_ACCOUNT_ID/API_TOKEN, FIRECRAWL_API_KEY, LIBERGENT_RUNTIME); Supabase insert/upsert helpers for feedback, leads, WhatsApp inbound and conversation-owner resolution (src/supabase.test.js). NOT COVERED: export default.scheduled and runDuePremiumAlerts/runAlertProfile (src/worker.js:496-539,1443); deliverAlertEmail/deliverAlertDigest and ALERT_EMAIL_WEBHOOK_* handling (453-494); POST /api/admin/alerts/run (1026), GET /api/admin/browser-benchmark (1079), GET /api/health/sources (1061) and isAuthorizedAdminRequest/getAdminTokenFromRequest incl. the ?token= path (265-272); POST /api/openclaw/inbound and OPENCLAW_INBOUND_TOKEN (762-770); readPremiumEntitlement's Supabase row path, expiry logic and the LIBERGENT_PREMIUM_ALERTS_BETA bypass (src/supabase.js:403-418); getSupabaseConfig table-name overrides beyond email_leads (33-55); applyEnv (worker.js:48-62); src/env.js loadEnv/requireEnv (quoting, precedence, missing-key throw); src/provider-options.js isProviderConfigured and normalizeSearchProvider directly; src/dev.js; ui/next.config.ts rewrites and env inlining; ui/src/lib/supabase-browser.ts null-client behavior; scripts/verify-ui-auth-config.js; scripts/benchmark-kitesurf.js; scripts/openclaw-bridge.js (auth, body limits, docker/openclaw spawn); scripts/openclaw-inbound-forwarder.js (session parsing, dedupe, state persistence); scripts/paperclip-git-push.sh; both audit/*.mjs (not even runnable). The alert domain logic itself (normalizeAlertProfile, matching, buildAlertEvents) has 3 unit tests in src/alerts.test.js but the cron orchestration around it has none.

## Open questions

- Which Worker secrets/vars are actually set in the Cloudflare dashboard for production (SUPABASE_URL/SECRET_KEY/ANON_KEY, LIBERGENT_ADMIN_TOKEN, OPENCLAW_BRIDGE_TOKEN, OPENCLAW_INBOUND_TOKEN, PREMIUM_*, ALERT_EMAIL_*, LIBERGENT_PREMIUM_EMAILS, and critically whether LIBERGENT_PREMIUM_ALERTS_BETA or LIBERGENT_MOCK_SEARCH are set)? Only three are recorded as configured (docs/premium-alerts-todo.md:157-159).
- How is libergent.com routed to the Worker? wrangler.toml has no account_id, routes, or custom-domain configuration, so the mapping lives outside the repo.
- Does the Cloudflare account have the plan required for the [browser] binding and cron triggers, and what is the observed hourly cron duration/cost with live autovit/bestauto fetches?
- Is GitHub branch protection enabled on main (required checks, PR-only) as docs/github-workflow.md:3 assumes? The repo contains no CODEOWNERS/branch-protection artifacts and deploy-cloudflare.yml deploys on any push to main.
- What is PR #33 'Cloudflare bot: wrangler name mismatch' about — does the deployed Worker name differ from wrangler.toml:1 name='libergent' (e.g. an existing Worker under another name), which would make `wrangler deploy` create a second Worker?
- Does `wrangler dev` (4.93.1) load a copied .env with LIBERGENT_MOCK_SEARCH=1, and does node:fs/process.cwd() under nodejs_compat make requireEnv->loadEnv (src/env.js:4-7) a no-op or a throw inside the Worker when CLOUDFLARE_*/FIRECRAWL secrets are present?
- Are scripts/openclaw-bridge.js and scripts/openclaw-inbound-forwarder.js actually running on the VPS (systemd/pm2?), on which OpenClaw version, and is LIBERGENT_INBOUND_WEBHOOK_TOKEN set equal to the Worker's OPENCLAW_INBOUND_TOKEN?
- Is the ALERT_EMAIL_WEBHOOK_URL provider chosen/configured? Until then every cron delivery is recorded as 'skipped' (src/worker.js:454).
- Is the Paperclip agent host (/paperclip, /docker/paperclip-aiym) still the operating model for pushes, or should scripts/paperclip-git-push.sh and the 'CEO approval' clause in docs/github-workflow.md:105 be retired?
- Should the .agents Facebook Marketplace skill, skills-lock.json, audit/*.mjs, docs/libergent-feature-tracker.xlsx and .playwright-cli/ be deleted or moved out of the repo? None are referenced by code or CI.
- Does the owner intend Google Analytics to run without consent on libergent.com (hardcoded id at ui/src/app/layout.tsx:60), or should README:456's opt-in behavior be made true?
- What are the 6 UI dependency vulnerabilities noted in audit/build-feature-tracker.mjs:68 (ACT-005) and are they still present with Next 16.2.4 / supabase-js ^2.110.5? (npm audit requires network; not run here.)
