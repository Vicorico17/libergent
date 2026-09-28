# Discovery source audit — 2026-09-28

All 117 registered sources received two category-appropriate direct search checks. The 12 Free sources were also checked through three production Worker searches (`iphone 15 pro`, `samsung galaxy s24`, and `bmw x5`). These are point-in-time checks, not uptime monitoring. A source without accepted offers may still have inventory for other queries.

| Latest useful-result evidence | Sources |
| --- | ---: |
| Direct test returned accepted offers | 36 |
| Production Free search only (OLX) | 1 |
| No accepted offers, requests completed | 19 |
| No accepted offers, requests failed | 61 |
| Total | 117 |

After this direct audit, local Cloudflare Browser Run checks recovered JYSK, IKEA, F64, and Bookzone. Their search-card prices were checked against representative product pages after the three incorrect parsers were repaired. Seven further direct search recoveries bring Discovery to 48 green and 69 red sources. The four browser recoveries remain labeled as browser evidence. The table above remains the original direct/production baseline.

The 62 sources without useful direct responses split into 24 with a 404 search URL, 20 with a 403/429 or challenge, nine with a soft error page or lost search redirect, eight with a network or other HTTP failure, and one that timed out after 15 seconds. OLX is in the local 403 group but returned offers through the production Worker, so Discovery shows 61 red failures. The source checks now recognize maintenance pages, parked domains, explicit error pages, search redirects to home pages, and redirects to another retailer instead of treating their HTTP 200 responses as empty searches. The longer validation timeout avoids classifying a merely slow response as a failure at eight seconds.

This audit repaired and rechecked:

- ForIT: official `/cauta/?q=` search route and a parser for its product metadata; 15 and 9 accepted SSD offers.
- Dedeman: `/ro/catalogsearch/result/v2?q=`; three accepted offers on the second tool query.
- SoundCreation: `/search.html?queryString=`; five and four accepted offers.
- Zooplus: `/search/results?q=` and product-card parser; 20 accepted offers on each pet-food query.
- ePiesa: `/cautare-piesa/?q=`; two accepted offers on the first parts query.
- Petmax: `/produse?c=`; three and ten accepted pet-food offers.
- Animax: `/search?q=`; one accepted pet-food offer on the second query.
- Regatul Jocurilor: `/ro/cautare?search_query=` and a parser restricted to product cards; 19 LEGO offers on the second query. The generic parser had incorrectly counted category links as offers.
- Sport Vision: `/produse?search=`; nine accepted sport products on the second query.
- JYSK: corrected `/search?query=` route; both checks completed but still returned no accepted offers.
- The Home: `/catalog?q=` and a product-card parser that keeps each item's price and image together; 20 and 19 accepted furniture offers.
- Buzz Sneakers: `/produse?search=`; four and three accepted fashion offers.
- Sneaker Industry: Shopify `/search?q=`; two and three accepted fashion offers.
- ePetShop: `/produse?c=`; 19 accepted pet-food offers on the second query.
- PetGuru: Shopify `/search?q=`; one and ten accepted pet-food offers.
- Red Goblin: Shopify `/search?q=` and a parser restricted to product cards with their current prices; 20 and 19 accepted offers.
- Senia: `/cautare?search_query=`; two accepted music offers on the first query.
- Modlet: `/catalog?q=` with store-appropriate validation queries; 16 and 15 accepted fashion offers.
- Nemira: a parser for book cards and final prices; 12 accepted Dune offers.
- PhotoSetup: Shopify `/search?q=` with a product-card parser; seven and 16 accepted camera offers.
- Libris: `/search?iv.q=` with a book-card parser; 12 and 13 accepted book offers.
- M&C Music: `/cautare?s=` with a product-card parser; 20 accepted offers on each music query.
- CEL: a parser for its product cards, tested with products the store actually carries; 13 accepted SSD offers and 12 accepted laptops. The original phone queries mostly returned accessories, so they were not useful availability checks.

The corrected search forms for Bookzone, AutoHut, and Mezoni respond but did not yield accepted offers in the representative direct queries. Other red sources remain red until a relevant product with a trustworthy price is extracted. The direct audit did not use an authenticated scraping provider; a later local Cloudflare Browser Run check used the Worker's `BROWSER` binding.

## Further direct search recoveries

Seven sources now return accepted product cards through corrected search routes. Fashion Days returned 19 and 19 fashion offers; Footshop 20 and 18; Mobexpert 20 and four furniture offers; MAKEUP one perfume offer; PlayBike seven bicycles; Kondela 20 and 20 furniture offers; and ITGalaxy two and two matching laptop/phone offers. These checks use the same direct provider and relevance filter as the original audit. Footshop, Mobexpert, MAKEUP, Fashion Days, and PlayBike have source-specific parsers for their current listing formats. The PlayBike price and a Mobexpert price were also matched against their product pages; Kondela search and product JSON-LD agree for a sampled sofa. The remaining source statuses are point-in-time observations.

## Browser recovery check

The Premium Worker tries Kitesurf after a failed or empty direct search. A bounded Chromium pass handles selected remaining sources. Local Browser Run worked without a Cloudflare account login via `wrangler dev --local`. The protected benchmark endpoint and `scripts/benchmark-kitesurf.js --state=red` were used to inspect failed Discovery sources. The current account has no configured Cloudflare API credentials, so these browser findings are local and are not a production Worker smoke test.

All 80 sources that were red before the browser check received a local Kitesurf probe. Four returned candidate offers; 30 showed a challenge, 34 rendered without accepted offers, and 12 failed to navigate. The four candidates now have usable, price-checked browser results. JYSK returned 14 accepted sofas; IKEA returned 18 sofas using each card's `data-price`; F64 returned one camera using its JSON-LD offer; Bookzone returned 17 products using each card's current price and excluding unavailable items. Shopmania rendered items but had no offers accepted after relevance and listing-quality filters. Chromium found no usable offers in a comparison run for Mobexpert, ABOUT YOU, and Leroy Merlin, and also encountered challenges on Okazii and PC Garage.

In the 19-source batch of direct 403/challenge failures, Kitesurf still encountered 18 challenge pages; Thomann rendered without accepted offers. Browser rendering is useful for JavaScript-loaded inventory, but it did not resolve the observed site challenges or broken search routes. The remaining sources retain their red status and observed error evidence.

## Remaining red sources by observed cause

| Cause | Sources |
| --- | --- |
| 403/429 or challenge (19) | okazii.ro, price.ro, compari.ro, pcgarage.ro, flanco.ro, vexio.ro, avstore.ro, xxxlutz.ro, mathaus.ro, arabesque.ro, decathlon.ro, sportisimo.ro, thomann.de, carturesti.ro, noriel.ro, notino.ro, drmax.ro, helpnet.ro, elefant.ro |
| Completed without accepted offers (14) | shopmania.ro, evomag.ro, altex.ro, aboutyou.ro, mezoni.ro, leroymerlin.ro, hornbach.ro, ambient.ro, scule.ro, intersport.ro, 4fstore.ro, sportano.ro, autohut.ro, automag.ro |
| 404 search URL (18) | mediagalaxy.ro, deichmann.com, jdsports.ro, fashionhouse.ro, bonami.ro, bricodepot.ro, ferex.ro, miculmester.ro, bike24.ro, zeedo.ro, pravaliacucarti.ro, autokarma.ro, unixauto.ro, nichiduta.ro, douglas.ro, sephora.ro, esteto.ro, farmec.ro |
| Soft error page or redirect (9) | a2t.ro, answear.ro, ccc.eu, hervis.ro, musicshop.ro, librarie.net, autodoc.ro, pieseauto.ro, bebetei.ro |
| Network or other HTTP failure (8) | badabum.ro, sizeer.ro, dormeo.ro, egradini.ro, tenis-shop.ro, okian.ro, roata.ro, bricksdepot.ro |
| Timeout (1) | somproduct.ro |

OLX has a local 403, but production Worker searches returned accepted offers, so it is green in Discovery and excluded from the red list. IKEA, JYSK, F64, and Bookzone completed direct searches without accepted offers but are green on reviewed browser evidence.

The current evidence is checked into `src/source-validation-snapshot.js` and served by `/api/sources`. The Discovery page colors rows from the newest applicable check: green for accepted offers, red for failed or empty checks, gray for untested sources. It shows the check count, date, and failure reason. Production Free evidence takes precedence over a same-day local check because the Worker may have different source access.

To repeat the audit:

```bash
LIBERGENT_MOCK_SEARCH=0 LIBERGENT_MOCK_PROVIDER=0 node src/cli.js validate-shops --provider direct --limit 20 --out /tmp/libergent-source-validation.json
node scripts/refresh-source-validation-snapshot.js /tmp/libergent-source-validation.json
```

The refresh script requires a complete 117-source report. Production Free response JSON files can be passed as additional arguments. Pass `--update-report=/path/to/partial-validation.json` for each later direct recheck. To publish a browser recovery, pass `--browser-report=/path/to/benchmark.json --browser-verified=site.example` after checking product relevance and prices against the source pages. This keeps the direct result intact and labels the browser evidence separately. Review relevance and prices before promoting an experimental source to normal search routing.
