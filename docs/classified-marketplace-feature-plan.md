# Used + New Product Search Feature Plan

Libergent should find real Romanian second-hand listings and compare them against reliable new-product price benchmarks. The product should filter weak matches, avoid duplicate retail benchmarks, compare used price versus new price, and help the buyer contact second-hand sellers quickly.

## Product Focus

- Primary niche: Romanian products with both second-hand availability and new-price comparables.
- Active used sources: OLX, Vinted, Lajumate, Okazii, Publi24, Anuntul, and Autovit for car-like searches.
- Active new benchmark sources: Price.ro, ShopMania, and CEL.ro.
- Keep used listings and new benchmarks visually and analytically separate.
- Treat blocked sources such as eMAG, Compari, Altex, and Flanco as future integration work until they return reliable results.

## Keyword Focus

- Keep keyword matching visible in the UI so users understand why a result ranks highly.
- Prefer title and product-identity matches over vague description matches.
- Penalize accessories, spare parts, wanted ads, services, broken products, and unrelated variants when the user searched for a main product.
- Add query-specific smoke tests before expanding a niche, for example phones, sneakers, fashion, furniture, or cars.

## Search By Picture

Target flow:

1. User uploads a product photo.
2. Backend extracts structured search intent:
   - product type
   - brand
   - model
   - color/material
   - visible variant details
   - confidence score
3. Convert that intent into a normal text query.
4. Run the existing `/api/search` pipeline.
5. Show the generated keywords and allow the user to edit them before rerunning search.

Implementation requirements:

- Add `POST /api/image-search` for image upload.
- Store no image by default; process in-memory unless explicit retention is added.
- Enforce file size and MIME limits.
- Use a vision model or image embedding provider to produce the text query.
- Reuse the existing marketplace search pipeline after query extraction.

## Seller Messaging

Current lightweight implementation:

- Search result cards generate a Romanian seller-message draft.
- User can copy the message and open the original listing/contact page.

Future direct messaging:

- Direct in-Libergent sending should only be added where a marketplace offers a compliant API, partner flow, email relay, or explicit seller contact mechanism.
- Do not automate marketplace accounts, bypass login, or send messages through scraped private endpoints.
- Track copied-message and opened-contact events so we can measure buyer intent before building deeper integrations.

## Next Implementation Order

1. Harden keyword scoring and add tests for the chosen product niche.
2. Keep used/new medians and savings-versus-new visible in search results.
3. Add event tracking for `copy_seller_message`, `open_seller_contact`, and retail benchmark opens.
4. Add image upload endpoint that returns editable extracted keywords.
5. Connect image search to the existing search page.
6. Investigate compliant seller-contact integrations per marketplace.
