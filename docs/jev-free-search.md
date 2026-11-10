# JEV in free search

## Scope and implementation

Free search uses the existing JEV selector after aggregation and before history
persistence and response caching. Both `/api/search` and `/api/search/free` use
this path in the Worker and local Node API. The local API has no response cache.
Premium retains its existing configuration and selector behavior.

The selector chooses `bestUsedOffer` and `bestNewBenchmark`; it does not reorder
all results. Existing eligibility rules remain: valid price and URL, recommended
candidate, no severe risk flag, URL deduplication, marketplace diversity, at most
12 candidates per category, and at least two candidates to ask a question. Used
offers respect the budget; new offers remain comparison benchmarks. Decisions
require a known choice and confidence from 0.55 through 1. A failed request or
invalid decision preserves the scored picks. The provider timeout is 2.8 seconds.

Free and Premium share `JEV_API_KEY`, but use independent switches and model IDs:

| Setting | Default | Purpose |
| --- | --- | --- |
| `FREE_JEV_ENABLED` | `1` | Set to `0` to disable free-search decisions |
| `FREE_JEV_MODEL` | `jev-latest` | Model for free searches |
| `PREMIUM_JEV_ENABLED` | `1` | Existing Premium switch |
| `PREMIUM_JEV_MODEL` | `jev-latest` | Existing Premium model |

The isolated MCP test environment explicitly disables free JEV. No JEV call was
added to discovery probes, scheduled alerts, or integration search handlers.

Free response cache keys include enablement, model, and whether a key is present
(never the key itself). Changing these settings bypasses prior configurations'
snapshots. Complete results cache for five minutes and partial results for one
minute. Explicit refresh bypasses the cache. Cache hits preserve decision metadata
but cause no new provider call or usage log. Existing UI offer badges and the JEV
status panel now work for free searches too.

## Usage measurement

Each actual provider attempt emits a JSON `jev_usage` event containing `tier`,
`status`, `model`, `selections`, `inputTokens`, and `durationMs`. No query, listing
content, credentials, or user identifiers are included. Skipped decisions and
cache hits emit no event. Low-confidence responses still report consumed tokens.
Failures without a usage response report null tokens: unknown, not zero.

Worker application logs are enabled at sampling rate 1; automatic invocation logs
are disabled. In Worker logs, filter for `event = jev_usage` and group by `tier`:
count attempts and statuses, sum known input tokens, and review duration percentiles.
These logs support operational monitoring, not a permanent billing ledger; retention,
log limits, and requests that failed before reporting tokens limit reconciliation.
Use TypeSafe billing as the authoritative total. Search `creditsUsed` is unchanged
and does not measure JEV spending or consume a user's search-credit balance.

At the published November 10, 2026 rate, estimated inference USD equals known input
tokens / 1,000,000 * 0.042. This excludes Worker/logging charges and unknown usage.
Source: https://help.typesafe.ai/articles/5187202169-how-much-does-jev-cost

## Validation and rollout

Automated coverage checks free-tier independence, missing credentials, insufficient
candidates, confidence/choice rejection, provider failures, usage logging, successful
selection, cache reuse, refresh, configuration changes, and the legacy route alias.
Existing tests cover condition separation, budget restrictions, and savings updates.

After deployment, verify an eligible uncached free search reports a JEV outcome,
a repeated search reports `cacheHit: true` without another usage event, and the
selected-offer badge appears. Review actual tokens and response duration before
changing candidate counts or timeouts. Check selection quality on representative
product queries; a successful API response alone does not establish quality.

Rollback: set `FREE_JEV_ENABLED=0` and deploy the configuration. Free cache keys
change automatically. Premium stays enabled independently. Existing public search
rate limits remain in place; they are not a global JEV spending cap.
