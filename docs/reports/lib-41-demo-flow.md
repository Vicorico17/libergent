# LIB-41 Demo Flow

Goal: prove the search query flow emits latency/error instrumentation and returns expected UI API behavior.

## Setup

1. In one terminal, start the local API:
   `npm run dev`
2. In another terminal, run a happy-path request:
   `curl "http://127.0.0.1:8787/api/search?q=iphone%2015%20pro&site=all&provider=auto&limit=5&pages=1"`
3. Confirm API response includes `summary` and non-empty `results` array.
4. Confirm server logs include a `search_latency` event with `outcome: "success"` and `durationMs`.

## Error-path signal

1. Stop network access temporarily or force a provider/site failure scenario.
2. Run:
   `curl "http://127.0.0.1:8787/api/search/scored?q=test&site=unknown"`
   or another request that triggers a 500 from search execution.
3. Confirm API returns a JSON error payload.
4. Confirm logs include `search_error` with `outcome: "error"`, `durationMs`, and `error` message.

Expected UI/API behavior: query requests continue to produce normal JSON payloads while telemetry logs capture success-latency and error signals for each search route.
