# Scraping recovery investigation — 2026-11-11

## Confirmed production failures

Public Free searches for `iphone` and `iphone 15` rejected OLX responses with
`Marketplace response exceeds extraction size limit`. The broader search still
returned 45 included listings; Okazii and Price.ro returned Cloudflare 403 challenges.

The local patch raises the OLX response allowance from 4 to 8 MiB, keeping other
origins at 4 MiB and enforcing the smaller bound after cross-origin redirects.
Regression coverage parses an OLX page over 4 MiB and rejects oversized responses
and lookalike hosts. This is a candidate fix, not confirmed production recovery:
the full production body size is unknown, and a local request to OLX returned 403.
After deployment, repeat both production queries and check actual accepted offers.

## Discovery evidence

The production `/api/sources` catalog contains 117 sources. Its published direct
checks date from September 28 or October 14, 2026; these are historical snapshots,
not a live audit of every source. Among sources with no accepted direct results,
19 have a 404 in their checks and another 19 have blocking/challenge errors
(classifying 404 first). Discovery also considers newer production/browser evidence,
so these counts do not represent its current red badge count.

Many experimental adapters fall back to `/catalogsearch/result/?q=...` regardless
of the actual site's search interface. Browser rendering will not correct that URL.

Bonami was checked live: its homepage publishes a SearchAction for
`https://www.bonami.ro/cautati?q={search_query}`. A request for `canapea` returned
HTTP 200 and about 932 KB of HTML. The current generic parser extracts product
URLs and prices but misidentifies the title as `Compară`. Recovery needs both a
verified search route and correct title extraction; HTTP 200 alone is insufficient.

## Recovery order

1. Validate the OLX bounded-size patch in the Worker environment.
2. Repair actual search routes and parsers for the 404 group, starting with Bonami.
   Verify title, product URL, price and query relevance before updating snapshots.
3. Benchmark JavaScript-dependent sources with existing Cloudflare Kitesurf and
   bounded Chromium recovery. Premium already implements both; Free remains direct.
4. For persistent challenges, pursue supported APIs, merchant feeds or source-side
   allowlisting. Avoid treating repeated browser retries as guaranteed recovery.
5. Re-publish dated, environment-specific validation evidence after each recovery.
   Preserve historical failures until newer tests actually establish useful results.

Cloudflare documents that Browser Run traffic is identified as bot traffic:
https://developers.cloudflare.com/browser-run/faq/

The existing authenticated `/api/admin/browser-benchmark` and
`scripts/benchmark-kitesurf.js` can measure recovery without triggering paid user
searches. No admin token is available in this shell, so no live browser recovery
was claimed or benchmarked during this investigation.

## Bonami repair validated locally

The search route now uses Bonami's published `/cautati?q=...` endpoint. A dedicated
parser reads the main product card's heading and current price, ignoring comparison
control labels, old retail prices and variant links. Unknown layouts remain unknown,
not confirmed empty results.

Two fresh live searches through `runSearch` with `provider: direct`, one page and
a five-result target succeeded from local Node:

| Query | Parsed cards | Eligible results |
| --- | ---: | ---: |
| canapea extensibila | 48 | 5 |
| masa dining | 48 | 5 |

Examples included Canapea Santo at 9,269 Lei and Masă de dining Heaven at 1,333 Lei.
These are observed search-card prices, not checkout verification. The full current
backend suite initially passed 501 tests, including the new Bonami regression tests.
The fix has not been deployed. Updated validation for Discovery is included in the
subsequent recovery batch below.

A signed-in Premium test was not possible in this session: the in-app browser's
Node REPL execution tool is unavailable. No account session or token was extracted
from browser storage. A Premium search report supplied by the user can still be
used to inspect deployed browser recovery without rotating the admin secret.

## Expanded recovery batch

Inspected 15 public homepages from the recorded 404 group and tested six published
search routes. The sanitized [route audit](benchmarks/scraping-route-audit-2026-11-11.json)
records reachability separately from product extraction. Homepage HTTP 200 alone
does not count as a recovered source.

Implemented these additional repairs:

- **MediaGalaxy:** use the public `/v2/catalog/search/` endpoint on
  `cerberus.mediagalaxy.ro`, published by its storefront configuration and JavaScript.
  Reuse the existing catalog parser while preserving MediaGalaxy product URLs and
  seller names, rather than falling back to the Altex seller name.
- **Bricodepot/Bricostore:** follow the observed migration to `bricostore.ro` and
  its public `nix.bricostore.ro` catalog API. Keep the existing registry key so
  callers and saved source selections remain compatible.
- **Thomann:** use the Romanian storefront linked from the German site. Parse
  JSON arguments for the known `search.index` module without executing JavaScript.
  Extract current RON prices, exclude unavailable/archived products, keep B-stock
  condition distinct, and ignore recommendation arrays.
- Register the specific `thomann.ro` and `bricostore.ro` listing domains for detail
  enrichment. Tests reject hostname lookalikes.

The reproducible [ten-case benchmark](benchmarks/scraping-recovery-2026-11-11.json)
completed with **eight searches returning listings**, one returning no accepted
listings, and one returning a Cloudflare 429 challenge. The successful cases yielded
102 listings across cases (not deduplicated across different queries). Prices are
observed source prices; no checkout price or precision-at-10 labels were supplied.

| Source | Product queries returning listings |
| --- | --- |
| Bonami | canapea extensibila; masa dining |
| MediaGalaxy | iphone 16; samsung galaxy s26 |
| Bricostore | bormasina bosch; surubelnita bosch |
| Thomann | yamaha p-45; fender stratocaster |

Thomann remains partial: `chitara electrica` returned no accepted listings; an
earlier `yamaha p45` response parsed products but failed model-token relevance,
and the final benchmark encountered a Cloudflare 429 for that query. No further
Thomann requests were attempted after the 429. These limitations are retained in
the updated direct-validation snapshot; no browser recovery or production health
is claimed. The snapshot changes will reach Discovery only with deployment.

The other investigated sources remain unresolved: JD Sports' published search
returned 500; Micul Meșter's published SearchAction returned 404; Sephora's homepage
returned 403; Ferex and Zeedo's published search pages yielded no recognized product
cards; Unix Auto returned a JavaScript-dependent page. Other sites still require
site-specific route/parser work. These were not marked healthy or silently removed.

Validation: the current backend suite passed **512 tests**; the two source-catalog
tests also passed after refreshing the four dated snapshots. All changes remain
local and have not been deployed.

Reproduce the direct benchmark without an admin token:

```sh
node scripts/benchmark-scraping.js --local --cases scripts/scrape-recovery-cases.json --out /tmp/scrape-recovery.json
```
