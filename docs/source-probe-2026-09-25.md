# Local direct-source probe — September 25, 2026

Evidence: [raw validation report](source-probe-2026-09-25.json), checked at `2026-09-25T08:07:20.663Z`.

Two queries per source (`iphone 15 pro`, `samsung galaxy s24`), direct Node fetch, one page, limit 20, eight-second timeout per query. Accepted counts are after aggregation/relevance filtering; prices and seller availability were not manually verified. These are local-network results, not deployed Worker results.

| Source | iPhone accepted | Samsung accepted | Observation |
| --- | ---: | ---: | --- |
| OLX | 0 | 0 | HTTP 403 for both direct requests |
| Vinted | 1 | 9 | 96 raw cards per query |
| Flip | 1 | 0 | 32 raw catalog products per query; limited catalog coverage |
| Klap | 2 | 1 | 15 / 8 raw cards |
| eMAG | 0 | 0 | 20 raw cards per query; investigate relevance/routes |
| evoMAG | 0 | 0 | 20 raw cards per query; investigate relevance/routes |

The first sandboxed attempt failed to connect to every source. The table above comes from the subsequent permitted network run; sandbox connectivity failures are not source-health evidence. No source status was promoted or demoted from this bounded probe. The report's candidate/fix verdicts are triage hints, not deployment decisions.

## Follow-up inspection

The evoMAG `?searchString=` URL returned homepage promotions. Its own page script uses `/produse/filtru/cautare:<query>`; the adapter now follows that route and limits extraction to the search-result section. Public requests for `samsung galaxy s24` and `s24` returned HTTP 200 with empty results. This fixes misleading inventory, not the source's limited search coverage.

An eMAG Samsung Galaxy S24 card was rejected because its title starts with `Telefon mobil`, which was absent from the phone-intent prefix rule. That rule has been corrected. The baseline counts above predate both fixes; no improved acceptance count or production availability is claimed.
