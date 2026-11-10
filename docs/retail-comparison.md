# New, refurbished and used comparison

The search dashboard now places “De unde merită să cumperi?” below the recommended offer. Three responsive columns show the cheapest comparable new, refurbished and used offers returned by the current search. Each opens the existing offer inspection panel.

The reference is the visible recommendation, otherwise a visible used offer, otherwise the first visible result. Alternatives respect source exclusions and rejected offers; condition and budget filters do not remove price references. The panel is hidden during loading and for vehicle searches, whose comparability requires mileage, year and other attributes.

Prices use the existing RON normalization. Identity uses the existing conservative title matcher (phone model, variant and capacity; exact normalized titles for other supported identities). Accessories, broken products and invalid prices are excluded. Refurbished offers are separate; open-box stock is excluded rather than presented as new or refurbished. Missing matches never produce a savings claim. The panel describes observed asking prices, not completed transactions or a market-wide minimum.

## Next validation milestone

1. Recheck Altex and eMAG in the production runtime for a small electronics query set, alongside OLX, Flip and Klap. Record accepted matching offers, timestamps and failures; historical source checks are not current availability evidence.
2. Validate ten exact phone variants, including model suffixes and storage. Include cases where retail is cheaper, only one condition is available, and accessories appear in search results.
3. Add structured model identifiers and per-offer fetch timestamps before broadening matching to laptops, consoles and other categories. A query-level product key does not establish item identity.
4. Add delivery cost, warranty and battery/condition details only when explicitly supplied by the listing. Do not infer a warranty from a store name.
5. Visually verify desktop/mobile layout and inspection actions in the results dashboard before release. This iteration does not add retailer integrations or change search billing.

Regression coverage: `npm run test:ui-data` includes comparison minima, duplicate handling, variant mismatch, invalid prices, condition separation and negative savings.
