# LIB-20 QA Smoke Suite - MVP Search Integration

Date: 2026-04-30
Owner: CTO
Issue: LIB-20

## Scope
Smallest viable smoke suite to validate that MVP search integration remains releasable:
- ingestion orchestrator test coverage baseline passes
- CLI search flow returns aggregated marketplace payload
- HTTP API `/api/search` returns successful search payload

## Commands Run

```bash
npm test
node src/cli.js search --site all --query "iphone 15 pro" --provider auto --limit 5 --pages 1 --pretty
node src/server.js   # local server smoke
curl "http://127.0.0.1:8787/api/search?q=iphone%2015%20pro&site=all&provider=auto&limit=5&pages=1"
```

## Results

1. `npm test` -> PASS
- 3/3 tests passed
- 0 failed

2. CLI marketplace search smoke -> PASS
- Command returned aggregated report successfully
- `Marketplaces: 5/5 succeeded`
- Result set contained valid ranked offers for `olx.ro`

3. HTTP API search smoke -> PASS
- `/api/search` returned JSON payload with `results` and successful marketplace response objects
- At least one marketplace (`olx.ro`) returned valid listing entries

## Release Gate
PASS for MVP smoke gate based on defined minimum checks above.

## Residual Risk
- Search/parsing behavior is network- and marketplace-markup-dependent; this smoke run confirms current behavior at execution time only.
- No dedicated regression test currently validates end-to-end ranking behavior across all supported marketplaces deterministically.

## Next Action
If stricter pre-release confidence is needed, add a deterministic fixture-driven parser smoke test per marketplace and run it in CI.
