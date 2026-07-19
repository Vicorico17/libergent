# libergent

Cloudflare Worker app for searching Romanian second-hand marketplaces and comparing them with new-product price benchmarks from Romanian aggregators/retailers.

Supported marketplaces:

- `olx.ro`
- `autovit.ro` for car searches
- `vinted.ro`
- `lajumate.ro`
- `okazii.ro`
- `publi24.ro`
- `anuntul.ro`
- `price.ro` for new-product price benchmarks
- `shopmania.ro` for new-product price benchmarks

Supported providers:

- `auto`
- `direct`
- `firecrawl`
- `cloudflare`

## Why this design

For marketplace search, the useful unit is the search results page, not a whole-site crawl. libergent:

1. Builds the marketplace-specific search URL from your product query.
2. Chooses a marketplace-specific provider and strategy.
3. Uses structured extraction to pull listing cards into JSON.

The product direction is intentionally simple in the UI:

- the user should only type the product name
- pagination, result-volume tuning, and provider choice are internal concerns
- the output should be structured per marketplace with links
- the app should surface a quality-checked best offer, not just the raw cheapest item

The current product focus is mixed Romanian product search: real second-hand listings, strict keyword matching, deduplication, and a separate new-price benchmark so buyers can see whether a used offer is actually below retail. See [docs/classified-marketplace-feature-plan.md](docs/classified-marketplace-feature-plan.md) for the image-search and seller-messaging roadmap.

The quality-check layer exists because the lowest price is often misleading. Extremely cheap listings can be:

- broken
- for parts
- incomplete
- unrelated accessories
- low-quality query matches

libergent therefore keeps both ideas:

- cheapest visible offer
- AI-checked best used offer
- lowest new-price benchmark

The best-offer score currently uses lightweight heuristics so the app can stay cheap:

- title/query token overlap
- condition hints such as `Nou`
- penalties for terms like `pentru piese`, `defect`, `spart`, `nefunctional`
- penalties for prices far below the marketplace median, which often indicate junk or partial items

## Cost strategy

The main engineering constraint is affordability.

The expensive part is not the number of JSON rows returned. The expensive part is how many pages or browser sessions we need to process to get those rows.

That means libergent should optimize for:

1. as few remote renders as possible
2. as much data as possible per remote render
3. local parsing and scoring whenever possible
4. provider-specific fallbacks only when a marketplace blocks the cheaper path

Current strategy:

- `olx.ro`: direct HTML fetch + local parser
- `autovit.ro`: direct HTML fetch + local parser, enabled only for car-like queries
- `vinted.ro`: direct HTML fetch + local parser
- `lajumate.ro`: direct HTML fetch + local parser
- `okazii.ro`: direct HTML fetch + local parser
- `publi24.ro`: direct HTML fetch + local parser
- `anuntul.ro`: direct HTML fetch + local parser
- `price.ro`: direct HTML fetch + local retail parser
- `shopmania.ro`: direct HTML fetch + local retail parser

Registered but not searched by default until the blocked-source/provider work is handled:

- `cel.ro`
- `compari.ro`
- `emag.ro`
- `altex.ro`
- `flanco.ro`

Target strategy:

1. fetch the maximum useful number of listings from one search page
2. paginate only when necessary
3. dedupe locally by URL and normalized product identity
4. compute used median, new benchmark, savings, and best offers locally

This is the reason libergent should move toward "close to one scrape for all results" where the marketplace allows it. In practice, that means:

- determine the maximum number of listings available on the first rendered search page
- determine whether lazy-loading or infinite scroll reveals more results without a second scrape
- only then add additional page fetches

## Provider economics

Provider cost matters directly to the scraper design.

Firecrawl documents billing per processed page. Their billing docs currently state:

- `Scrape`: `1 credit/page`
- `JSON format`: `+4 credits/page`
- `Browser`: `2 credits/browser minute`

Cloudflare Browser Rendering currently documents REST API pricing by browser duration, with a free allowance and then `$0.09` per browser hour on paid plans.

Implication:

- `5 listings` from one processed page can be cheap
- `500 listings` from twenty processed pages is not cheap
- the biggest savings come from reducing processed pages, not from trimming a few listing objects from the output

Because of that, libergent does not default to AI JSON extraction on every page for every marketplace. The cheaper design is:

1. direct fetch or the cheapest render possible
2. local HTML parsing when feasible
3. AI extraction only where markup is too dynamic or brittle
4. browser/crawl tools only for the marketplaces that truly require them

## Collaboration workflow

Use the GitHub branch and pull request process in [docs/github-workflow.md](docs/github-workflow.md).

## Setup

```bash
cd /Users/alex/libergent
cp .env.example .env
```

Normal search now uses direct scraping and does not require Firecrawl or Cloudflare. Add provider keys if you want `provider=auto` to escalate blocked or blank direct marketplace searches to remote rendering, or if you want to run those providers explicitly:

```bash
FIRECRAWL_API_KEY=fc-your-key
```

or:

```bash
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
```

If you already authenticated the Firecrawl CLI, you can usually pull the key locally with:

```bash
firecrawl env
```

## Analytics and email leads

Google Analytics is enabled when the UI build has a public measurement ID:

```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-R8P7G7PWR7
```

The app loads `gtag` only when that value is present and records client-side route changes in the Next.js app.

Email capture from the search-results popup posts to `/api/leads` and stores rows in Supabase. Run `supabase/search_tracking.sql` before enabling this in production, and configure:

```bash
SUPABASE_URL=...
SUPABASE_SECRET_KEY=...
SUPABASE_EMAIL_LEADS_TABLE=email_leads
```

Use the unqualified public table name (`email_leads`), not `public.email_leads`, in `SUPABASE_EMAIL_LEADS_TABLE`. If the search tracking tables already exist but `/api/leads` returns `Could not find the table 'public.email_leads' in the schema cache` or an `email_leads_email_check` constraint violation, run `supabase/email_leads.sql` in the Supabase SQL Editor. It creates or repairs the table, enables row level security, and asks PostgREST to reload the schema cache.

The lead endpoint normalizes email addresses to lowercase and upserts by email to avoid duplicate rows.

## Cloudflare deployment

The app is wired for Cloudflare Workers through `wrangler.toml`.

Local Worker dev:

```bash
npm run dev:worker
```

Deploy:

```bash
npm run deploy
```

### Browser marketplace benchmark

Cloudflare Browser Run is reserved for explicit browser-assisted operations. The protected benchmark endpoint renders one marketplace search page at a time and reports parser coverage, duration, challenge detection, and a five-item sample:

```bash
curl -H "Authorization: Bearer $LIBERGENT_ADMIN_TOKEN" \
  "https://YOUR_DOMAIN/api/admin/browser-benchmark?site=vinted.ro&q=iphone&limit=20"
```

Run marketplaces one at a time to keep browser usage and Worker execution time bounded. The endpoint requires `LIBERGENT_ADMIN_TOKEN` and the `BROWSER` binding configured in `wrangler.toml`.

### Free and Premium search APIs

Free search uses direct marketplace connections and never starts Browser Run:

```bash
curl "https://YOUR_DOMAIN/api/search/free?q=iphone&site=all&limit=30"
```

`/api/search` remains a backward-compatible alias for the Free contract. Premium search combines the Free results with browser-rendered searches across the configured Premium marketplaces:

```bash
curl -H "Authorization: Bearer $LIBERGENT_PREMIUM_TOKEN" \
  "https://YOUR_DOMAIN/api/search/premium?q=iphone&site=all&limit=30"
```

Premium search requires both the `BROWSER` binding and a `LIBERGENT_PREMIUM_TOKEN` Wrangler secret. The admin token is also accepted for internal testing. Browser marketplaces run with bounded concurrency and a maximum of 30 parsed items per source.

During the internal test phase, select **Premium test** on the search page and enter either `LIBERGENT_PREMIUM_TOKEN` or `LIBERGENT_ADMIN_TOKEN`. The token is kept in `sessionStorage` for the current browser tab only. The coverage panel then reports each marketplace's provider, result count, and failure reason.

### Private seller conversations

Seller outreach requires a valid Supabase account session. `POST /api/whatsapp/send`, `GET /api/conversations`, and `GET /api/conversations/:id` validate the Supabase access token. Outbound and inbound WhatsApp messages are tagged with the account ID and conversation APIs filter history server-side, so one account cannot read another account's messages.

The search UI opens a private conversation drawer after a message is sent, shows the agent/seller transcript, and attaches a conversation status to the listing (`contacted`, `replied`, `negotiating`, `unavailable`, or `deal_agreed`). Direct client access to `whatsapp_messages` is disabled by RLS; only the Worker service role can access the table. If inbound ownership is ambiguous because multiple accounts contacted the same seller number, the reply is deliberately left unassigned instead of risking cross-account disclosure.

Direct scraping does not require provider secrets. If you later use Cloudflare Browser Rendering as an explicit scraping fallback, configure `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in Wrangler secrets.

## Usage

Local Node web app:

```bash
cd /Users/alex/libergent
npm run dev
```

Then open `http://localhost:8787`.

The UI lets you type only a product name and shows:

- AI-checked best second-hand offer
- a separate new-price benchmark from aggregators/retailers
- source-type filters for second-hand, aggregators, and retailers
- extracted listings per marketplace
- used and new price intelligence with savings versus the lowest new price

CLI:

Single marketplace:

```bash
node src/cli.js search --site olx.ro --query "iphone 15 pro" --provider auto --limit 50 --pages 2
```

All marketplaces:

```bash
node src/cli.js search --site all --query "iphone 15 pro" --provider auto --limit 120 --pages 3 --out results/iphone-15-pro.json
```

Readable live report across all marketplaces:

```bash
npm run search:live -- --query "riftbound"
```

The `search:live` command:

- disables mock mode for that run
- searches all marketplaces
- uses one page per marketplace with site-specific default limits
- tries direct browser-like fetch profiles first, then configured remote providers when `provider=auto` cannot get listings
- prints a readable report with offers from each marketplace
- prints one recommended `bestOffer` across all marketplaces

Cloudflare:

```bash
node src/cli.js search --site vinted.ro --query "nike dunk" --provider cloudflare
```

## Output shape

```json
{
  "ok": true,
  "provider": "firecrawl",
  "site": "olx.ro",
  "url": "https://www.olx.ro/oferte/q-iphone-15-pro/",
  "query": "iphone 15 pro",
  "itemCount": 10,
  "items": [
    {
      "title": "iPhone 15 Pro 256 GB",
      "price": "3 100 lei",
      "currency": "lei",
      "location": "Bucuresti",
      "postedAt": "azi",
      "condition": "Utilizat",
      "sellerType": "Persoana fizica",
      "url": "https://www.olx.ro/d/oferta/...",
      "imageUrl": "https://..."
    }
  ]
}
```

For `--site all`, the response also includes a `summary` section with `averagePriceRon`, `pricedListingsRon`, and `totalListings`.

If you want human-readable terminal output instead of JSON, add `--pretty`:

```bash
node src/cli.js search --site all --query "riftbound" --provider auto --limit 5 --pages 1 --pretty
```

## Notes

- `olx.ro`: direct search-page extraction
- `vinted.ro`: direct search-page extraction
- `lajumate.ro`: direct search-page extraction
- `okazii.ro`: direct search-page extraction
- `publi24.ro`: direct search-page extraction

These are direct parsers, not final architecture. The main optimization task is to keep Firecrawl/Browser Rendering as explicit fallbacks while increasing listing coverage through local parsing.

## Cloudflare `/crawl`

Cloudflare launched Browser Rendering `/crawl` on March 10, 2026. It is useful for category-wide monitoring and multi-page discovery. For libergent's first version, `/json` is a better fit than `/crawl` because each marketplace already exposes a search results page for a user query.

However, `/crawl` may still be the right choice for specific marketplaces if it gives better listing coverage per unit cost than repeated single-page renders.

## Constraints

Check each marketplace's `robots.txt`, terms, and bot protections before production use. Cloudflare documents that Browser Rendering `/crawl` respects `robots.txt`, including `crawl-delay`, and blocked URLs are returned as `disallowed`.

## Open optimization tasks

- measure maximum usable listings from a single search-page render for each marketplace
- test whether infinite scroll can reveal more results without additional billed page fetches
- replace generic AI extraction with marketplace-specific parsing where possible
- reserve Browser Rendering and crawl workflows for the hardest marketplaces
- compare cost per 100 listings across Firecrawl and Cloudflare
