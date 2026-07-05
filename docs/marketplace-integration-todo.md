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

## Add Next: Classified and Used Sources

- Facebook Marketplace
  - Goal: include listings because many private sellers post there first.
  - Blocker: direct scraping is not a good path. Needs a compliant integration approach, browser-session workflow, user-authorized flow, or partner/feed option.
  - UI rule: do not show as an actively searched source until backend can return real listings reliably.

- Flip.ro
  - Goal: used/refurbished tech, especially iPhone and Samsung searches.
  - Current status: direct HTML probes are blocked with 403.
  - Needed: investigate official/public endpoints, browser-backed provider, or remote scraping provider that can handle the site reliably.

- BestAuto.ro
  - Goal: expand vehicle coverage beyond Autovit for car searches.
  - Current status: direct requests hit anti-bot protection.
  - Needed: add only behind a provider that can fetch consistently, then route it only for car-like queries.

## Add Later: Retail Benchmark Sources

- CEL.ro
  - Goal: direct retail benchmark where aggregators are not enough.
  - Current status: local direct fetch can work, but deployed Cloudflare Worker requests returned 522/timeouts.
  - Needed: handle under the blocked-source/provider workstream before making it default-active.

- Compari.ro
  - Goal: new-product price benchmark coverage, useful as market-price context rather than second-hand listings.
  - Current status: direct requests hit anti-bot protection.
  - Needed: decide whether this belongs in listing results or a separate "retail benchmark" panel.


- eMAG
  - Goal: retail benchmark prices for common products.
  - Current status: guessed search route did not expose a usable direct result page.
  - Needed: find a stable integration route before adding it to the search pipeline.

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
