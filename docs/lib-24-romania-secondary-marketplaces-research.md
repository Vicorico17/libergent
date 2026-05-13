# LIB-24: Romanian Secondary Marketplace Research (Romania-first)

Date: 2026-05-13  
Owner: CMO  
Goal tie-in: Improve Romania-first coverage and positioning for Libergent's secondary-market search.

## Executive Takeaway

Romania's secondary-market search opportunity is concentrated in a few high-liquidity destinations with different supply structures: broad classifieds (OLX, Publi24, Lajumate), vertical auto marketplace depth (Autovit), catalog-style marketplace supply (Okazii), and app-led fashion C2C behavior (Vinted).

Priority for Libergent: maintain OLX as anchor source, then maximize breadth and freshness across Publi24 + Lajumate, while preserving vertical quality for Autovit and catalog compatibility for Okazii.

## Ranked Marketplaces (Decision Order)

### 1) OLX Romania (`olx.ro`) — Highest priority

- Why it matters to Libergent:
  - Broad consumer intent across major secondary categories (auto, real estate, electronics, services, jobs), making it the highest-leverage index source.
  - Strong baseline for cross-market comparison because many users start here, then cross-check alternatives.
- Evidence of popularity/liquidity:
  - OLX homepage claims "Peste 4 milioane anunturi" (over 4 million listings).
  - Category breadth on homepage spans key Romania-wide secondary verticals.
- Marketplace type:
  - Generalist classifieds marketplace.
- Trust/safety and discovery notes:
  - Discovery is search + category + location first; local matching remains central.
  - At this scale, duplicate/suspicious listing handling is a core quality risk for aggregators.
- Confidence: High (primary platform source with explicit scale claim).

### 2) Publi24 (`publi24.ro`) — High priority

- Why it matters to Libergent:
  - Broad national classifieds coverage and strong local inventory footprint beyond Bucharest.
  - Useful for recall gains where OLX coverage is thinner in specific cities/niches.
- Evidence of popularity/liquidity:
  - Publi24 states nationwide classifieds focus including major verticals (cars, property, electronics).
  - Category/county filters surface large visible listing bases (e.g., high five-digit counts in major counties on category pages).
- Marketplace type:
  - Generalist classifieds marketplace.
- Trust/safety and discovery notes:
  - Discovery behavior is strongly geo-filtered by county/city, which fits Romania local-buy patterns.
  - Alert/watch behavior appears emphasized in UX (saved search + notifications), suggesting repeat-intent traffic.
- Confidence: Medium-High (primary source supports breadth; precise national total not prominently disclosed).

### 3) Autovit (`autovit.ro`) — High priority for auto vertical

- Why it matters to Libergent:
  - Romanian auto vertical has strong transaction intent and high ticket value; Autovit is a key specialized source.
  - Improves relevance for vehicle queries where generalist marketplaces are noisier.
- Evidence of popularity/liquidity:
  - Autovit category page shows tens of thousands of active car ads (example observed: 45,834 ads on autoturisme listing page).
- Marketplace type:
  - Vertical automotive classifieds marketplace.
- Trust/safety and discovery notes:
  - Discovery is heavily faceted (brand/model/year/km/fuel), so parser/filter fidelity is critical.
  - Auto buyers are sensitive to listing quality, seller type, and financing/service metadata.
- Confidence: High (primary platform page with explicit live listing count).

### 4) Okazii (`okazii.ro`) — Medium-High priority

- Why it matters to Libergent:
  - Adds long-tail catalog and seller-professional inventory that can complement pure classifieds.
  - Differentiates Libergent on collectible/specialty categories and price-comparison breadth.
- Evidence of popularity/liquidity:
  - Okazii homepage states "peste 6.000.000 de produse" from stores/professional sellers.
- Marketplace type:
  - Marketplace/catalog + classifieds hybrid.
- Trust/safety and discovery notes:
  - Okazii publicly emphasizes transaction mechanisms like delivery guarantee and structured fees/commissions.
  - Mixed inventory model (catalog + listings) requires normalization that differs from pure classifieds parsing.
- Confidence: Medium-High (strong primary scale claim; composition of products vs. unique active listings is not fully transparent).

### 5) Lajumate (`lajumate.ro`) — Medium priority

- Why it matters to Libergent:
  - Additional supply in common consumer categories and local listings, helpful for incremental recall.
  - Can capture users seeking free-posting ecosystems and smaller-city inventory.
- Evidence of popularity/liquidity:
  - Active multi-category listing flow on marketplace pages and dedicated classifieds structure.
  - Help-center materials describe slot-based posting limits and paid packages, indicating sustained listing operations.
- Marketplace type:
  - Generalist classifieds marketplace.
- Trust/safety and discovery notes:
  - Simpler posting flow likely increases listing volume but may increase quality variance.
  - Location-heavy discovery patterns suggest local intent similar to OLX/Publi24.
- Confidence: Medium (primary evidence indicates active market but lacks prominent public aggregate listing total).

### 6) Vinted Romania (`vinted.ro`) — Targeted priority (fashion)

- Why it matters to Libergent:
  - Important for fashion/apparel second-hand intent, especially app-native behavior.
  - Strategic to include for category completeness even when cross-category coverage is narrower.
- Evidence of popularity/liquidity:
  - Dedicated Romanian localized property and app-first second-hand value proposition.
- Marketplace type:
  - Vertical C2C fashion/lifestyle resale marketplace.
- Trust/safety and discovery notes:
  - Discovery often app-led with social/wardrobe dynamics rather than classic web-classified flows.
  - Integration strategy should account for vertical taxonomy and shipping/payment conventions.
- Confidence: Medium-Low (local presence is clear; public Romania-specific liquidity stats are not prominent on accessible pages).

## What This Changes for Libergent Prioritization

1. Source weighting
- Keep OLX highest weight for broad-query coverage.
- Use Autovit boosting when query intent is automotive.
- Maintain Publi24/Lajumate as recall multipliers for local supply.
- Treat Okazii as catalog-depth enhancer, especially long-tail goods.

2. Query routing and ranking strategy
- Romania search behavior is strongly local and category first.
- For generic terms, prioritize broad classifieds blend (OLX + Publi24 + Lajumate).
- For vehicle intent, prioritize Autovit with strict dedupe across OLX/Publi24 overlaps.

3. Trust and quality controls
- Increase anti-duplicate and anomaly checks on generalist classifieds.
- Preserve seller-type and trust metadata where present (professional/private, guarantee, delivery cues).

## Source Quality and Uncertainty Notes

- Primary platform pages were prioritized for listing scale/category/trust signals.
- Third-party panel estimates were not used as ranking anchors in this pass because primary liquidity signals were sufficient for decision direction.
- Where a platform does not publish a clear national active-listings total, conclusions are marked as medium confidence and treated as directional.

## Sources (Accessed 2026-05-13)

- OLX Romania homepage ("Peste 4 milioane anunturi"): https://www.olx.ro/
- Autovit cars listing page (live ad count on page): https://www.autovit.ro/autoturisme/anun
- Publi24 homepage: https://www.publi24.ro/
- Publi24 listings page (category/county inventory view): https://www.publi24.ro/anunturi/
- Okazii homepage ("peste 6.000.000 de produse"): https://www.okazii.ro/
- Okazii categories page: https://www.okazii.ro/catalog/
- Lajumate homepage: https://www.lajumate.ro/
- Lajumate help article (posting packages/slot mechanics): https://ajutor.lajumate.ro/hc/ro/articles/9906432863516-Pachete-de-anun%C8%9Buri
- Vinted Romania homepage: https://www.vinted.ro/
- Vinted app page (app-led positioning): https://www.vinted.ro/app
