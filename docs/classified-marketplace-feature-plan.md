# Classified Marketplace Feature Plan

Libergent should focus on classified marketplace search first. The product should be excellent at finding real Romanian listings, filtering weak matches, comparing prices, and helping the buyer contact the seller quickly.

## Product Focus

- Primary niche: Romanian classified listings for second-hand and local-market products.
- Active sources: OLX, Vinted, Lajumate, Okazii, Publi24, Anuntul, and Autovit for car-like searches.
- Avoid broad retail comparison as the main product until classified search quality is consistently strong.
- Treat eMAG, Compari, Flip, or retailer data as optional benchmark context, not the core result list.

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

1. Harden keyword scoring and add tests for the chosen classified niche.
2. Add event tracking for `copy_seller_message` and `open_seller_contact`.
3. Add image upload endpoint that returns editable extracted keywords.
4. Connect image search to the existing search page.
5. Investigate compliant seller-contact integrations per marketplace.
