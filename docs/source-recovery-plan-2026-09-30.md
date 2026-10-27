# Source recovery plan — 2026-09-30

## Objective

Increase the number of registered sources that return relevant, purchasable listings with a trustworthy current price. Optimize for useful source-query coverage, not the number of domains in the registry. Keep direct, browser, feed/API, and production evidence separate so a source is not called healthy just because its page loaded.

The latest checked-in source audit is dated 2026-09-28. It covers all 117 registered sources. Its detailed observations are in [source availability](source-availability-2026-09-28.md) and `src/source-validation-snapshot.js`.

## Current baseline

| Evidence group | Sources | What the evidence says |
| --- | ---: | --- |
| Direct accepted listings | 43 | At least one representative direct query produced accepted offers. Recheck before making durable health claims. |
| Reviewed browser accepted listings | 4 | IKEA, JYSK, F64, and Bookzone produced price-checked results with Kitesurf. |
| Production Free accepted listings | 1 | OLX is green from production evidence even though the local direct audit saw a 403. |
| No current useful-result evidence | 69 | Split by observed failure below. |
| **Registered total** | **117** | Registration and routing are not health evidence. |

Sources with recorded useful evidence: autovit.ro, bestauto.ro, vinted.ro, flip.ro, klap.ro, lajumate.ro, publi24.ro, anuntul.ro, emag.ro, cel.ro, epantofi.ro, fashiondays.ro, zalando.ro, modivo.ro, mobexpert.ro, dedeman.ro, sportvision.ro, photosetup.ro, soundcreation.ro, mcmusic.ro, libris.ro, forit.ro, zooplus.ro, epiesa.ro, petmax.ro, animax.ro, regatuljocurilor.ro, thehome.ro, petmart.ro, redgoblin.ro, footshop.ro, buzzsneakers.ro, sneakerindustry.ro, modlet.ro, kondela.ro, playbike.ro, itgalaxy.ro, makeup.ro, springfarma.com, epetshop.ro, petguru.ro, nemira.ro, senia.ro, ikea.com, jysk.ro, f64.ro, bookzone.ro, and olx.ro.

The snapshot also contains older successful production checks for Okazii; these do not override its latest challenge evidence. Treat it as unresolved until a fresh, useful result is observed.

## The 69 unresolved sources and the right recovery path

### A. Search completed, but no offers passed extraction and relevance (13)

shopmania.ro, evomag.ro, altex.ro, aboutyou.ro, leroymerlin.ro, intersport.ro, mezoni.ro, ambient.ro, scule.ro, 4fstore.ro, sportano.ro, autohut.ro, automag.ro.

**Plan:** inspect a saved response for each; separate wrong route, empty inventory, JavaScript-only content, bad card boundaries, wrong price selection, and relevance-filter rejection. Use a category-appropriate query with known inventory. Fix a parser or URL only when evidence shows which one is wrong. Record raw candidates, parsed rows, filtered rows, and rejection reasons independently. These are the best first targets because a successful HTTP request already exists.

### B. Search URL returned 404 (20)

hornbach.ro, nichiduta.ro, douglas.ro, sephora.ro, deichmann.com, jdsports.ro, fashionhouse.ro, bonami.ro, bricodepot.ro, ferex.ro, miculmester.ro, bike24.ro, mediagalaxy.ro, autokarma.ro, unixauto.ro, esteto.ro, farmec.ro, librarie.net, pravaliacucarti.ro, zeedo.ro.

**Plan:** inspect the official site navigation/search form and public category/search links; derive the URL shape from the site's own markup or a documented endpoint. Verify redirects and final URL. Never guess a route based only on a common ecommerce convention. For each recovered route, capture representative HTML/data and implement a card-specific parser if the retail parser cannot reliably bind title, price, link, image, and availability to one product.

### C. Access challenge or 403/429 (19)

okazii.ro, price.ro, compari.ro, pcgarage.ro, flanco.ro, decathlon.ro, carturesti.ro, noriel.ro, notino.ro, xxxlutz.ro, mathaus.ro, arabesque.ro, sportisimo.ro, vexio.ro, avstore.ro, drmax.ro, helpnet.ro, elefant.ro, thomann.de (19).

**Plan:** first test official product feeds, documented APIs, affiliate/catalog feeds, sitemap product data, or a commercial data provider with clear permission. Browser rendering is appropriate only if the site allows automated access and a normal browser session returns the inventory. Do not treat CAPTCHA or bot challenges as a puzzle to bypass. Keep blocked sources visible as blocked and do not send browser retries on every user query without evidence that they help.

### D. Search redirected, returned an error page, or soft-failed (8)

answear.ro, bebetei.ro, ccc.eu, hervis.ro, a2t.ro, autodoc.ro, pieseauto.ro, musicshop.ro.

**Plan:** record requested URL, final URL, status, title, and a short body signature. Determine whether the search path is stale, requires a locale/store selector, redirects to a retailer's new domain, or is a retired/parked site. Update canonical hosts/routes only from current first-party evidence. If a source is defunct or no longer carries relevant inventory, remove it from routing rather than masking its error.

### E. Network/HTTP failure (8)

sizeer.ro, bricksdepot.ro, dormeo.ro, egradini.ro, tenis-shop.ro, badabum.ro, roata.ro, okian.ro.

**Plan:** repeat with bounded timeouts from the intended runtime and capture DNS/TLS/status/redirect diagnostics. Distinguish temporary origin trouble from a dead domain or local-network limitation. Retry sparingly; add backoff and health state instead of retrying each marketplace on every query. Look for a current canonical domain or official feed before investing in parser work.

### F. Timeout (1)

somproduct.ro.

**Plan:** one controlled longer-timeout probe with response-size and navigation timing. If direct HTML is consistently too slow, check a supported product feed/API. Do not raise the global timeout for one slow source.

## Execution order

### Phase 1 — Make evidence reproducible

1. Build a per-source validation report that records timestamp, runtime, requested/final URL, status, fetch method, duration, bytes, raw candidates, parsed candidates, accepted offers, and rejection reasons.
2. Use two realistic queries per source, each matched to its category and actual inventory; include one query with a known product/model when available.
3. Save small sanitized HTML/JSON fixtures for each parser fix. Keep credentials, cookies, personal data, and session tokens out of fixtures and logs.
4. Re-run the 43 direct-evidence and four browser-evidence sources so we know which ones still work before expanding the denominator.

### Phase 2 — Recover low-friction direct sources

1. Start with the 13 completed-but-empty sources; they are the likely parser, search URL, or query-relevance recoveries.
2. Work through the 20 404 sources using first-party route discovery.
3. Work through the eight redirect/soft-error sources and eight transport failures, demoting retired/unavailable sites promptly.
4. Fix the current Noriel route to `/catalog?q=` as a candidate recovery; it is not promoted until the new route produces accepted offers in a fresh run.

### Phase 3 — Expand data paths, not bypasses

For challenge-blocked or JS-rendered sources, check in this order: official API/feed; affiliate/catalog feed; permitted public product data; browser rendering where allowed and useful; commercial provider where unit economics support it. Track permission, rate limits, freshness, and per-search cost for each path. A source stays unresolved if it only returns a challenge.

### Phase 4 — Optimize live routing

1. Route by query niche and proven source usefulness; do not fan every query out to all 117 domains.
2. Put cheap direct fetches first, and use bounded browser fallback only for sources whose browser benchmark increases accepted, relevant results.
3. Add per-source timeout, concurrency, cache, and retry budgets. A failing source must not consume the latency budget for all the healthy sources.
4. Expose source-level partial success and failure reasons in search responses and Discovery.
5. Revisit Free/Premium placement using measured usefulness and cost, not registry size.

### Phase 5 — Keep the gains

Schedule representative health checks, alert on repeated failures or repeated zero accepted results, and keep last-known-good evidence separate from the latest check. Promote a source only after repeated useful results; demote it after a defined run of failures. Keep a manual override for known transient incidents.

## New options reviewed — 2026-10-02

The recent links and scraping anecdotes add possible tools, but they do not replace source-by-source evidence.

| Option | Could help with | Won't solve / decision |
| --- | --- | --- |
| Cloudflare Markdown for Agents | Cleaner extraction from a source that already serves the page and has enabled Cloudflare's content conversion. Probe with `Accept: text/markdown`; inspect the returned content type. | The source owner must have the feature enabled. It is not a generic fetch proxy and does not bypass a challenge. Markdown can also discard product-card boundaries needed to bind title, price, URL, and stock. Test only on reachable sources first. |
| TinyFish Search / Fetch | A bounded external comparison for live search and JavaScript-rendered page content, especially among the 13 sources whose direct searches completed but yielded no accepted results. | It adds a vendor/data-processing dependency, and clean Markdown or model output is not proof of a correct listing. Vendor pricing page currently lists Search and Fetch as free within account limits, Browser at $0.002/minute, and Agent at $0.016/step; reconfirm before adoption. Do not route all 117 sources through a paid browser/agent path. |
| Obscura | A possible lightweight renderer for a specific JavaScript-heavy source when ordinary collection is permitted. Its README claims low memory and fast startup; these are project benchmarks, not Libergent measurements. | Libergent already uses Cloudflare Kitesurf for Premium browser fallback; Cloudflare says Obscura inspired Kitesurf's initial prototype. Obscura describes its rendering support as evolving. A VPS-hosted renderer would add another service and Worker-to-VPS integration, while stealth features do not add source-specific extraction quality. Do not replace Kitesurf based on headline speed claims. |
| Browser-fingerprinting guide and stealth claims | Context for why direct fetch and normal browser rendering may behave differently, and a reminder to record runtime, route, and failure signals. | Its central subject is bypassing anti-bot systems. Do not add fingerprint masking, CAPTCHA-solving, or proxy rotation as a method for overriding a source's access controls. A challenge is not evidence that a different evasion tool should be deployed. |
| DIY versus ScrapingBee anecdotes | Evidence that DIY results vary sharply by target, query volume, network, and operational effort. One poster reports replacing a service for their workload; another could not reproduce reliable Google SERPs and kept paying. | Neither report predicts Libergent results. Compare providers against Libergent's real source mix using correct accepted listings, cost per useful listing, freshness, latency, and failure rate. A managed service may be rational for selected sources; it should not become the default for every source. |

Cloudflare's Kitesurf engineering post says Obscura provided the initial inspiration for Kitesurf. TinyFish currently lists Search/Fetch limits of 30 requests per minute / 500 per hour and 150 URLs per minute / 1,000 per day respectively, plus the browser/agent rates above. These are vendor-published terms and may change. See [Cloudflare Markdown for Agents](https://blog.cloudflare.com/markdown-for-agents/), [Cloudflare Kitesurf engineering](https://blog.cloudflare.com/kitesurf/), [Obscura](https://github.com/h4ckf0r0day/obscura), [TinyFish docs](https://docs.tinyfish.ai/), [TinyFish pricing](https://www.tinyfish.ai/pricing), and the [browser fingerprinting guide](https://github.com/niespodd/browser-fingerprinting).

## Updated practical sequence

1. Refresh representative checks for the 48 sources with useful-result evidence, and retain the 69 unresolved sources by failure class.
2. Start with the 13 direct-completed-but-empty sources. Compare current HTML extraction against TinyFish Fetch and, where the origin has enabled it, Markdown for Agents. Keep the source-specific parser as the quality gate.
3. Investigate the 20 stale/404 routes using first-party search forms and links; an external browser/fetch service cannot correct a guessed route by itself.
4. Test Obscura's normal rendering mode only if Kitesurf fails on an allowed JavaScript-rendered source and a lower-cost/self-hosted renderer is a real operational goal. Compare accepted listings, price accuracy, reliability, latency, and total operations cost.
5. For the 19 challenged sources, seek an official API/feed, affiliate feed, partner permission, or a vendor arrangement with explicit allowed coverage. Do not turn the anti-bot bypass examples into an implementation plan.
6. Consider a managed provider only for a measured source cohort where it increases correct useful results enough to justify cost and vendor dependency. Recheck current pricing, limits, data handling, and source coverage before committing.

## Pilot results — 2026-10-02

Ran the existing direct validator against two category-appropriate queries per source (`iphone 15 pro` / `samsung galaxy s24` for tech, `bormasina bosch` / `surubelnita bosch` for DIY). Separately, sent controlled HTML and Markdown `Accept` requests to representative search URLs using the direct fetch header profile from Libergent, changing only the `Accept` value.

| Source | Direct result | Markdown negotiation result | Interpretation |
| --- | --- | --- | --- |
| evoMAG | Both requests returned HTTP 200; 24 raw parser candidates per query; zero included listings. | Both returned `text/html`, not `text/markdown`. | Best immediate parser/relevance investigation. Markdown negotiation is not enabled on the observed route. |
| Altex | Both requests returned HTTP 200; zero raw candidates and zero included listings. | Both returned `text/html`, not `text/markdown`. | Investigate rendered/client product data or another first-party search contract. Markdown negotiation is not enabled on the observed route. |
| Leroy Merlin | Both direct-validator queries completed but returned zero raw candidates and zero included listings. | The controlled HTML and Markdown requests both returned HTTP 403 challenge pages; neither returned Markdown. | The controlled probe encountered an access challenge. Direct-validator completion alone did not produce usable listings; investigate supported feeds/permission or leave it unresolved. |

TinyFish Fetch was not run: its REST API requires an `X-API-Key`, and no TinyFish key is configured in the workspace. No parser or provider code was changed for this pilot. The fresh direct report is in `/private/tmp/libergent-pilot-direct.json`; the Markdown probe retained only status, content type, response size, and final URL.

**Pilot conclusion:** none of the probed routes returned `text/markdown`; Markdown negotiation did not improve collection. The next live checks found that evoMAG's current HTML response does not contain query results, while Altex's page loads results from a first-party catalog API. Leroy Merlin's controlled probe encountered a challenge. TinyFish remains unmeasured until credentials are configured.

## Follow-up implementation — 2026-10-09

Altex's public search bundle calls `https://fenrir.altex.ro/v2/catalog/search/{query}?size=48`. The direct HTML page contains no product list, but the first-party JSON response includes product names, prices, SKUs, URL slugs, seller, and image data. Added a direct JSON adapter that maps those fields into Libergent listings and constructs product URLs using the route confirmed by the public product pages. The adapter also requires query modifiers such as `Pro`, `Plus`, `Ultra`, or `Max` to appear in the product title, so the API's looser search matches do not become false positives.

Live CLI smoke results: `iphone 15` returned 13 raw API candidates and 4 included phone listings with prices and resolving product URLs; `iphone 15 pro` returned 13 raw candidates and zero included listings because the returned products were base iPhone 15 models and accessories. The latter is intentional relevance filtering, not an access failure.

For evoMAG, a fresh direct response to `/?searchString=iphone%2015%20pro` had a generic home title, an empty search form value, and no matching query text. A bounded inspection of the page's public frontend scripts did not reveal a usable product-search API route. No evoMAG code change was made; it needs a browser-rendered/authorized route or a first-party integration. Leroy Merlin remains unresolved pending supported access. TinyFish remains unmeasured pending a securely configured API key.

## Definition of recovered

A source is recovered only when a fresh, representative run:

- finds the expected product class and passes the existing relevance filter;
- returns a listing URL on the expected source, a nonempty title, and a positive current payable price;
- binds price, title, availability, and image to the same product card;
- excludes navigation, accessories, unavailable products, crossed-out prices, installments, and promotional text;
- succeeds on at least two category-appropriate queries, with raw/parsed/accepted counts retained;
- has its route and extraction behavior captured by a fixture or repeatable validation command.

Browser-only recoveries additionally record browser engine, challenge status, duration, and price verification. A source with no useful inventory for the sample query is “not demonstrated,” not automatically broken.

## First implementation batch

1. Revalidate the 13 empty-but-completed sources and fix the highest-yield two or three with source-specific fixtures.
2. In parallel through the same workflow, investigate the first-party search contracts for the 20 404 sources; select the next batch based on actual product fit and no challenge/access barrier.
3. Revalidate the 48 currently evidenced sources and refresh the snapshot without erasing older useful evidence.
4. Do not spend the first batch on the 19 challenge sources. First look for supported feeds/APIs and permission details.

When you share your scraping notes, we can map them onto the route discovery, parser, browser eligibility, and operational-cost decisions here and revise the batches around any credentials, providers, or prior experiments you already have.
