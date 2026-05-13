import { normalizeListing } from "./normalize.js";
import { classifyListingIntent, getQueryBrandTerms, tokenize } from "./relevance.js";

const CITY_COORDINATES = {
  "alba iulia": { lat: 46.0695, lon: 23.5702 },
  arad: { lat: 46.1866, lon: 21.3123 },
  bacau: { lat: 46.567, lon: 26.9146 },
  baia: { lat: 47.6597, lon: 23.5819 },
  brasov: { lat: 45.6579, lon: 25.6012 },
  braila: { lat: 45.2692, lon: 27.9575 },
  bucuresti: { lat: 44.4268, lon: 26.1025 },
  buzau: { lat: 45.1503, lon: 26.8161 },
  cluj: { lat: 46.7712, lon: 23.6236 },
  constanta: { lat: 44.1598, lon: 28.6348 },
  craiova: { lat: 44.3302, lon: 23.7949 },
  galati: { lat: 45.4353, lon: 28.008 },
  iasi: { lat: 47.1585, lon: 27.6014 },
  oradea: { lat: 47.0465, lon: 21.9189 },
  pitesti: { lat: 44.8565, lon: 24.8692 },
  ploiesti: { lat: 44.9369, lon: 26.0124 },
  sibiu: { lat: 45.7983, lon: 24.1256 },
  suceava: { lat: 47.6635, lon: 26.2732 },
  timisoara: { lat: 45.7489, lon: 21.2087 },
  targu: { lat: 46.5424, lon: 24.5575 }
};

function normalizeLocationText(value = "") {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(a, b) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const aa = sinLat * sinLat + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return earthRadiusKm * c;
}

function resolveLocationCoordinates(location = "") {
  const normalized = normalizeLocationText(location);
  if (!normalized) {
    return null;
  }

  const entries = Object.entries(CITY_COORDINATES).sort((a, b) => b[0].length - a[0].length);
  for (const [token, coords] of entries) {
    if (normalized.includes(token)) {
      return coords;
    }
  }

  return null;
}

function distanceScore(distanceKm) {
  if (!Number.isFinite(distanceKm)) {
    return 60;
  }
  if (distanceKm <= 5) return 100;
  if (distanceKm <= 25) return 90;
  if (distanceKm <= 75) return 75;
  if (distanceKm <= 150) return 60;
  if (distanceKm <= 300) return 45;
  return 30;
}

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

function safePriceForTieBreak(priceRon) {
  return Number.isFinite(priceRon) ? priceRon : Number.POSITIVE_INFINITY;
}

// Deterministic per-marketplace ranking:
// - intent/relevance (token and brand match, listing-type penalties)
// - condition preference
// - freshness
// - value guardrails against implausibly cheap outliers
function scoreOffer(item, query, medianPriceRon, condition) {
  const text = `${item.title || ""} ${item.condition || ""}`.toLowerCase();
  const queryTokens = tokenize(query);
  const titleTokens = new Set(tokenize(item.title || ""));
  const matches = queryTokens.filter((token) => titleTokens.has(token)).length;
  const brandTokens = getQueryBrandTerms(query);
  const brandMatches = brandTokens.filter((token) => titleTokens.has(token)).length;

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
  if (brandTokens.length) {
    score += brandMatches ? 18 : 0;
    if (!brandMatches) {
      score -= 16;
    }
  }

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

// Cross-marketplace recommendation score used for "best offer possible":
// relevance + value + freshness + condition, then penalties for low-confidence signals.
function scoreGlobalRecommendation(item, medianPriceRon, condition, requesterLocation) {
  const relevance = Number.isFinite(item.relevanceScore) ? item.relevanceScore : 50;
  const value = priceValueScore(item.priceRon, medianPriceRon);
  const freshness = Math.min(100, recencyScore(item.postedAt) * 5);
  const conditionScore =
    condition === "any" ? 70 :
    matchesCondition(item, condition) ? 100 :
    25;
  const requesterCoords = resolveLocationCoordinates(requesterLocation);
  const listingCoords = resolveLocationCoordinates(item.location);
  const distanceKm =
    requesterCoords && listingCoords
      ? haversineDistanceKm(requesterCoords, listingCoords)
      : Number.NaN;
  const localityScore = distanceScore(distanceKm);

  let score = Math.round(
    (relevance * 0.42) +
    (value * 0.3) +
    (freshness * 0.1) +
    (conditionScore * 0.08) +
    (localityScore * 0.1)
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
  if ((item.rejectionReasons || []).some((reason) => reason.startsWith("variant_mismatch:"))) {
    score -= 25;
  }
  if (item.listingType === "broken_or_for_parts" || item.listingType === "spare_part") {
    score -= 30;
  }

  return {
    recommendationScore: Math.max(0, Math.min(100, score)),
    distanceKm
  };
}

function pickTopRecommendationsByMarketplace(items, limit = 4) {
  const bestBySite = new Map();

  for (const item of items) {
    const site = item.site || "";
    const current = bestBySite.get(site);
    if (
      !current ||
      item.recommendationScore > current.recommendationScore ||
      (
        item.recommendationScore === current.recommendationScore &&
        safePriceForTieBreak(item.priceRon) < safePriceForTieBreak(current.priceRon)
      )
    ) {
      bestBySite.set(site, item);
    }
  }

  return [...bestBySite.values()]
    .sort((a, b) => {
      if (b.recommendationScore !== a.recommendationScore) {
        return b.recommendationScore - a.recommendationScore;
      }
      return safePriceForTieBreak(a.priceRon) - safePriceForTieBreak(b.priceRon);
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

export function aggregateMarketplaceResults(
  results,
  { condition = "any", creditBudget = null, creditsUsed = null, requesterLocation = "" } = {}
) {
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
    const scoredItems = items.map((item) => ({
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
          return safePriceForTieBreak(item.priceRon) < safePriceForTieBreak(best.priceRon) ? item : best;
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
    })));

  const averagePriceRon = allPricedItems.length
    ? allPricedItems.reduce((sum, item) => sum + item.priceRon, 0) / allPricedItems.length
    : null;
  const globalMedianPriceRon = median(allScoredItems.map((item) => item.priceRon));
  const allBestCandidates = allScoredItems.map((item) => {
    const scoreData = scoreGlobalRecommendation(item, globalMedianPriceRon, condition, requesterLocation);
    return {
      ...item,
      recommendationScore: scoreData.recommendationScore,
      distanceKm: scoreData.distanceKm
    };
  });
  const bestOffer = allBestCandidates.length
    ? allBestCandidates.reduce((best, item) => {
        if (!best) {
          return item;
        }
        if (item.recommendationScore !== best.recommendationScore) {
          return item.recommendationScore > best.recommendationScore ? item : best;
        }
        if (Number.isFinite(item.distanceKm) && Number.isFinite(best.distanceKm) && item.distanceKm !== best.distanceKm) {
          return item.distanceKm < best.distanceKm ? item : best;
        }
        return safePriceForTieBreak(item.priceRon) < safePriceForTieBreak(best.priceRon) ? item : best;
      }, null)
    : null;
  const recommendedOffers = pickTopRecommendationsByMarketplace(allBestCandidates);

  return {
    results: normalizedResults,
    bestOffer,
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
