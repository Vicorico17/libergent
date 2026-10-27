# FAU / BLANĂ GitHub-agent handoff

Implement a server-side Libergent catalog integration in the existing BLANĂ site at `blana.vercel.app`. Preserve its design, French/English UI, favorites and original seller-photo galleries. Do not contact sellers or implement checkout.

## Connection

Use the production Cloudflare domain for the integration:

```text
LIBERGENT_API_ORIGIN=https://libergent.com
LIBERGENT_API_KEY=<supply privately through the deployment's server environment>
```

Do not request the key in chat, put it in tool/model arguments, commit it, expose it in static JS, or prefix it with `NEXT_PUBLIC_`. The owner has the credential separately. The initial BLANĂ key is restricted to read-only OLX search/detail access, 10 requests/minute and 100/day; it expires November 3, 2026. The API can be tested until that expiry, after which the key must be rotated through operator provisioning. Self-service key creation requires the separate Supabase migration and enablement described in `developer-api.md`.

Use the REST API for the website. A direct request from the website's server is:

```bash
curl --fail-with-body --get "$LIBERGENT_API_ORIGIN/api/v1/search" \
  -H "Authorization: Bearer $LIBERGENT_API_KEY" \
  --data-urlencode 'q=haina blana' \
  --data-urlencode 'sites=olx.ro' \
  --data-urlencode 'category=full_fur_coat' \
  --data-urlencode 'material=natural' \
  --data-urlencode 'details=true' \
  --data-urlencode 'limit=20'
```

The owner can provide a test key later if fixtures are needed. The public `/api/v1/demo` requires no key but returns simulated data, not sellable listings.

## Implementation

1. Add a same-origin server endpoint such as `GET /api/catalog`. Start from [the Vercel Node Function example](../examples/blana/api/catalog.mjs). For another framework, adapt the server handler without moving credentials into the frontend. Configure a 40-second function limit and a 35-second upstream timeout.
2. Keep the query and filters above server-owned; do not proxy arbitrary client URLs, providers, or credentials. Cache the public catalog response at the server/CDN for no longer than the API's `expiresAt` (up to 15 minutes). Partial responses should have shorter cache life; failures should not be cached as an empty successful catalog.
3. Replace the current hardcoded `coats` catalog in `app.js` with data loaded from `/api/catalog`. The inspected live site is a plain HTML/JS frontend using `app.js`, `translations.js` and `galleries.js`; verify against the actual repository before editing.
4. Map the returned `items` into the existing view model. Use the listing URL as a stable identity (or hash it); use `title` as the source title, `mainImage.url` for the card, and original `galleryImages[].url` for the gallery. Carry `sourceUrl`/provenance with every image. Missing main images need a text placeholder, never a generated product photo.
5. Keep `price` and `currency` together. `price` may be numeric, source text, or null; only sort numerically when a defensible numeric price is available. Do not hardcode RON for every response or present null as zero.
6. Show `size`, `measurements`, `condition`, `location`, `description` and material only when supplied, with an explicit unknown state otherwise. Keep the original Romanian listing title/description or translate faithfully without inventing attributes. Editorial headings must not become claims about an individual product.
7. Display `searchedAt`, `lastVerifiedAt`, cache/freshness and availability honestly. Hide `removed` listings. `unknown` means confirm availability, not active. Do not label an item unavailable just because it was absent from a later search.
8. Use `classification.evidence` to explain filtering. Natural fur, species, age and condition remain seller claims. Do not infer authenticity, vintage age or premium quality from photos. The existing `localized()` function currently defaults non-mink types to fox and every condition to “good”; remove these assumptions when accepting dynamic data. Existing hardcoded `galleries[p.id]` lookup must also handle new listing IDs safely.
9. Render external text through escaped templates/text nodes. Never insert raw seller content with unescaped `innerHTML`. Validate outgoing listing/image URLs and use safe external-link attributes.
10. Preserve language selection and favorites; reconcile favorites by stable listing identity. Add loading, partial-data, no-results, rate-limited and upstream-unavailable states. Do not silently show the three old hardcoded items as though they were fresh API results.

## Response and tests

The complete schema is published at `/api/v1/openapi.json`; supported sources are at `/api/v1/sources`. Inspect `mode`, `partial`, `sources`, `items`, `cache`, `searchedAt`, and `expiresAt`. See [the listing contract](storefront-integration-v1.md).

Verify that no key is present in built JS or browser network requests; the browser should call only `/api/catalog`. Test first load and cached reload, missing fields/gallery, partial errors, zero matching coats, 429 with Retry-After, 502/503, removed/unknown availability, French/English labels, and favorites with dynamically loaded IDs. Test with the real preview only a few times; cache hits also consume API request quota.

For an AI agent that needs to call Libergent directly, `/api/v1/mcp` uses the same key through the connection's Authorization header. Tools: `search_products` and `list_sources`. Do not use the legacy `/mcp` path. See [agent setup](agent-integrations.md). The website integration itself should use REST.

Ship changes on a feature branch and a preview deployment first. Do not change BLANĂ production or its domain until the owner approves the reviewed result.

## Verified preview acceptance — October 27, 2026

The exact live REST request above returned HTTP 200 with 6 matching listings from 19 OLX candidates, `partial: false`, and original photos (the first two listings had 4 and 7 photos). A repeat request returned the same 6 listings with `cache.status: "hit"`. Unauthenticated search returned 401. The legacy `/mcp` path returned 404. This verifies access, filtering/enrichment and cache reuse for that request; it is not independent verification of material or seller claims. Marketplace results can change.

The authenticated preview MCP also successfully initialized, advertised `search_products` and `list_sources`, and returned only the allowed `olx.ro` source. The full backend suite passed 355 tests after adding the isolated preview route.
