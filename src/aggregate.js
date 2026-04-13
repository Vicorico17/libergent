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

export function aggregateMarketplaceResults(results, { condition = "any", creditBudget = null, creditsUsed = null } = {}) {
  const normalizedResults = results.map((result) => {
    if (!result.ok) {
      return result;
    }

    const items = sortItemsByFreshness(
      result.items
        .map(normalizeListing)
        .map((item) => classifyListingIntent(item, result.query))
        .filter((item) => item.isRecommendedCandidate)
        .filter((item) => matchesCondition(item, condition))
    );
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
    offerScore: Math.round((scoreOffer(item, "", globalMedianPriceRon, condition) * 0.65) + (item.relevanceScore * 0.35))
  }));
  const bestOffer = allBestCandidates.length
    ? allBestCandidates.reduce((best, item) => {
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
      bestOffer
    }
  };
}
