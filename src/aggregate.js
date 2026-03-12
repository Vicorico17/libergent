import { normalizeListing } from "./normalize.js";

export function aggregateMarketplaceResults(results) {
  const normalizedResults = results.map((result) => {
    if (!result.ok) {
      return result;
    }

    const items = result.items.map(normalizeListing);
    const pricedItems = items.filter((item) => Number.isFinite(item.priceRon));
    const lowest = pricedItems.length
      ? pricedItems.reduce((best, item) => (item.priceRon < best.priceRon ? item : best))
      : null;

    return {
      ...result,
      items,
      lowest
    };
  });

  const allPricedItems = normalizedResults
    .filter((result) => result.ok)
    .flatMap((result) => result.items)
    .filter((item) => Number.isFinite(item.priceRon));

  const averagePriceRon = allPricedItems.length
    ? allPricedItems.reduce((sum, item) => sum + item.priceRon, 0) / allPricedItems.length
    : null;

  return {
    results: normalizedResults,
    summary: {
      searchedAt: new Date().toISOString(),
      marketplaces: normalizedResults.length,
      successfulMarketplaces: normalizedResults.filter((result) => result.ok).length,
      totalListings: normalizedResults
        .filter((result) => result.ok)
        .reduce((sum, result) => sum + result.items.length, 0),
      pricedListingsRon: allPricedItems.length,
      averagePriceRon
    }
  };
}
