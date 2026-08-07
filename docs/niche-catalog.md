# Niche Catalog and Shop Contributions

LiberGent groups sources by the product niche they serve. A search always uses the general second-hand and price-comparison sources, then adds only the retailer groups relevant to the query.

| Niche | Current retailers / sources |
| --- | --- |
| General marketplace & second-hand | OLX, Vinted, Lajumate, Okazii, Publi24, Anuntul, Price.ro, ShopMania, Compari |
| Technology | Flip, Klap, eMAG, evoMAG, CEL.ro, PC Garage, Flanco, Altex |
| Vehicles | Autovit, BestAuto |
| Fashion & sneakers | Sizeer, ePantofi, Fashion Days, Zalando, ABOUT YOU, Answear, MODIVO |
| Home & furniture | IKEA, JYSK, Mobexpert |
| DIY & tools | Dedeman, Leroy Merlin, HORNBACH |
| Sport & outdoor | Decathlon, Sport Vision, INTERSPORT |
| Photo & video | F64, Photosetup |
| Music & audio | SoundCreation, M&C Musical Instruments |
| Books, games & collectibles | Cărturești, Libris |
| Baby & kids | Noriel, Nichiduta, Bebe Tei |
| Beauty & personal care | Notino, Douglas, Sephora |
| Pet supplies | Zooplus, Animax, PetMart |
| Toys & hobby | Red Goblin, Regatul Jocurilor, Bricks Depot |

## Adding a shop later

1. Add the retailer in `src/sites.js` with its key, label, direct search URL, source type, and niche.
2. Add the key to the matching `PREMIUM_*_SITE_KEYS` group and, if it is a new category, add that category to `NICHE_CATALOG` plus its query matcher.
3. Add its display label to `ui/src/app/search/search-data.ts` and to the appropriate filter group in the search UI.
4. Add parser fixtures for a representative product, including sale-price handling and product-code/variant matching.
5. Confirm the store permits the intended use and does not require a login, CAPTCHA bypass, or session replay.

Registered does not mean always healthy: the per-source search report remains the source of truth for current availability.

## Scaling states

- **Active** — default or conditionally routed production source with automated regression coverage.
- **Experimental** — a registered retailer that is query-routed and reported transparently, but still needs live fixture/health evidence before it is promoted.
- **Catalog** — a suggested shop listed for future review; it is link-out only and never fetched by the search service.

Do not move a public suggestion directly to Active. Review it, validate a permitted route, then begin in Experimental.
