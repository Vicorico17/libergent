# libergent

Node app for searching Romanian second-hand marketplaces with direct HTML parsing by default and optional remote rendering fallbacks.

Supported marketplaces:

- `olx.ro`
- `vinted.ro`
- `lajumate.ro`
- `okazii.ro`
- `publi24.ro`

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

The quality-check layer exists because the lowest price is often misleading. Extremely cheap listings can be:

- broken
- for parts
- incomplete
- unrelated accessories
- low-quality query matches

libergent therefore keeps both ideas:

- cheapest visible offer
- AI-checked best offer

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
- `vinted.ro`: direct HTML fetch + local parser
- `lajumate.ro`: direct HTML fetch + local parser
- `okazii.ro`: direct HTML fetch + local parser
- `publi24.ro`: direct HTML fetch + local parser

Target strategy:

1. fetch the maximum useful number of listings from one search page
2. paginate only when necessary
3. dedupe locally by URL
4. compute lowest price, average price, and best offer locally

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

## Setup

```bash
cd /Users/alex/libergent
cp .env.example .env
```

Normal search now uses direct scraping and does not require Firecrawl credits. Add provider keys only if you want the live Firecrawl credits dashboard or explicit fallback providers:

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

## Cloudflare requirements

There are two separate Cloudflare paths and they should not be mixed up.

### 1. Browser Rendering for scraping

This is the Cloudflare feature libergent needs for scraping. According to Cloudflare's Browser Rendering docs, the REST API requires:

- a Cloudflare account
- your `CLOUDFLARE_ACCOUNT_ID`
- an API token with `Browser Rendering - Edit`

Those values go in `.env`:

```bash
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
```

### 2. Cloudflare One / `cloudflared` CLI

The page you linked, `https://developers.cloudflare.com/cloudflare-one/tutorials/cli/`, is about using `cloudflared` to access applications protected by Cloudflare Access from a CLI. That is useful for protected apps, but it is not the same thing as Browser Rendering.

libergent does not need that tutorial just to call Browser Rendering.

If you want Cloudflare deployment as well, then the useful extra pieces from you would be:

- whether you want a Worker deployment or just REST API usage
- your Cloudflare account ID
- an API token with Browser Rendering permissions
- if deploying publicly through Cloudflare, the target domain or subdomain you want to use

If you want me to wire a Cloudflare Worker next, I will also need to know whether you want:

- a Worker-only app
- a Worker API in front of the current local app
- or a Tunnel/Access setup for private preview

## Usage

Web app:

```bash
cd /Users/alex/libergent
npm run dev
```

Then open `http://localhost:8787`.

The UI lets you type only a product name and shows:

- AI-checked best offer on each marketplace
- direct listing link for that best offer
- extracted listings per marketplace
- average price across parsed RON listings
- one global best offer across marketplaces

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
