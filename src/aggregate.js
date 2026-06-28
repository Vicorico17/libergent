import { normalizeListing } from "./normalize.js";
import { classifyListingIntent, getQueryBrandTerms, tokenize } from "./relevance.js";

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

const ROMANIAN_MONTHS = new Map([
  ["ianuarie", 0],
  ["februarie", 1],
  ["martie", 2],
  ["aprilie", 3],
  ["mai", 4],
  ["iunie", 5],
  ["iulie", 6],
  ["august", 7],
  ["septembrie", 8],
  ["octombrie", 9],
  ["noiembrie", 10],
  ["decembrie", 11]
]);

function stripDiacritics(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parsePostedAtDate(postedAt = "", now = new Date()) {
  const raw = String(postedAt || "").trim();
  const value = stripDiacritics(raw.toLowerCase());

  if (!value) {
    return null;
  }
  if (value.includes("azi")) {
    return now;
  }
  if (value.includes("ieri")) {
    const date = new Date(now);
    date.setDate(date.getDate() - 1);
    return date;
  }

  const relativeDaysMatch = value.match(/(\d+)\s*(?:z|zi|zile)\b/);
  if (relativeDaysMatch) {
    const days = Number.parseInt(relativeDaysMatch[1], 10);
    if (Number.isFinite(days)) {
      const date = new Date(now);
      date.setDate(date.getDate() - days);
      return date;
    }
  }

  const dottedDateMatch = value.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/);
  if (dottedDateMatch) {
    const day = Number.parseInt(dottedDateMatch[1], 10);
    const month = Number.parseInt(dottedDateMatch[2], 10);
    const year = Number.parseInt(dottedDateMatch[3], 10);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const monthDateMatch = value.match(/\b(?:(\d{1,2})\s+)?([a-z]+)\s+(\d{4})\b/);
  if (monthDateMatch) {
    const day = monthDateMatch[1] ? Number.parseInt(monthDateMatch[1], 10) : 1;
    const month = ROMANIAN_MONTHS.get(monthDateMatch[2]);
    const year = Number.parseInt(monthDateMatch[3], 10);
    if (month !== undefined && Number.isFinite(day) && Number.isFinite(year)) {
      const date = new Date(year, month, day);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysAgoFromDate(date, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const then = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.max(0, Math.round((today.getTime() - then.getTime()) / 86400000));
}

function recencyScore(postedAt = "") {
  const value = stripDiacritics(String(postedAt || "").toLowerCase());
  const parsed = parsePostedAtDate(postedAt);

  if (!parsed) {
    return value.includes("reactualizat") ? 10 : 0;
  }

  const daysAgo = daysAgoFromDate(parsed);
  if (daysAgo <= 0) {
    return 18;
  }
  if (daysAgo === 1) {
    return 14;
  }
  if (daysAgo <= 7) {
    return 10;
  }
  if (daysAgo <= 30) {
    return 6;
  }
  if (daysAgo <= 90) {
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

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getListingText(item) {
  return [
    item.title,
    item.description,
    item.condition,
    item.sellerType
  ].filter(Boolean).join(" ");
}

function extractPhoneSpecs(item) {
  const text = getListingText(item);
  const normalized = stripDiacritics(text.toLowerCase());
  const hasPhoneSignal = /\b(iphone|samsung|galaxy|telefon|smartphone)\b/.test(normalized);
  if (!hasPhoneSignal) {
    return null;
  }

  const storageMatch = normalized.match(/\b(64|128|256|512|1024)\s*(?:gb|g\b)/);
  const batteryMatch = normalized.match(/\b(?:baterie|battery|bh|akku|acumulator)[^\d]{0,12}(\d{2,3})\s*%|\b(\d{2,3})\s*%\s*(?:baterie|battery|bh|akku|acumulator)/);
  const batteryHealthPct = batteryMatch
    ? Number.parseInt(batteryMatch[1] || batteryMatch[2], 10)
    : null;
  const warranty = /\b(garantie|garanție|warranty)\b/.test(normalized);
  const invoice = /\b(factura|factură|invoice)\b/.test(normalized);
  const lockedRisk = /\b(icloud|blocat|locked|cont blocat|sim lock|simlock)\b/.test(normalized);
  const neverlocked = /\b(neverlocked|never locked|liber de retea|liber retea|deblocat)\b/.test(normalized);
  const refurbished = /\b(refurbished|reconditionat|recondiționat)\b/.test(normalized);
  const serviceHistory = /\b(schimbat|inlocuit|înlocuit|service|reparat)\b/.test(normalized);
  const cracked = /\b(spart|fisurat|crapat|crăpat|display spart|ecran spart)\b/.test(normalized);
  const modelMatch = normalized.match(/\biphone\s*(\d{2})(?:\s*(pro max|pro|plus|mini|max))?\b/) ||
    normalized.match(/\bgalaxy\s*(s\d{2}|a\d{2}|z\s*flip\s*\d|z\s*fold\s*\d)(?:\s*(ultra|plus|\+))?\b/);
  const brand =
    normalized.includes("iphone") ? "Apple" :
    normalized.includes("samsung") || normalized.includes("galaxy") ? "Samsung" :
    null;
  const model = modelMatch ? modelMatch[0].replace(/\s+/g, " ").trim() : null;
  const variant = modelMatch?.[2] ? modelMatch[2].replace(/\s+/g, " ").trim() : null;

  return {
    isPhone: true,
    brand,
    model,
    variant,
    storageGb: storageMatch ? Number.parseInt(storageMatch[1], 10) : null,
    batteryHealthPct: Number.isFinite(batteryHealthPct) ? batteryHealthPct : null,
    warranty,
    invoice,
    lockedRisk,
    neverlocked,
    refurbished,
    serviceHistory,
    cracked,
    conditionSignals: [
      warranty ? "garanție" : null,
      invoice ? "factură" : null,
      neverlocked ? "neverlocked" : null,
      refurbished ? "refurbished" : null,
      serviceHistory ? "istoric service" : null,
      cracked ? "ecran/carcasa deteriorată" : null
    ].filter(Boolean)
  };
}

function buildPriceInsight(item, medianPriceRon) {
  if (!Number.isFinite(item.priceRon) || !Number.isFinite(medianPriceRon) || medianPriceRon <= 0) {
    return {
      label: "preț necunoscut",
      severity: "neutral",
      marketMedianRon: Number.isFinite(medianPriceRon) ? medianPriceRon : null,
      fairLowRon: Number.isFinite(medianPriceRon) ? Math.round(medianPriceRon * 0.75) : null,
      fairHighRon: Number.isFinite(medianPriceRon) ? Math.round(medianPriceRon * 1.15) : null,
      priceDeltaPct: null
    };
  }

  const ratio = item.priceRon / medianPriceRon;
  const priceDeltaPct = Math.round((ratio - 1) * 100);
  let label = "preț corect";
  let severity = "neutral";

  if (ratio < 0.45) {
    label = "foarte ieftin, verifică atent";
    severity = "warning";
  } else if (ratio < 0.75) {
    label = "sub piață";
    severity = "good";
  } else if (ratio <= 1.15) {
    label = "în zona pieței";
    severity = "neutral";
  } else if (ratio <= 1.35) {
    label = "peste medie";
    severity = "warning";
  } else {
    label = "scump";
    severity = "bad";
  }

  return {
    label,
    severity,
    marketMedianRon: Math.round(medianPriceRon),
    fairLowRon: Math.round(medianPriceRon * 0.75),
    fairHighRon: Math.round(medianPriceRon * 1.15),
    priceDeltaPct
  };
}

function buildRiskFlags(item, medianPriceRon) {
  const flags = [];
  const reasons = item.rejectionReasons || [];
  const missingKeywords = item.keywordSignals?.missingKeywords || [];
  const negativeKeywords = item.keywordSignals?.negativeKeywords || [];

  if (item.keywordSignals?.variantMismatch || reasons.some((reason) => reason.startsWith("variant_mismatch:"))) {
    flags.push({ code: "variant_mismatch", label: "variantă diferită", severity: "bad" });
  }
  if (missingKeywords.length || reasons.includes("missing_critical_query_tokens")) {
    flags.push({ code: "missing_keywords", label: "cuvinte cheie lipsă", severity: "warning" });
  }
  if (negativeKeywords.length) {
    flags.push({ code: "negative_terms", label: "termeni penalizați", severity: "warning" });
  }
  if (item.listingType === "accessory") {
    flags.push({ code: "accessory", label: "pare accesoriu", severity: "warning" });
  }
  if (item.listingType === "spare_part") {
    flags.push({ code: "spare_part", label: "pare piesă", severity: "bad" });
  }
  if (item.listingType === "broken_or_for_parts") {
    flags.push({ code: "broken", label: "defect/pentru piese", severity: "bad" });
  }
  if (item.listingType === "wanted") {
    flags.push({ code: "wanted", label: "anunț de cumpărare", severity: "bad" });
  }
  if ((item.intentType === "commercial" || reasons.includes("commercial")) && !flags.some((flag) => flag.code === "commercial")) {
    flags.push({ code: "commercial", label: "anunț stoc/catalog", severity: "warning" });
  }
  if (Number.isFinite(item.priceRon) && Number.isFinite(medianPriceRon) && medianPriceRon > 0) {
    const ratio = item.priceRon / medianPriceRon;
    if (ratio < 0.45) {
      flags.push({ code: "very_low_price", label: "preț neobișnuit de mic", severity: "warning" });
    } else if (ratio > 1.35) {
      flags.push({ code: "high_price", label: "preț peste piață", severity: "warning" });
    }
  }
  if (!item.imageUrl && !item.image && !item.thumbnailUrl && !item.images?.length && !item.imageUrls?.length) {
    flags.push({ code: "no_image", label: "fără poză", severity: "warning" });
  }
  const phoneSpecs = extractPhoneSpecs(item);
  if (phoneSpecs?.lockedRisk) {
    flags.push({ code: "phone_locked", label: "risc iCloud/SIM lock", severity: "bad" });
  }
  if (phoneSpecs?.cracked) {
    flags.push({ code: "phone_damage", label: "posibil ecran/carcasa spartă", severity: "bad" });
  }
  if (Number.isFinite(phoneSpecs?.batteryHealthPct) && phoneSpecs.batteryHealthPct < 80) {
    flags.push({ code: "low_battery_health", label: "battery health sub 80%", severity: "warning" });
  }

  return flags;
}

function scoreRisk(flags) {
  return clampScore(100 - flags.reduce((sum, flag) => {
    if (flag.severity === "bad") {
      return sum + 35;
    }
    if (flag.severity === "warning") {
      return sum + 18;
    }
    return sum + 8;
  }, 0));
}

function buildDealQuality(item, medianPriceRon, condition) {
  const riskFlags = item.riskFlags || buildRiskFlags(item, medianPriceRon);
  const productMatch = clampScore(Number.isFinite(item.relevanceScore) ? item.relevanceScore : 50);
  const price = clampScore(priceValueScore(item.priceRon, medianPriceRon));
  const conditionScore =
    condition === "any" ? 70 :
    matchesCondition(item, condition) ? 100 :
    25;
  const freshness = clampScore(Math.min(100, recencyScore(item.postedAt) * 5));
  const risk = scoreRisk(riskFlags);
  const score = clampScore(
    (productMatch * 0.34) +
    (price * 0.26) +
    (conditionScore * 0.14) +
    (freshness * 0.10) +
    (risk * 0.16)
  );
  const label =
    score >= 86 ? "deal foarte bun" :
    score >= 72 ? "deal bun" :
    score >= 55 ? "verifică detaliile" :
    "risc ridicat";

  return {
    score,
    label,
    productMatch,
    price,
    condition: clampScore(conditionScore),
    freshness,
    risk,
    reasons: [
      `potrivire produs ${productMatch}%`,
      `preț ${price}%`,
      `risc ${risk}%`
    ]
  };
}

function buildWhyThisDeal(item) {
  const reasons = [];
  const priceInsight = item.priceInsight;
  const phoneSpecs = item.phoneSpecs;

  if (item.dealQuality?.productMatch >= 90) {
    reasons.push("Potrivire foarte bună cu produsul căutat.");
  } else if (item.dealQuality?.productMatch >= 70) {
    reasons.push("Potrivire bună cu termenii principali.");
  }
  if (priceInsight?.priceDeltaPct !== null && Number.isFinite(priceInsight?.priceDeltaPct)) {
    if (priceInsight.priceDeltaPct < -10) {
      reasons.push(`Preț cu ${Math.abs(priceInsight.priceDeltaPct)}% sub mediana rezultatelor.`);
    } else if (priceInsight.priceDeltaPct > 15) {
      reasons.push(`Preț cu ${priceInsight.priceDeltaPct}% peste mediana rezultatelor.`);
    } else {
      reasons.push("Preț în zona pieței pentru rezultatele găsite.");
    }
  }
  if (item.dealQuality?.risk >= 80) {
    reasons.push("Nu apar semnale majore de risc în titlu sau metadate.");
  } else if (item.riskFlags?.length) {
    reasons.push(`Verifică: ${item.riskFlags.slice(0, 2).map((flag) => flag.label).join(", ")}.`);
  }
  if (phoneSpecs?.storageGb) {
    reasons.push(`Storage detectat: ${phoneSpecs.storageGb}GB.`);
  }
  if (phoneSpecs?.batteryHealthPct) {
    reasons.push(`Battery health detectat: ${phoneSpecs.batteryHealthPct}%.`);
  }
  if (phoneSpecs?.warranty || phoneSpecs?.invoice) {
    reasons.push([phoneSpecs.warranty ? "garanție" : null, phoneSpecs.invoice ? "factură" : null].filter(Boolean).join(" + "));
  }
  if (recencyScore(item.postedAt) >= 14) {
    reasons.push("Anunț recent.");
  }

  return reasons.slice(0, 6);
}

function safePriceForTieBreak(priceRon) {
  return Number.isFinite(priceRon) ? priceRon : Number.POSITIVE_INFINITY;
}

function itemRankKey(item) {
  return item.url || `${item.site || ""}::${item.title || ""}::${item.price || ""}::${item.location || ""}`;
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
  const relevance = Number.isFinite(item.relevanceScore) ? item.relevanceScore : 60;

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

  let score = Math.round(relevance * 0.62);
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
  if (item.keywordSignals?.missingKeywords?.length) {
    score -= Math.min(35, item.keywordSignals.missingKeywords.length * 12);
  }
  if (item.keywordSignals?.negativeKeywords?.length) {
    score -= Math.min(35, item.keywordSignals.negativeKeywords.length * 10);
  }
  if (item.keywordSignals?.variantMismatch) {
    score -= 30;
  }
  if (item.listingType === "accessory") {
    score -= 20;
  } else if (item.listingType === "spare_part" || item.listingType === "broken_or_for_parts" || item.listingType === "wanted" || item.listingType === "service") {
    score -= 35;
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
  if ((item.rejectionReasons || []).some((reason) => reason.startsWith("variant_mismatch:"))) {
    score -= 25;
  }
  if (item.listingType === "broken_or_for_parts" || item.listingType === "spare_part") {
    score -= 30;
  }

  return Math.max(0, Math.min(100, score));
}

function enrichItemWithDealIntelligence(item, medianPriceRon, condition) {
  const priceInsight = buildPriceInsight(item, medianPriceRon);
  const phoneSpecs = extractPhoneSpecs(item);
  const riskFlags = buildRiskFlags(item, medianPriceRon);
  const dealQuality = buildDealQuality({ ...item, riskFlags }, medianPriceRon, condition);
  const enrichedItem = {
    ...item,
    priceInsight,
    riskFlags,
    dealQuality,
    phoneSpecs
  };

  return {
    ...enrichedItem,
    whyThisDeal: buildWhyThisDeal(enrichedItem)
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

function isBlockedMarketplaceResult(result) {
  const messages = [
    result?.error,
    ...(Array.isArray(result?.previousErrors) ? result.previousErrors : []),
    ...(Array.isArray(result?.providerFallbacks)
      ? result.providerFallbacks.map((fallback) => fallback?.reason)
      : [])
  ]
    .filter(Boolean)
    .join(" ");

  return /cloudflare challenge|anti-bot|blocked/i.test(messages);
}

export function aggregateMarketplaceResults(results, { condition = "any", creditBudget = null, creditsUsed = null } = {}) {
  const normalizedResults = results.map((result) => {
    if (!result.ok) {
      return result;
    }

    const parsedItemCount = Number.isFinite(result.rawItemCount)
      ? result.rawItemCount
      : result.itemCount ?? result.items.length;
    const matchedItemCount = result.itemCount ?? result.items.length;
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
      rawItemCount: parsedItemCount,
      parsedItemCount,
      matchedItemCount,
      includedItemCount: scoredItems.length,
      itemCount: scoredItems.length,
      items: scoredItems,
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
  const globalMedianPriceRon = median(allScoredItems.map((item) => item.priceRon).filter((value) => Number.isFinite(value)));
  const allBestCandidates = allScoredItems.map((item) => {
    const enrichedItem = enrichItemWithDealIntelligence(item, globalMedianPriceRon, condition);
    return {
      ...enrichedItem,
      recommendationScore: scoreGlobalRecommendation(enrichedItem, globalMedianPriceRon, condition)
    };
  });
  const rankedCandidates = allBestCandidates
    .sort((a, b) => {
      if (b.recommendationScore !== a.recommendationScore) {
        return b.recommendationScore - a.recommendationScore;
      }
      return safePriceForTieBreak(a.priceRon) - safePriceForTieBreak(b.priceRon);
    })
    .map((item, index) => ({
      ...item,
      rank: index + 1
    }));
  const rankByKey = new Map(rankedCandidates.map((item) => [itemRankKey(item), item]));
  const rankedResults = normalizedResults.map((result) => {
    if (!result.ok) {
      return result;
    }

    return {
      ...result,
      items: result.items
        .map((item) => rankByKey.get(itemRankKey({ ...item, site: result.site })) || item)
        .sort((a, b) => {
          const aRank = Number.isFinite(a.rank) ? a.rank : Number.POSITIVE_INFINITY;
          const bRank = Number.isFinite(b.rank) ? b.rank : Number.POSITIVE_INFINITY;
          return aRank - bRank;
        })
    };
  });
  const bestOffer = rankedCandidates[0] || null;
  const recommendedOffers = pickTopRecommendationsByMarketplace(rankedCandidates);
  const successfulResults = normalizedResults.filter((result) => result.ok);
  const failedResults = normalizedResults.filter((result) => !result.ok);
  const parsedListings = successfulResults.reduce((sum, result) => sum + (result.parsedItemCount ?? result.rawItemCount ?? 0), 0);
  const matchedListings = successfulResults.reduce((sum, result) => sum + (result.matchedItemCount ?? result.itemCount ?? 0), 0);
  const includedListings = successfulResults.reduce((sum, result) => sum + result.items.length, 0);
  const excludedListings = successfulResults.reduce((sum, result) => sum + (result.excludedItemCount || 0), 0);
  const priceIntelligence = {
    medianRon: Number.isFinite(globalMedianPriceRon) ? Math.round(globalMedianPriceRon) : null,
    fairLowRon: Number.isFinite(globalMedianPriceRon) ? Math.round(globalMedianPriceRon * 0.75) : null,
    fairHighRon: Number.isFinite(globalMedianPriceRon) ? Math.round(globalMedianPriceRon * 1.15) : null,
    pricedListingsRon: allPricedItems.length
  };

  return {
    results: rankedResults,
    bestOffer,
    summary: {
      searchedAt: new Date().toISOString(),
      condition,
      conditionLabel: condition === "new" ? "Nou" : condition === "used" ? "Folosit" : "Oricare",
      creditBudget,
      creditsUsed,
      marketplaces: normalizedResults.length,
      successfulMarketplaces: successfulResults.length,
      failedMarketplaces: failedResults.map((result) => ({
        site: result.site,
        provider: result.provider,
        error: result.error || "Marketplace search failed."
      })),
      blockedMarketplaces: failedResults
        .filter(isBlockedMarketplaceResult)
        .map((result) => result.site),
      parsedListings,
      matchedListings,
      includedListings,
      excludedListings,
      totalListings: includedListings,
      pricedListingsRon: allPricedItems.length,
      averagePriceRon,
      priceIntelligence,
      bestOffer,
      recommendedOffers
    }
  };
}
