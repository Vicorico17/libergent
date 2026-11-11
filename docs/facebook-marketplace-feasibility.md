# Facebook Marketplace feasibility evidence

Date: 2026-11-11. Phase 1 is incomplete. Decision: do not enable Facebook in production search yet.

The user requested Cloudflare as the first runtime. The existing Wrangler OAuth login has browser access, and a development-only Worker successfully launched both browser engines through the remote `BROWSER` binding. No Browserbase account is required for these tests.

Search tested: `iphone 15`, candidate location route `/marketplace/bucharest/search/`. This is not a verified canonical București route.

| UTC time | Engine | Observed page | HTTP status | Total elapsed | Listings | Cleanup |
| --- | --- | --- | --- | --- | --- | --- |
| 10:31:55 | Chromium | Redirect to `/login/` | 200 | 4,540 ms | 0 | completed |
| 10:32:27 | Kitesurf | Redirect to `/login/` | 400 | 8,291 ms | 0 | completed |

The first Chromium report labeled the login redirect `access_challenge`; the classifier has since been corrected to `login_required`. Earlier development probes exposed a serialization bug in the diagnostic, fixed before these observations, plus one failed browser launch. They are not evidence about Marketplace availability. A development reload interrupted one request; avoid hot reload during a running browser test.

These results establish working Cloudflare browser access and Facebook's login redirect for this query/route from those sessions. They do not establish the reason for the redirect, a correct city mapping, Romanian inventory coverage, or that all anonymous Cloudflare searches fail. No listing schema was validated against live Facebook data.

Next steps:

1. Verify the canonical București search route in a user-accessible Facebook session.
2. Establish a supported user-authorized session mechanism for Cloudflare if login is required. Keep credentials out of chat, source control and diagnostics. The current runner does not support connecting a Facebook account.
3. Repeat one search through that supported access path before expanding to the 18-search city/query matrix.
4. Measure provider usage/cost; elapsed time alone is not a billing measurement.

The local test page is ready: see [testing instructions](facebook-marketplace-testing.md). Ten focused automated tests pass, covering synthetic parser fixtures, errors, cleanup and endpoint guards. Production routing, paid entitlement integration, alerts and Muse connector work remain unimplemented.
