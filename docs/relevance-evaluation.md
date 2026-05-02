# Relevance Evaluation Harness

This harness provides deterministic top-k relevance checks for ranking v1 and writes reproducible baseline artifacts.

## Versioned Inputs

- Seed queries: `data/relevance/seed-queries.json`
- Judgments: `data/relevance/judgments.mock.json`

## Run

```bash
npm run eval:relevance
```

Outputs are written to `results/relevance/`:
- `baseline-YYYY-MM-DD.json` (metrics artifact)
- `baseline-YYYY-MM-DD.md` (human-readable report)

## Metrics

- Precision@K per site and per query
- Average precision@K across query set
- Unsafe promotions count (high relevance score despite rejection reasons)
- Site coverage per query

## Gate

Targets are configured in `data/relevance/seed-queries.json` and evaluated as PASS/FAIL in the baseline report.
