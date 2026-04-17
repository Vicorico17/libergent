import { normalizeListing } from "./normalize.js";
import { classifyListingIntent, tokenize } from "./relevance.js";

function median(values) {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function matchesCondition(item, condition) {
  const normalized = (item.condition || "").toLowerCase();
  if (condition === "new") {
    return normalized.includes("nou");
  }
  if (condition === "used") {
    return normalized.includes("utilizat") || normalized.includes("folosit") || normalized.includes("second");
  }
  return true;
}

function recencyScore(postedAt = "") {
  const value = postedAt.toLowerCase();
  if (!value) {
    return 0;
  }
  if (value.includes("azi")) {
    return 18;
  }
  if (value.includes("ieri")) {
    return 14;
  }
  if (value.includes("reactualizat")) {
    return 10;
  }
  if (value.includes("martie 2026")) {
    return 8;
  }
  if (value.includes("februarie 2026")) {
    return 3;
  }
  return 1;
}

function sortItemsByFreshness(items) {
  return [...items].sort((a, b) => recencyScore(b.postedAt) - recencyScore(a.postedAt));
}

function priceValueScore(priceRon, medianPriceRon) {
  if (!Number.isFinite(priceRon) || !Number.isFinite(medianPriceRon) || medianPriceRon <= 0) {
    return 45;
  }

  const ratio = priceRon / medianPriceRon;
  if (ratio < 0.2) {
    return 5;
  }
  if (ratio < 0.35) {
    return 24;
  }
  if (ratio < 0.55) {
    return 58;
  }
  if (ratio <= 0.85) {
    return 100;
  }
  if (ratio <= 1) {
    return 88;
  }
  if (ratio <= 1.15) {
    return 72;
  }
  if (ratio <= 1.35) {
    return 48;
  }
  return 25;
}

function scoreOffer(item, query, medianPriceRon, condition) {
  const text = `${item.title || ""} ${item.condition || ""}`.toLowerCase();
  const queryTokens = tokenize(query);
  const titleTokens = new Set(tokenize(item.title || ""));
  const matches = queryTokens.filter((token) => titleTokens.has(token)).length;

  const badKeywords = [
    "piese",
    "pentru piese",
    "defect",
    "defecta",
    "spart",
    "fisurat",
    "nefunctional",
    "stricat",
    "carcasa",
    "display",
    "placa"
  ];

  let score = 60;
  score += Math.min(matches * 8, 24);

  if (item.condition?.toLowerCase() === "nou") {
    score += 10;
  }
  score += recencyScore(item.postedAt);
  if (condition === "new" && matchesCondition(item, "new")) {
    score += 18;
  }
  if (condition === "used" && matchesCondition(item, "used")) {
    score += 18;
  }
  if (condition !== "any" && !matchesCondition(item, condition)) {
    score -= 28;
  }

  if (Number.isFinite(item.priceRon) && Number.isFinite(medianPriceRon)) {
    const ratio = item.priceRon / medianPriceRon;
    if (ratio < 0.2) {
      score -= 35;
    } else if (ratio < 0.35) {
      score -= 20;
    } else if (ratio <= 0.9) {
      score += 12;
    } else if (ratio <= 1.1) {
      score += 5;
    }
  }

  for (const keyword of badKeywords) {
    if (text.includes(keyword)) {
      score -= 40;
      break;
    }
  }

  return Math.max(0, Math.min(100, score));
}

function scoreGlobalRecommendation(item, medianPriceRon, condition) {
  const relevance = Number.isFinite(item.relevanceScore) ? item.relevanceScore : 50;
  const value = priceValueScore(item.priceRon, medianPriceRon);
  const freshness = Math.min(100, recencyScore(item.postedAt) * 5);
  const conditionScore =
    condition === "any" ? 70 :
    matchesCondition(item, condition) ? 100 :
    25;

  let score = Math.round(
    (relevance * 0.46) +
    (value * 0.34) +
    (freshness * 0.12) +
    (conditionScore * 0.08)
  );

  if (Number.isFinite(item.priceRon) && Number.isFinite(medianPriceRon) && medianPriceRon > 0) {
    const ratio = item.priceRon / medianPriceRon;
    if (ratio < 0.25) {
      score -= 28;
    } else if (ratio < 0.4) {
      score -= 12;
    }
  }

  if ((item.rejectionReasons || []).length) {
    score -= Math.min(30, item.rejectionReasons.length * 8);
  }

  return Math.max(0, Math.min(100, score));
}

function pickTopRecommendationsByMarketplace(items, limit = 4) {
  const bestBySite = new Map();

  for (const item of items) {
    const site = item.site || "";
    const current = bestBySite.get(site);
    if (
      !current ||
      item.recommendationScore > current.recommendationScore ||
      (item.recommendationScore === current.recommendationScore && item.priceRon < current.priceRon)
    ) {
      bestBySite.set(site, item);
    }
  }

  return [...bestBySite.values()]
    .sort((a, b) => {
      if (b.recommendationScore !== a.recommendationScore) {
        return b.recommendationScore - a.recommendationScore;
      }
      return a.priceRon - b.priceRon;
    })
    .slice(0, limit);
}

function splitClassifiedItems(items) {
  const productMatches = [];
  const relatedAccessories = [];
  const partsAndRepair = [];
  const wantedAds = [];
  const secondaryMatches = [];

  for (const item of items) {
    if (item.isRecommendedCandidate) {
      productMatches.push(item);
    } else if (item.listingType === "accessory") {
      relatedAccessories.push(item);
    } else if (item.listingType === "spare_part" || item.listingType === "service" || item.listingType === "broken_or_for_parts") {
      partsAndRepair.push(item);
    } else if (item.listingType === "wanted") {
      wantedAds.push(item);
    } else {
      secondaryMatches.push(item);
    }
  }

  return {
    productMatches,
    relatedAccessories,
    partsAndRepair,
    wantedAds,
    secondaryMatches
  };
}

export function aggregateMarketplaceResults(results, { condition = "any", creditBudget = null, creditsUsed = null } = {}) {
  const normalizedResults = results.map((result) => {
    if (!result.ok) {
      return result;
    }

    const classifiedItems = sortItemsByFreshness(
      result.items
        .map(normalizeListing)
        .map((item) => classifyListingIntent(item, result.query))
        .filter((item) => matchesCondition(item, condition))
    );
    const {
      productMatches,
      relatedAccessories,
      partsAndRepair,
      wantedAds,
      secondaryMatches
    } = splitClassifiedItems(classifiedItems);
    const items = productMatches;
    const pricedItems = items.filter((item) => Number.isFinite(item.priceRon));
    const medianPriceRon = median(pricedItems.map((item) => item.priceRon));
    const lowest = pricedItems.length
      ? pricedItems.reduce((best, item) => (item.priceRon < best.priceRon ? item : best))
      : null;
    const scoredItems = pricedItems.map((item) => ({
      ...item,
      offerScore: scoreOffer(item, result.query, medianPriceRon, condition)
    }));
    const bestOffer = scoredItems.length
      ? scoredItems.reduce((best, item) => {
          if (!best) {
            return item;
          }
          if (item.offerScore !== best.offerScore) {
            return item.offerScore > best.offerScore ? item : best;
          }
          return item.priceRon < best.priceRon ? item : best;
        }, null)
      : null;

    return {
      ...result,
      rawItemCount: result.itemCount,
      itemCount: items.length,
      items,
      relatedAccessories,
      partsAndRepair,
      wantedAds,
      secondaryMatches,
      excludedItemCount: relatedAccessories.length + partsAndRepair.length + wantedAds.length + secondaryMatches.length,
      lowest,
      bestOffer
    };
  });

  const allPricedItems = normalizedResults
    .filter((result) => result.ok)
    .flatMap((result) => result.items)
    .filter((item) => Number.isFinite(item.priceRon));
  const allScoredItems = normalizedResults
    .filter((result) => result.ok)
    .flatMap((result) => result.items.map((item) => ({
      ...item,
      site: result.site
    })))
    .filter((item) => Number.isFinite(item.priceRon));

  const averagePriceRon = allPricedItems.length
    ? allPricedItems.reduce((sum, item) => sum + item.priceRon, 0) / allPricedItems.length
    : null;
  const globalMedianPriceRon = median(allScoredItems.map((item) => item.priceRon));
  const allBestCandidates = allScoredItems.map((item) => ({
    ...item,
    recommendationScore: scoreGlobalRecommendation(item, globalMedianPriceRon, condition)
  }));
  const bestOffer = allBestCandidates.length
    ? allBestCandidates.reduce((best, item) => {
        if (!best) {
          return item;
        }
        if (item.recommendationScore !== best.recommendationScore) {
          return item.recommendationScore > best.recommendationScore ? item : best;
        }
        return item.priceRon < best.priceRon ? item : best;
      }, null)
    : null;
  const recommendedOffers = pickTopRecommendationsByMarketplace(allBestCandidates);

  return {
    results: normalizedResults,
    summary: {
      searchedAt: new Date().toISOString(),
      condition,
      conditionLabel: condition === "new" ? "Nou" : condition === "used" ? "Folosit" : "Oricare",
      creditBudget,
      creditsUsed,
      marketplaces: normalizedResults.length,
      successfulMarketplaces: normalizedResults.filter((result) => result.ok).length,
      totalListings: normalizedResults
        .filter((result) => result.ok)
        .reduce((sum, result) => sum + result.items.length, 0),
      pricedListingsRon: allPricedItems.length,
      averagePriceRon,
      bestOffer,
      recommendedOffers
    }
  };
}
