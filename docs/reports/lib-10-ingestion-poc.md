# LIB-10 Ingestion PoC (3 marketplaces)

Date: 2026-04-30
Issue: LIB-10
Run command:

```bash
node src/cli.js search --site all --query "iphone 15 pro" --provider auto --pages 1 --limit 12 --out results/lib-10/iphone-15-pro-all.json
```

Raw sample payload:
- `results/lib-10/iphone-15-pro-all.json`

## Target marketplaces and PoC metrics

Selected marketplaces for this proof: `olx.ro`, `vinted.ro`, `publi24.ro`.

- Coverage (`itemCount`):
  - `olx.ro`: 5 listings
  - `vinted.ro`: 5 listings
  - `publi24.ro`: 4 listings
- Error rate:
  - 0/3 failed (`ok=true` for all selected targets)
- Freshness signal (`postedAt` sample from first listing):
  - `olx.ro`: `Reactualizat azi la 12:12`
  - `vinted.ro`: empty in extracted card (freshness field currently inconsistent)
  - `publi24.ro`: `azi 10:57`

Additional non-target observation:
- `okazii.ro` returned `ok=true` but `itemCount=0` for this query, which indicates low recall for at least some terms and needs parser tuning.

## Fallback and parser/provider notes

Current provider behavior in this run:
- All successful targets used `provider=direct` with `strategy=direct-html-local:1-pages`.
- No paid fallback credits were consumed (`creditsUsed=0`).

Fallback policy (current code path):
- Default strategy is direct HTML + local parser per marketplace.
- Remote providers (`firecrawl`, `cloudflare`) are available but not triggered in this PoC.
- Fallback should remain opt-in for parser failure or bot-protection cases only.

Known parser/provider gaps from this PoC:
- `vinted.ro` parser does not consistently surface `postedAt`, weakening freshness scoring.
- `okazii.ro` direct parser has low recall on this query; likely selector drift or query/url nuance.

## Acceptance mapping for LIB-10

- Ingest dataset sample with metrics: complete (coverage/error/freshness captured above).
- Clear parser/provider fallback notes: complete (documented above).

## Next technical action

1. Improve parser recall on `okazii.ro` and add regression fixture for this query family.
2. Normalize freshness extraction on `vinted.ro` so `postedAt` is not empty when present in card metadata.
