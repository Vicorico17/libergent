# Marketplace Integration TODO

This file tracks marketplaces we still need to add or harden before advertising them as active Libergent sources.

## Product Direction

- Immediate priority: improve keyword matching
  - Make keyword matching the next product-quality workstream before adding more broad marketplace claims.
  - Make matched and missing keywords visible in each result so users understand why a listing ranked highly or was excluded.
  - Improve scoring for exact product, brand, model, storage/size, variant, and condition matches.
  - Penalize accessories, spare parts, wanted ads, services, damaged items, broken/for-parts items, and unrelated variants when the user searches for a main product.
  - Add regression tests for the first niche so weak matches cannot quietly return to the top of results.

- Used + new benchmark search
  - Keep second-hand listings as the primary buying surface.
  - Treat aggregators and retailers as a separate new-price benchmark, not as seller-contact listings.
  - Show savings versus the lowest reliable new price when both used and new results exist.

- Focus on one niche until it is excellent
  - Pick a narrow first niche, then tune parsing, keyword scoring, filtering, and result ranking around it.
  - Add niche-specific smoke tests before expanding to additional categories.
  - Do not broaden messaging until the selected niche returns consistently strong results.

- Focus more on keywords
  - Make matched keywords visible and useful in the UI.
  - Improve scoring so exact product, brand, model, size, variant, and condition matches outrank vague description matches.
  - Penalize accessories, spare parts, wanted ads, services, damaged items, and unrelated variants when the user searches for a main product.

- Search by picture
  - Add an image-upload flow that extracts product keywords from a picture.
  - Let users review and edit extracted keywords before running marketplace search.
  - Reuse the existing classified search pipeline after image-to-keyword extraction.

- Seller messaging from Libergent
  - Find a compliant way for users to send or initiate messages to sellers directly from Libergent.
  - Start with generated Romanian message drafts, copy tracking, and open-contact tracking.
  - Add direct sending only through official APIs, partner flows, email relay, or explicit marketplace-supported contact mechanisms.

## Active Now

- OLX
- Vinted
- Lajumate
- Okazii
- Publi24
- Autovit for car-like searches
- Anuntul
- Price.ro as a new-price aggregator benchmark
- ShopMania as a new-price aggregator benchmark
- BestAuto for car-like Free searches
- Flip and Klap for refurbished-tech Free searches

### Implemented Free and Premium split

- Free standard: OLX, Lajumate, Vinted, Okazii, Publi24, Anuntul, Price.ro, and ShopMania.
- Free conditional · cars: Autovit and BestAuto.
- Free conditional · refurbished tech: Flip and Klap.
- Premium direct-first: eMAG, evoMAG, CEL.ro, Compari, PC Garage, Flanco, and Altex.
- Browser-eligible only after a failed or empty direct result: Okazii, Compari, PC Garage, Flanco, and Altex.
- Direct-only even in Premium: eMAG, evoMAG, CEL.ro, BestAuto, Flip, and Klap.

## Coverage and Provider Audit (2026-07-20)

There are 19 registered adapters in `src/sites.js`. Twelve are Free standard or conditional, and seven are Premium:

- Classified / used: OLX, Vinted, Lajumate, Okazii, Publi24, Anuntul, Autovit and BestAuto for car-like queries, plus Flip and Klap for refurbished-tech queries.
- New-price benchmarks: Price.ro and ShopMania.

The seven Premium adapters are Compari, eMAG, evoMAG, PC Garage, Altex, Flanco, and CEL.ro. Premium is an access/coverage tier, not a provider choice: all seven run direct first, and only the explicit browser allowlist can start Browser Run.

A live direct search for `iphone 15 pro` returned usable listings from OLX, Vinted, Lajumate, and Publi24 with zero provider credits. Okazii returned a Cloudflare challenge. Anuntul, Price.ro, and ShopMania completed without a transport error but returned no included listings. This is a one-query smoke test, not a general availability score, but it means the current "active" list should not be treated as nine equally healthy sources.

The same query against the seven configured Premium candidates split them into two groups:

- Browser benchmark candidates: Compari, PC Garage, and Flanco returned direct `403` challenges; Altex returned `200` but no raw cards.
- Direct-parser candidates: eMAG, evoMAG, and CEL.ro returned `200` with raw parser candidates but no query-relevant included listings. Fix or replace their direct parsers before paying for browser time.

### Candidate decision matrix

| Priority | Source | Product fit | Live direct probe | Recommended path | Premium Browser Run? |
| --- | --- | --- | --- | --- | --- |
| P0 · done | BestAuto | Cars; complements Autovit | `200`; shared Publi24-family parser extracts clean BMW listings | Added as a car-only Free/direct adapter with origin-aware parser coverage | No |
| P0 · done | Flip | Refurbished phones, tablets, laptops, watches | `200`; catalog `__NEXT_DATA__` exposes final price, condition, inventory URL, and image | Added as a refurbished-tech Free/direct adapter; allowed catalog HTML is filtered locally and installment values are ignored | No |
| P0 · done | Klap | Refurbished phones, tablets, laptops | `200`; WooCommerce cards expose current and crossed-out prices | Added as a refurbished-tech Free/direct adapter with a dedicated sale-price parser | No |
| P1 | Used Products | Broad verified second-hand electronics and other durable goods | Initial HTML is `200` but the product catalog is client-rendered; generic parsing returns zero | Investigate the site's public client data/API or request a feed/partner route; parse that directly if permitted | No: its `robots.txt` explicitly blocks `CloudflareBrowserRenderingCrawler` |
| P1 | BestBike | Motorcycles, scooters, ATVs, accessories | Homepage/query probe returned `200`, but no cards were extracted using the Publi24 parser | Find the stable search route and add a dedicated or shared-network parser | Only if JS rendering is proven necessary and allowed |
| P2 | Animalutul | Pets and animal accessories | Homepage/query probe returned `200`, but no cards were extracted | Add only after Libergent intentionally supports pet queries | Only if JS rendering is proven necessary and allowed |
| P2 | MarketplaceRomania | General new/used marketplace | `200`, but the tested WordPress-style search parameter did not return query-specific products | First validate inventory depth and discover the real browse/search endpoint | No evidence yet |
| P2 | Refurbed Romania | Refurbished electronics benchmark | Direct probe returned `401` | Check official/public API, feed, terms, and Romanian inventory value before investing | Browser experiment only after those checks |
| Hold | Facebook Marketplace | High-value private-seller inventory | Account/session-dependent and not suitable for anonymous server scraping | Pursue a compliant partner, user-authorized, or link-out workflow only | No unattended browser scraping |

### Provider rule for new sources

1. Try browser-like direct HTML first.
2. If the page is client-rendered, inspect public first-party data calls or an official feed/API before starting a browser.
3. Add a dedicated local parser and fixtures when the HTML/data is available. A generic parser returning rows is not enough; final price and result relevance must be correct.
4. Use Cloudflare Browser Run only when JavaScript execution is required, access is allowed, and a browser benchmark proves materially better coverage.
5. Do not use Browser Run as an anti-bot bypass. Its `/crawl` endpoint respects `robots.txt`, identifies itself as `CloudflareBrowserRenderingCrawler/1.0`, and does not bypass CAPTCHA or bot protection.
6. Before production activation, review the source's terms, `robots.txt`, rate limits, and permitted use. `robots.txt` is a crawl signal, not a complete grant of legal permission.

### Next implementation batch

1. Done: BestAuto uses the direct path and the origin-aware Publi24-family parser.
2. Done: Flip and Klap use dedicated direct parsers with final-price regression tests.
3. Discover the Used Products client data contract or request a feed; do not spend Browser Run time on it.
4. Re-run active-source smoke tests with at least one query per target niche and either fix or demote sources that repeatedly return zero or challenges.
5. Benchmark Browser Run only for the remaining allowlisted sources and record browser seconds, raw cards, included cards, challenge status, and final-price accuracy.

### Implementation validation (2026-07-20)

- BestAuto direct `bmw`: 10 relevant vehicles returned from 7,909 raw listings; URLs and images resolve to the BestAuto origin.
- Flip direct `iphone 15 pro`: exact iPhone 15 Pro returned at 3,199.99 RON; the 267 RON monthly installment value was not selected.
- Klap direct `iphone 15 pro`: six exact iPhone 15 Pro variants returned with current payable prices from 2,599 to 3,299 RON.
- Unit coverage verifies Free/Premium disjointness, complete adapter categorization, conditional car/tech routing, Flip final-price extraction, Klap sale-price extraction, and BestAuto shared-parser origin handling.

## Add Next: Classified and Used Sources

- Facebook Marketplace
  - Goal: include listings because many private sellers post there first.
  - Blocker: direct scraping is not a good path. Needs a compliant partner/feed, user-authorized flow, or link-out workflow.
  - UI rule: do not show as an actively searched source until backend can return real listings reliably.

- Flip.ro
  - Goal: used/refurbished tech, especially iPhone and Samsung searches.
  - Current status: implemented as a Free conditional direct adapter. The dedicated parser reads final prices and condition from allowed catalog HTML and filters locally; it does not use the disallowed `?search=` route.
  - Follow-up: investigate permitted pagination or a feed so coverage can extend beyond the catalog page's initial product payload.

- Klap.ro
  - Goal: refurbished phones, tablets, and laptops with condition grades and warranty.
  - Current status: implemented as a Free conditional direct adapter with a WooCommerce parser that prefers the current sale price over crossed-out prices.
  - Follow-up: expand condition-grade extraction as Klap's card markup evolves; no browser dependency is justified.

- UsedProducts.ro
  - Goal: verified second-hand electronics, games/consoles, tools, instruments, bikes, and other durable goods.
  - Current status: direct document fetch returns `200`, but catalog products are loaded client-side.
  - Needed: inspect the public client data/API or request a supported feed. Do not use Cloudflare `/crawl`; the site's current `robots.txt` explicitly blocks its crawler user agent.

- BestAuto.ro
  - Goal: expand vehicle coverage beyond Autovit for car searches.
  - Current status: implemented through the Free/direct path, routed only for car-like queries, with an origin-aware Publi24-family parser test.
  - Follow-up: retain health monitoring because the site's `robots.txt` probe was intermittently `504` during research.

- BestBike.ro
  - Goal: expand motorcycle, scooter, ATV, and moto accessories coverage.
  - Research: Publi24 network partner; the 2026-07-20 homepage/query probe returned `200`, but the tested route did not yield cards through the Publi24 parser.
  - Needed: stable search URL/provider before default-active search.

- Animalutul.ro
  - Goal: pet and animal-related listings, including accessories.
  - Research: Publi24 network partner; the 2026-07-20 homepage/query probe returned `200`, but the tested route did not yield cards through the Publi24 parser.
  - Needed: stable search URL/provider before default-active search.

- PCGarage.ro
  - Goal: direct electronics/PC retail benchmark.
  - Research: registered in API, but direct probes returned Cloudflare challenge pages.
  - Needed: blocked-source/provider work before default-active search.

## Add Later: Retail Benchmark Sources

- CEL.ro
  - Goal: direct retail benchmark where aggregators are not enough.
  - Current status: direct fetch returned `200` with raw parser candidates on 2026-07-20, but no query-relevant items survived for `iphone 15 pro`; older deployed Worker probes had 522/timeouts.
  - Needed: improve direct parsing and re-test Worker reliability before considering browser fallback.

- Compari.ro
  - Goal: new-product price benchmark coverage, useful as market-price context rather than second-hand listings.
  - Current status: registered in API, but direct requests hit anti-bot protection.
  - Needed: provider work before making it default-active.

- evoMAG
  - Goal: direct retail benchmark.
  - Current status: direct fetch returned `200` and raw parser candidates on 2026-07-20, but the static route produced no query-relevant included items and has historically returned homepage promo modules.
  - Needed: find a stable query endpoint or add a stricter parser before default-active search.


- eMAG
  - Goal: retail benchmark prices for common products.
  - Current status: direct fetch returned `200` and raw parser candidates on 2026-07-20, but no query-relevant items survived; older Node/Worker probes had returned 511.
  - Needed: validate and improve the direct parser before spending Browser Run time, then re-test from the deployed Worker.

- Flanco
  - Goal: electronics and appliance retail benchmark.
  - Current status: direct fetch hit a Cloudflare challenge (`403`) on 2026-07-20.
  - Needed: a permitted one-page Browser Run benchmark can determine whether rendering yields real cards; keep inactive until price accuracy is proven.

- Altex
  - Goal: electronics and appliance retail benchmark.
  - Current status: direct fetch returned `200` but the parser found no raw cards on 2026-07-20.
  - Needed: inspect client data first; benchmark Browser Run only if JavaScript execution is actually required.

## Researched But Not Active

- Mobexpert.ro
  - Fit: furniture retail benchmark.
  - Probe result: Node fetch returned HTML, but generic parsing grabbed navigation/category links with unrelated nearby prices.
  - Needed: dedicated parser before API activation.

- Dedeman.ro
  - Fit: DIY/home/garden retail benchmark.
  - Probe result: candidate search URL returned 404-like HTML; needs correct stable search endpoint.

- Decathlon.ro
  - Fit: sports retail benchmark.
  - Probe result: candidate search URL returned 403 from Node fetch.

- FashionDays.ro
  - Fit: fashion retail benchmark.
  - Probe result: candidate search URL returned 404-like HTML; needs correct stable search endpoint.

## Reliability Work

- Make Vinted harder to fail
  - Keep direct parser covered by fixture tests.
  - Add a fallback provider path when direct HTML returns empty or blocked.
  - Track `rawItemCount`, `itemCount`, and provider fallback reason in the UI/search report.
  - Add live smoke tests for common Vinted-heavy queries: `iphone 15 pro`, `nike air force`, `geaca zara`, `rochie mango`, `adidas samba`.

- Improve blocked marketplace handling
  - Keep Cloudflare/anti-bot errors visible in the search report.
  - Do not silently remove marketplaces from all-search when they fail.
  - Add provider fallback only when credentials/config are present.

- Add per-source health checks
  - Daily smoke query per marketplace.
  - Record parsed count, included count, blocked status, and median response time.
  - Alert when a source returns zero raw listings for multiple common queries.

## UI Requirements

- Only list a marketplace/source as "searched" when it is active in `src/sites.js` and has a parser/provider path in `src/search.js`.
- Show unavailable future sources separately if we want product messaging around "coming soon".
- Keep the search report honest: successful count, blocked count, parsed count, filtered count, and duplicate count should stay visible.
- Keep second-hand and new-price benchmark results visually separate.
