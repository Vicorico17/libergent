# Facebook Marketplace: immediate Cloudflare testing

The first implementation is a development-only diagnostic page backed by a real Cloudflare Browser Run binding. It does not register Facebook in production search. No Browserbase key is needed for this route.

## Start

Use Node 22+, the installed project dependencies and a Wrangler login with browser access:

```sh
npx wrangler dev --config wrangler.facebook-diagnostic.toml
```

Open http://127.0.0.1:8791. Enter a query and a candidate Facebook location slug or ID, then click **Run Cloudflare test**. The default `bucharest` value is a candidate, not a validated Romanian city mapping. The page offers Chromium and Kitesurf. Each click consumes real browser quota; one request runs at a time.

The runner uses a separate config with only a remote browser binding. It does not deploy a Worker, load production application routes, or change Free search. Do not deploy this diagnostic: it refuses public hostnames and is intended for local testing only.

Each test opens one search page, checks for visible login/consent/challenge dialogs, parses structured search payloads, and closes its browser. It does not click consent buttons, sign in, paginate or contact sellers. The report contains observed listing fields only; raw page state and credentials are not returned or persisted.

## Interpret results

| Status | Meaning / next action |
| --- | --- |
| `extracted_unverified_location` | Cards extracted; manually confirm the selected city/filter on Facebook before counting this as a successful search. |
| `empty_unverified` | A feed was found with no usable records. This is not proof of an empty marketplace. |
| `unrecognized_payload` | The expected structured feed is absent. Investigate current page structure before adding parser assumptions. |
| `location_resolution_failed` | Facebook changed the requested location route. Resolve the actual city route before retrying. |
| `login_required`, `consent_required`, `access_challenge` | Access needs user interaction. The runner stops rather than proceeding. |
| `rate_limited` | Wait for browser capacity/quota recovery; do not repeatedly click Run. |
| `browser_launch_failed`, `provider_access_denied` | Browser session could not start; check Cloudflare account permissions/capacity. |
| `browser_command_failed`, `timeout` | Check `failedStage` and the sanitized network error code. |

`cleanup: completed` means browser close succeeded. A failed cleanup may leave a remote session until its expiry. Avoid editing runner code during an active request: Wrangler reload can interrupt cleanup. No latency or operating-cost acceptance is claimed by this diagnostic.

## Tests

```sh
node --test src/facebook-diagnostic.test.js src/facebook-cloudflare-diagnostic.test.js
```

Tests cover JSON normalization, missing fields, location/access rejection, cleanup, and local endpoint guards. Fixtures are synthetic; they do not prove Facebook's live schema.

An optional Browse CLI runner also exists:

```sh
node scripts/check-facebook.js --location bucharest --mode local
node scripts/check-facebook.js --location bucharest --mode remote
```

Remote Browse mode requires `BROWSERBASE_API_KEY` in `.env.local` and Verified/proxy account access. It is not needed for Cloudflare testing.
