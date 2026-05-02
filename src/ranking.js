import { tokenize } from "./relevance.js";

export const DEFAULT_RANKING_WEIGHTS = {
  textRelevance: 0.55,
  price: 0.25,
  condition: 0.12,
  location: 0.08
};

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function normalizeWeights(weights = DEFAULT_RANKING_WEIGHTS) {
  const merged = {
    ...DEFAULT_RANKING_WEIGHTS,
    ...(weights || {})
  };
  const total = Object.values(merged).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  if (total <= 0) {
    return { ...DEFAULT_RANKING_WEIGHTS };
  }

  return Object.fromEntries(
    Object.entries(merged).map(([key, value]) => [key, Number.isFinite(value) ? value / total : 0])
  );
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
  const normalized = String(item?.condition || "").toLowerCase();
  if (condition === "new") {
    return normalized.includes("nou") || normalized.includes("new");
  }
  if (condition === "used") {
    return normalized.includes("utilizat") || normalized.includes("folosit") || normalized.includes("second") || normalized.includes("used");
  }
  return true;
}

function scoreTextRelevance(item, query) {
  if (Number.isFinite(item?.relevanceScore)) {
    return clamp01(item.relevanceScore / 100);
  }

  const queryTokens = tokenize(query || "");
  if (!queryTokens.length) {
    return 0.5;
  }

  const titleTokens = new Set(tokenize(item?.title || ""));
  const matches = queryTokens.filter((token) => titleTokens.has(token)).length;
  return clamp01(matches / queryTokens.length);
}

function scorePrice(item, medianPriceRon) {
  if (!Number.isFinite(item?.priceRon) || !Number.isFinite(medianPriceRon) || medianPriceRon <= 0) {
    return 0.5;
  }

  const ratio = item.priceRon / medianPriceRon;
  if (ratio < 0.2) {
    return 0.1;
  }
  if (ratio < 0.35) {
    return 0.35;
  }
  if (ratio <= 0.85) {
    return 1;
  }
  if (ratio <= 1) {
    return 0.85;
  }
  if (ratio <= 1.15) {
    return 0.72;
  }
  if (ratio <= 1.35) {
    return 0.5;
  }
  return 0.3;
}

function scoreCondition(item, condition) {
  if (condition === "any") {
    return 0.7;
  }
  return matchesCondition(item, condition) ? 1 : 0;
}

function scoreLocation(item, query) {
  const location = String(item?.location || "").trim().toLowerCase();
  if (!location) {
    return 0.35;
  }

  const queryTokens = tokenize(query || "");
  const locationTokens = new Set(tokenize(location));
  const matchingTokens = queryTokens.filter((token) => locationTokens.has(token)).length;
  if (!queryTokens.length || matchingTokens === 0) {
    return 0.65;
  }

  return clamp01(0.65 + (matchingTokens / queryTokens.length) * 0.35);
}

export function rankListings({ listings, query, condition = "any", limit = 20, weights = DEFAULT_RANKING_WEIGHTS }) {
  const normalizedWeights = normalizeWeights(weights);
  const pricedValues = listings.filter((item) => Number.isFinite(item?.priceRon)).map((item) => item.priceRon);
  const medianPriceRon = median(pricedValues);

  const scored = listings.map((item, index) => {
    const textRelevance = scoreTextRelevance(item, query);
    const price = scorePrice(item, medianPriceRon);
    const conditionScore = scoreCondition(item, condition);
    const location = scoreLocation(item, query);

    const weighted = {
      textRelevance: textRelevance * normalizedWeights.textRelevance,
      price: price * normalizedWeights.price,
      condition: conditionScore * normalizedWeights.condition,
      location: location * normalizedWeights.location
    };

    const totalScore = Math.round((weighted.textRelevance + weighted.price + weighted.condition + weighted.location) * 1000) / 10;

    return {
      ...item,
      rankingIndex: index,
      rankingScore: totalScore,
      scoreBreakdown: {
        components: {
          textRelevance,
          price,
          condition: conditionScore,
          location
        },
        weighted,
        weights: normalizedWeights,
        medianPriceRon
      }
    };
  });

  return scored
    .sort((a, b) => {
      if (b.rankingScore !== a.rankingScore) {
        return b.rankingScore - a.rankingScore;
      }

      const aRelevance = Number.isFinite(a.relevanceScore) ? a.relevanceScore : 0;
      const bRelevance = Number.isFinite(b.relevanceScore) ? b.relevanceScore : 0;
      if (bRelevance !== aRelevance) {
        return bRelevance - aRelevance;
      }

      const aPrice = Number.isFinite(a.priceRon) ? a.priceRon : Number.POSITIVE_INFINITY;
      const bPrice = Number.isFinite(b.priceRon) ? b.priceRon : Number.POSITIVE_INFINITY;
      if (aPrice !== bPrice) {
        return aPrice - bPrice;
      }

      return `${a.site || ""}::${a.url || ""}::${a.title || ""}`.localeCompare(
        `${b.site || ""}::${b.url || ""}::${b.title || ""}`
      );
    })
    .slice(0, Math.max(1, limit));
}
