# Adult product search (local implementation)

The Discovery link opens `/search?category=adult`. Direct search links containing
recognized sexual-wellness terms (including Lovense) enter the same gate. No
category form, provider search or results are mounted until the visitor explicitly
selects “Am cel putin 18 ani”. Refusing returns home. This is self-confirmation,
not identity verification; no identity documents or date of birth are collected.

## Confirmation and enforcement

- Configure `ADULT_CONFIRMATION_SECRET` with a cryptographically random secret of
  at least 32 characters on the Worker and local Node server. Keep it server-side;
  never use a `NEXT_PUBLIC_` variable. Missing configuration fails closed (503 on
  confirmation). Rotate it to invalidate outstanding confirmations.
- `POST /api/adult-access` with JSON `{ "confirm": true }` issues a signed,
  30-minute bearer confirmation. Other values do not issue access. Cross-origin
  browser confirmation requests are rejected.
  When using the separate Next development server, set `LIBERGENT_PUBLIC_URL`
  on the API server to the exact UI origin (for example `http://localhost:3000`).
- Send it in `x-libergent-adult-confirmation`. The UI keeps it only in component
  memory. Reloading, leaving the page, choosing exit, or expiry removes access
  and results. Token expiry is also checked on the server. Like other bearer
  credentials, a copied valid token is usable until expiry; this is not proof of age.
- `/api/search`, `/api/search/free` and `/api/search/premium` enforce the gate
  before provider calls/cache reads. Premium still requires its own entitlement.
  `category=adult` gates even a query without recognized adult terms.
- Pornographic search terms are rejected. Adult offers are filtered out before
  ordinary-search ranking/recommendations. Legacy cache payloads containing adult
  terms are rejected; the cache namespace is bumped. JSON response checks also
  protect detail/image-intent responses containing recognized adult content.

## Privacy and scope

Adult searches bypass shared cache reads/writes and search/vehicle-history writes;
responses use `Cache-Control: no-store`. Public history/trends are rebuilt from
eligible recent events, so old adult queries cannot contribute innocent-looking
tokens to the keyword leaderboard. The history payload's `scope` is
`recent-public-events`; totals are counts within the retained event window, not
lifetime totals. Discovery probes exclude adult terms and prior adult offers.

The dedicated UI displays text product offers and retailer links only. It has no
saved-listing, email-capture, alert, seller-contact or search-event analytics
controls. Known adult queries are rejected by saved-search and alert creation;
legacy adult alerts are skipped. No pornography feature or ID collection exists.

The product policy is a conservative term/brand classifier, not semantic proof
that every possible title is safe. Unknown euphemisms and retailer metadata need
continued taxonomy review. Deployment owners should also review access logs and
site-wide analytics: queries in incoming URLs can exist outside application
history. This implementation does not claim to erase existing logs or databases.

## Coverage and release work

The category uses existing direct marketplace adapters, new-product filtering,
and existing price/ranking logic. No new retailer is advertised as verified.
Empty results explicitly say coverage is not guaranteed. Real stock, pricing,
links and permitted retailer routes must be validated before promoting coverage.

Local tests cover classification, refusal, signed/tampered/expired confirmation,
direct API routes, shared-cache avoidance, public-history exclusion, ordinary
search preservation and adult result filtering. Browser smoke checks exercise
the gate and result UI with controlled product fixtures; they are not evidence
of live retailer coverage.

Publication is separate: approve the local diff, explicitly authorize a push/PR,
then configure the deployment secret and authorize deployment/live validation.
Nothing in this document indicates a production release.

## Local validation — 2026-10-26

- Backend suite: `node --test src/*.test.js src/parsers/*.test.js src/providers/*.test.js`
  — 261 passed, including 10 adult-access regression tests.
- After the development-origin adjustment and import cleanup: adult-access,
  Supabase and discovery-probe suites — 20 passed.
- UI ESLint and TypeScript `--noEmit` — passed. Next production build/static
  export — passed (20 pages). One initial render-purity lint issue was corrected.
- Local Node HTTP and headless Chrome smoke — passed: direct-link gate, no search
  before consent, refusal, accepted fixture results, expiration removal, reload,
  no local adult history, ordinary search and mobile overflow check. Desktop and
  mobile screenshots were inspected. Fixtures do not verify real merchants.
- Live providers, real stock/price/link validation, deployed secret configuration,
  production acceptance and deployment were not run.
- Locked dependency installation reported existing audit findings (backend: 14;
  UI: 11). Dependencies/lockfiles were not changed or automatically upgraded.
