# libergent

Node app for searching Romanian second-hand marketplaces through a remote rendering/scraping provider.

Supported marketplaces:

- `olx.ro`
- `vinted.ro`
- `lajumate.ro`
- `okazii.ro`

Supported providers:

- `auto`
- `firecrawl`
- `cloudflare`

## Why this design

For marketplace search, the useful unit is the search results page, not a whole-site crawl. libergent:

1. Builds the marketplace-specific search URL from your product query.
2. Chooses a marketplace-specific provider and strategy.
3. Uses structured extraction to pull listing cards into JSON.

## Setup

```bash
cd /Users/alex/libergent
cp .env.example .env
```

Fill one provider:

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

## Usage

Web app:

```bash
cd /Users/alex/libergent
npm run dev
```

Then open `http://localhost:8787`.

The UI lets you type a product and shows:

- lowest visible offer on each marketplace
- direct listing link for that lowest offer
- extracted listings per marketplace
- average price across parsed RON listings
- optional per-marketplace runs for debugging
- configurable target listing count and page count

CLI:

Single marketplace:

```bash
node src/cli.js search --site olx.ro --query "iphone 15 pro" --provider auto --limit 50 --pages 2
```

All marketplaces:

```bash
node src/cli.js search --site all --query "iphone 15 pro" --provider auto --limit 100 --pages 3 --out results/iphone-15-pro.json
```

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

## Notes

- `olx.ro`: Firecrawl search-page extraction
- `vinted.ro`: Cloudflare JSON extraction by default
- `lajumate.ro`: Firecrawl search-page extraction
- `okazii.ro`: Cloudflare crawl-seed strategy by default

## Cloudflare `/crawl`

Cloudflare launched Browser Rendering `/crawl` on March 10, 2026. It is useful for category-wide monitoring and multi-page discovery. For libergent's first version, `/json` is a better fit than `/crawl` because each marketplace already exposes a search results page for a user query.

## Constraints

Check each marketplace's `robots.txt`, terms, and bot protections before production use. Cloudflare documents that Browser Rendering `/crawl` respects `robots.txt`, including `crawl-delay`, and blocked URLs are returned as `disallowed`.
