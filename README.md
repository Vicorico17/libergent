# LiberGent

LiberGent is a Romanian product-search and deal-ranking application. A user enters one query, LiberGent searches several classified marketplaces and retail sources, normalizes their cards, rejects weak matches, and recommends a second-hand offer alongside a new-price benchmark.

Production: [libergent.com](https://libergent.com)

## What the app currently does

- searches Romanian marketplaces through **Free** and **Premium test** modes
- shows progress per marketplace while slower sources continue loading
- separates second-hand offers from refurbished and new retail benchmarks
- requires exact model numbers and important variant/specification terms for technical products
- rejects accessories, parts, wanted ads, repair listings, damaged products, and unrelated variants when appropriate
- deduplicates equivalent listings within and across sources
- ranks offers using relevance, condition, price, freshness, seller evidence, and risk signals
- recommends a **Best Used Deal** and a separate **New Price Benchmark**
- exposes matched/missing keywords, price intelligence, risk flags, and recommendation reasons
- loads richer listing information only when **Analiză LiberGent** is opened
- supports authenticated favorites, offer feedback, seller contact, and private WhatsApp conversation history
- provides a public trends page based on recorded search activity

The search page keeps diagnostics collapsed under **Raport Căutare**. That panel contains agent notes, source distribution, marketplace coverage, provider names, result counts, and technical errors.

## Marketplace coverage

There are 26 registered adapters. A source being registered does not guarantee that it will return listings for every query; marketplace availability, markup, and anti-bot behavior can change independently.

### Free

| Source | Role | Routing | Default provider |
| --- | --- | --- | --- |
| OLX | Classified / second-hand | Every Free search | Direct |
| Vinted | Marketplace / second-hand | Every Free search | Direct |
| Lajumate | Classified / second-hand | Every Free search | Direct |
| Okazii | Marketplace / mixed inventory | Every Free search | Direct |
| Publi24 | Classified / second-hand | Every Free search | Direct |
| Anuntul | Classified / second-hand | Every Free search | Direct |
| Price.ro | New-price aggregator | Every Free search | Direct |
| ShopMania | New-price aggregator | Every Free search | Direct |
| Autovit | Vehicles | Car-like queries only | Direct |
| BestAuto | Vehicles | Car-like queries only | Direct |
| Flip | Refurbished technology | Relevant technology queries only | Direct |
| Klap | Refurbished technology | Relevant technology queries only | Direct |

Free API requests resolve `provider=auto` to direct access and never start automatic Browser Run sessions.

### Premium test

Premium includes the query-routed Free sources, seven general retail/price-benchmark adapters, and seven fashion retailers for fashion-related searches:

| Source | Direct first | Automatic browser eligible | Current note |
| --- | --- | --- | --- |
| eMAG | Yes | No | Dedicated direct parser |
| evoMAG | Yes | No | Direct parser; coverage depends on the search route |
| CEL.ro | Yes | No | Direct connection can intermittently return 522/timeouts from Cloudflare infrastructure |
| Compari | Yes | Yes | Browser runs only after a failed or empty direct result |
| PC Garage | Yes | Yes | Browser runs only after a failed or empty direct result |
| Flanco | Yes | Yes | Browser runs only after a failed or empty direct result |
| Altex | Yes | Yes | Can parse useful DOM content even when navigation completion times out |

Fashion queries (for example sneakers, shoes, clothing, bags, or fashion brands) also search Sizeer, ePantofi, Fashion Days, Zalando, ABOUT YOU, Answear, and MODIVO as direct-first new-price benchmarks. They are intentionally skipped for unrelated searches.

Okazii is the only Free source eligible for the same conditional browser fallback during a Premium search. All eligible sources share one bounded browser session. Browser automation is never started when the direct result already contains usable cards.

CEL was tested with Browser Run after direct timeouts, but the browser timed out without extracting cards as well. It intentionally remains direct-only so it does not add browser cost and latency without improving coverage.

See [docs/marketplace-integration-todo.md](docs/marketplace-integration-todo.md) for live-source findings, candidate marketplaces, and integration priorities.

## How search results are processed

The API and **Raport Căutare** distinguish the following stages:

1. **Carduri citite / `parsedListings`** — candidate cards parsed from marketplace pages.
2. **Potrivite cu termenii / `matchedListings`** — titles that pass the initial query-token filter.
3. **Nepotrivite cu termenii / `queryMismatchListings`** — parsed cards that do not contain enough required query evidence.
4. **Excluse / `excludedListings`** — matched cards later classified as accessories, parts/repair, wanted ads, or secondary/wrong variants.
5. **Duplicate / `duplicateListings`** — equivalent listings removed during cross-source normalization.
6. **Rezultate / `includedListings`** — normalized listings retained for ranking and display.

For a query such as `iphone 15`, the numeric token `15` is mandatory. More specific searches also preserve important variant and specification intent: `iphone 15` does not silently become `iphone 15 pro max`, while `iphone 15 pro 256gb` requires the requested model/variant/storage evidence.

A high “nepotrivite cu termenii” count usually means a marketplace page contained navigation cards, promotions, other catalog products, or loose search results. It does **not** mean that the same number of valid products was removed by the accessory/quality classifier.

## Query understanding and recommendation quality

Search begins with a lightweight, deterministic interpretation step in `src/query-understanding.js`. It produces a reusable profile containing the likely product category and entity, detected make/model, confidence, canonical marketplace path, comparable-product key, alternative interpretations, and useful refinement questions. Source routing, relevance filtering, ranking, the API summary, and the UI all use this same profile.

For example, a search for `mustang` is interpreted as **Ford Mustang**, routes to vehicle-capable marketplaces, uses the canonical Autovit make/model path, and rejects clothing, scale models, spare parts, and unrelated uses of the word. The interface keeps the single search box and shows a compact interpretation strip with alternatives such as `macheta mustang` or `haine mustang`; selecting one runs that explicit search. Ambiguous searches can also show a few optional refinements instead of forcing a multi-step form.

The implementation is product-agnostic rather than Mustang-specific:

1. `understandQuery()` identifies known product entities and broader families such as vehicles, phones, consoles, appliances, luggage, apparel, and collectibles.
2. `src/sites.js` uses the category to select marketplaces that can plausibly contain that product. Vehicle intent, for example, avoids fashion and generic retail price sources.
3. `src/relevance.js` requires category-appropriate evidence and applies hard exclusion gates before scoring.
4. `src/aggregate.js` ranks semantic match tiers before deal quality, so a cheap but weak match cannot outrank the requested product.
5. Price claims are calculated only inside a defensible comparable cohort. Vehicle comparisons require the same entity and, when years are available, a maximum four-year gap. If the evidence is insufficient, the API withholds price intelligence instead of presenting a misleading “deal.”

Unknown products still use the generic token-matching path, but a one-word unknown query cannot receive the same confidence as a recognized exact entity. To add another product family, extend the catalog and family rules in `src/query-understanding.js`, add its category-specific eligibility rules in `src/relevance.js` if needed, then cover the interpretation, routing, exclusions, and comparable cohort in the corresponding tests.

The search response exposes `summary.queryUnderstanding` and `summary.recommendationMode`. The UI labels a result **Best Used Deal** only when comparable price evidence supports that claim; otherwise it uses the more conservative **Top Match**. Feedback can include a structured reason, allowing search-quality failures such as wrong product, wrong variant, accessory/part, suspicious price, or stale listing to be measured separately.

## Ranking and price intelligence

Ranking is deterministic and runs locally after parsing. It considers:

- title and query-token coverage
- brand, model, variant, storage/size, and condition evidence
- negative intent such as `pentru piese`, `defect`, `spart`, or `nefuncțional`
- listing completeness and available seller/location metadata
- price position relative to comparable results
- suspiciously low prices that may indicate incomplete or damaged products
- recency when the marketplace exposes a usable date

Used and new inventory are analyzed separately. The response can include used/new medians, fair ranges, the lowest new price, and estimated savings of the recommended used offer versus the new benchmark.

## Listing analysis

Opening **Analiză LiberGent** calls:

```text
GET /api/marketplace/details?url=<supported-listing-url>
```

The request is lazy and direct-only; it does not start Browser Run. When the public listing page exposes the data, the drawer can show:

- full description
- precise location
- seller identity, type, rating, and review count
- product rating
- condition and structured specifications
- delivery price and timing
- buyer-protection fees and known payable total

Only allowlisted marketplace URLs and redirects are accepted. Responses are size-limited, and successful enrichment is cached for 30 minutes. Missing fields remain explicitly unavailable rather than being invented.

## Reliability and provider policy

The default policy is:

1. fetch the marketplace search page directly with browser-like request headers
2. parse and score HTML locally
3. retry a small set of transient transport failures with the alternate direct header profile
4. use Browser Run only for the explicit Premium allowlist and only after a failed or empty direct result
5. never use Browser Run as a CAPTCHA or anti-bot bypass

Important source-specific behavior:

- successful Vinted catalog HTML is cached for five minutes per exact URL
- Vinted receives one delayed retry when its first response is an intermittent Cloudflare challenge; failed challenge pages are not cached
- direct Cloudflare origin errors `520`–`524` are retried with the alternate direct request profile
- Altex browser navigation timeouts are recoverable only when the already-loaded DOM contains real product cards
- identical Premium searches are cached for five minutes
- listing contact lookups are cached for 15 minutes

The main cost driver is processed pages/browser duration, not the number of JSON rows. New integrations should therefore prefer direct first-party HTML or public client data plus dedicated local parsers. Review each source's terms, robots policy, and permitted use before production activation.

## Architecture

- `src/worker.js` — Cloudflare Worker API and static-asset entry point
- `src/search.js` — provider execution, direct fetching, query filtering, and pagination
- `src/sites.js` — marketplace registry, Free/Premium tiers, and conditional routing
- `src/parsers/` — marketplace-specific and retail HTML parsers
- `src/aggregate.js` — normalization, classification, deduplication, ranking, and price intelligence
- `src/providers/cloudflare-browser.js` — bounded Cloudflare Browser Run fallback
- `src/listing-details.js` — on-demand detail extraction
- `ui/` — Next.js static frontend
- `supabase/` — search tracking, leads, and private conversation schema

## Local setup

Requirements: Node.js 22 or newer.

```bash
git clone <repository-url>
cd libergent
cp .env.example .env
npm install
npm --prefix ui install
```

Start the API and Next.js UI together:

```bash
npm run dev
```

- UI with hot reload: `http://localhost:3000`
- local API: `http://127.0.0.1:8787`

The example environment enables mock search/provider modes. Set these to `0` when intentionally running live marketplace requests:

```bash
LIBERGENT_MOCK_SEARCH=0
LIBERGENT_MOCK_PROVIDER=0
```

Direct scraping does not require Firecrawl credentials. Optional integrations use the variables documented in [.env.example](.env.example), including Cloudflare, Supabase, analytics, OpenClaw, and OpenAI Realtime configuration.

## Commands

```bash
# backend tests and CLI contract
npm run check

# deterministic UI lint
npm --prefix ui run lint:ci

# production UI build
npm run build:ui

# one live, readable all-source CLI report
npm run search:live -- --query "iphone 15"

# local Cloudflare Worker runtime
npm run dev:worker

# deploy the Worker and static UI
npm run deploy
```

CLI examples:

```bash
node src/cli.js search --site olx.ro --query "iphone 15 pro" --provider direct --limit 50 --pages 1

node src/cli.js search --site all --query "iphone 15 pro" --provider auto --limit 120 --pages 1 --pretty
```

## HTTP API

### Free search

```bash
curl "http://127.0.0.1:8787/api/search/free?q=iphone%2015&site=all&limit=30&pages=1"
```

`/api/search` remains a backward-compatible alias for `/api/search/free`.

### Premium search

```bash
curl "http://127.0.0.1:8787/api/search/premium?q=iphone%2015&site=all&limit=30&pages=1"
```

On the deployed Cloudflare Worker, Premium testing requires the `BROWSER` binding but does not require a payment token. The local Node API now supports direct-only Premium aggregation without Browser Run; it cannot provide the Worker's conditional browser fallback. `PREMIUM_BROWSER_FALLBACK_LIMIT` can lower the maximum number of conditional browser sources; the current full allowlist contains five sources including Okazii.

### Response summary

An aggregated response contains per-source results plus a summary similar to:

```json
{
  "searchTier": "premium",
  "summary": {
    "marketplaces": 17,
    "successfulMarketplaces": 15,
    "parsedListings": 311,
    "matchedListings": 20,
    "queryMismatchListings": 291,
    "includedListings": 20,
    "excludedListings": 0,
    "duplicateListings": 0,
    "queryUnderstanding": {
      "category": "phone",
      "confidence": "high"
    },
    "recommendationMode": "best-used-deal",
    "bestUsedOffer": {},
    "bestNewBenchmark": {},
    "priceIntelligence": {}
  },
  "results": [
    {
      "site": "olx.ro",
      "provider": "direct",
      "ok": true,
      "parsedItemCount": 52,
      "matchedItemCount": 6,
      "includedItemCount": 6,
      "items": []
    }
  ]
}
```

Counts vary by query and source availability. Failed marketplaces remain represented with `ok: false`, their provider, and a technical error so partial searches stay auditable.

### Other endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health/sources` | Source health summary |
| `GET /api/history` | Aggregated search history and trends |
| `POST /api/leads` | Email lead capture |
| `POST /api/saved-searches` | Saved-search subscription data |
| `GET /api/marketplace/details` | Lazy listing enrichment |
| `GET /api/marketplace/contact` | Supported listing contact lookup |
| `POST /api/feedback` | Offer feedback |
| `GET /api/conversations` | Authenticated conversation list |
| `POST /api/whatsapp/send` | Authenticated seller outreach through the configured bridge |

The protected `/api/admin/browser-benchmark` endpoint renders one supported marketplace at a time and requires `LIBERGENT_ADMIN_TOKEN` plus the `BROWSER` binding.

## Accounts, analytics, and Supabase

Supabase Auth supports Google and passwordless email when they are configured. `/confirm` completes OAuth/magic-link callbacks, while `/account` provides an account dashboard for liked listings, saved alerts, private seller conversations, LiberGent activity history, identity details, and logout. `/signup` plus `/reset` use the same passwordless account flow. Signed-out visitors can search, inspect **Analiză LiberGent**, and open original marketplace listings. Favorites, feedback, WhatsApp outreach, listing statuses, and private conversation history require authentication.

Search analytics and email capture require:

```bash
SUPABASE_URL=...
SUPABASE_SECRET_KEY=...
SUPABASE_SEARCH_EVENTS_TABLE=search_events
SUPABASE_EMAIL_LEADS_TABLE=email_leads
```

Run the relevant SQL files in `supabase/` before enabling these features. Use the unqualified table name `email_leads`, not `public.email_leads`, in `SUPABASE_EMAIL_LEADS_TABLE`.

### Search-quality database migration

The structured feedback reason requires the `reason` column on `public.offer_feedback`. For an existing Supabase project, run the complete, idempotent [supabase/search_tracking.sql](supabase/search_tracking.sql) file in the Supabase SQL editor. It creates missing tracking objects, adds the column safely, and asks PostgREST to reload its schema cache.

The minimal migration, if the rest of the tracking schema is already installed, is:

```sql
alter table public.offer_feedback
  add column if not exists reason text not null default '';

notify pgrst, 'reload schema';
```

No destructive migration or manual backfill is required: existing rows receive the empty-string default. The new query interpretation and recommendation-quality fields are stored inside the existing `search_events.best_offer` `jsonb` payload, so they do not require additional columns. Verify the feedback migration with:

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'offer_feedback'
  and column_name = 'reason';
```

Client-side Google Analytics is enabled only when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is present.

Seller conversation APIs validate the Supabase access token and filter history by account ID. Direct client access to WhatsApp message rows is disabled through RLS. Ambiguous inbound ownership is intentionally left unassigned rather than risking cross-account disclosure. Bridge setup is documented in [docs/openclaw-bridge.md](docs/openclaw-bridge.md).

## Cloudflare deployment

`wrangler.toml` configures the Worker, static assets from `ui/out`, Node compatibility, and the `BROWSER` binding.

```bash
npm run build:ui
npm run deploy
```

Production deployment is also automated by [.github/workflows/deploy-cloudflare.yml](.github/workflows/deploy-cloudflare.yml). UI lint/build validation runs through [.github/workflows/ui-lint.yml](.github/workflows/ui-lint.yml).

## Project documents

- [Marketplace integration TODO](docs/marketplace-integration-todo.md)
- [Classified marketplace feature plan](docs/classified-marketplace-feature-plan.md)
- [Search E2E QA](docs/lib-23-qa-website-search-e2e.md)
- [GitHub workflow](docs/github-workflow.md)
- [OpenClaw bridge](docs/openclaw-bridge.md)

## Current limitations

- Marketplace availability and anti-bot responses are inherently intermittent; a partial search can still be useful and is reported transparently.
- Vinted can challenge both controlled direct attempts when no successful cache entry exists.
- CEL.ro can time out from Cloudflare infrastructure even when it responds from other networks; browser fallback was tested and intentionally rejected because it added latency without cards.
- Some retail pages return promotional/navigation candidates that are correctly counted as parsed but rejected as query mismatches.
- Browser Run cannot solve CAPTCHA or override marketplace access policy.
- Search-by-image remains an unfinished integration and should not be advertised as active.
