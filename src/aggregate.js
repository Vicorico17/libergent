import { normalizeListing } from "./normalize.js";
import { classifyListingIntent, getQueryBrandTerms, tokenize } from "./relevance.js";
import { classifyMarketSegment } from "./market-segment.js";

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

function isNewProductSource(item = {}) {
  return classifyMarketSegment(item) === "retail";
}

function normalizeIdentityText(value = "") {
  return stripDiacritics(String(value || "").toLowerCase())
    .replace(/\b(?:apple|telefon|telefoane|mobile|smartphone|mobil|nou|sigilat|original)\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function roundedPriceBucket(value) {
  return Number.isFinite(value) ? String(Math.round(value / 10) * 10) : "no-price";
}

function dedupeCandidateKey(item = {}) {
  const normalizedTitle = normalizeIdentityText(item.title);
  if (!normalizedTitle) {
    return item.url || "";
  }

  if (isNewProductSource(item)) {
    return "new:" + normalizedTitle;
  }

  return [
    "used",
    normalizedTitle,
    roundedPriceBucket(item.priceRon),
    normalizeIdentityText(item.location || "")
  ].join(":");
}

function compareDuplicateCandidates(candidate, current) {
  if (!current) {
    return candidate;
  }

  const candidateScore = Number.isFinite(candidate.offerScore) ? candidate.offerScore : 0;
  const currentScore = Number.isFinite(current.offerScore) ? current.offerScore : 0;
  if (candidateScore !== currentScore) {
    return candidateScore > currentScore ? candidate : current;
  }

  const candidatePrice = safePriceForTieBreak(candidate.priceRon);
  const currentPrice = safePriceForTieBreak(current.priceRon);
  if (candidatePrice !== currentPrice) {
    return candidatePrice < currentPrice ? candidate : current;
  }

  const candidateHasImage = Boolean(candidate.imageUrl || candidate.image || candidate.thumbnailUrl || candidate.images?.length || candidate.imageUrls?.length);
  const currentHasImage = Boolean(current.imageUrl || current.image || current.thumbnailUrl || current.images?.length || current.imageUrls?.length);
  if (candidateHasImage !== currentHasImage) {
    return candidateHasImage ? candidate : current;
  }

  return current;
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

function hasListingImage(item = {}) {
  return Boolean(
    item.imageUrl ||
    item.image ||
    item.thumbnailUrl ||
    item.images?.length ||
    item.imageUrls?.length
  );
}

function hasMeaningfulValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return Boolean(normalized) && ![
    "necunoscut",
    "necunoscută",
    "nespecificat",
    "nespecificată",
    "românia"
  ].includes(normalized);
}

function buildEvidenceConfidence(item = {}) {
  const phoneSpecs = item.phoneSpecs || extractPhoneSpecs(item);
  const specificSignals = [
    phoneSpecs?.storageGb,
    phoneSpecs?.batteryHealthPct,
    phoneSpecs?.warranty,
    phoneSpecs?.invoice,
    phoneSpecs?.neverlocked,
    phoneSpecs?.conditionSignals?.length
  ].some(Boolean);
  const checks = [
    { key: "price", label: "preț", weight: 24, available: Number.isFinite(item.priceRon) && item.priceRon > 0 },
    { key: "image", label: "imagine", weight: 14, available: hasListingImage(item) },
    { key: "condition", label: "condiție", weight: 14, available: hasMeaningfulValue(item.condition) },
    { key: "postedAt", label: "data publicării", weight: 14, available: hasMeaningfulValue(item.postedAt) },
    { key: "location", label: "locație", weight: 12, available: hasMeaningfulValue(item.location) },
    { key: "sellerType", label: "tip seller", weight: 8, available: hasMeaningfulValue(item.sellerType) },
    { key: "url", label: "link direct", weight: 8, available: Boolean(item.url) },
    { key: "specifics", label: "specificații verificabile", weight: 6, available: specificSignals }
  ];
  const score = checks.reduce((sum, check) => sum + (check.available ? check.weight : 0), 0);

  return {
    score,
    label:
      score >= 75 ? "încredere ridicată" :
      score >= 50 ? "încredere medie" :
      "încredere limitată",
    available: checks.filter((check) => check.available).map((check) => check.label),
    missing: checks.filter((check) => !check.available).map((check) => check.label)
  };
}

function buildDealQuality(item, medianPriceRon, condition) {
  const riskFlags = item.riskFlags || buildRiskFlags(item, medianPriceRon);
  const evidenceConfidence = item.evidenceConfidence || buildEvidenceConfidence(item);
  const productMatch = clampScore(Number.isFinite(item.relevanceScore) ? item.relevanceScore : 50);
  const price = clampScore(priceValueScore(item.priceRon, medianPriceRon));
  const conditionScore =
    condition === "any" ? 70 :
    matchesCondition(item, condition) ? 100 :
    25;
  const freshness = clampScore(Math.min(100, recencyScore(item.postedAt) * 5));
  const risk = scoreRisk(riskFlags);
  const score = clampScore(
    (productMatch * 0.32) +
    (price * 0.22) +
    (conditionScore * 0.12) +
    (freshness * 0.08) +
    (risk * 0.16) +
    (evidenceConfidence.score * 0.10)
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
    confidence: evidenceConfidence.score,
    reasons: [
      `potrivire produs ${productMatch}%`,
      `preț ${price}%`,
      `risc ${risk}%`,
      `încredere date ${evidenceConfidence.score}%`
    ]
  };
}

function buildWhyThisDeal(item) {
  const reasons = [];
  const priceInsight = item.priceInsight;
  const phoneSpecs = item.phoneSpecs;
  const keywordSignals = item.keywordSignals || {};
  const matchedKeywords = Array.isArray(keywordSignals.matchedKeywords)
    ? keywordSignals.matchedKeywords
    : [];
  const missingKeywords = Array.isArray(keywordSignals.missingKeywords)
    ? keywordSignals.missingKeywords
    : [];

  if (matchedKeywords.length) {
    const visibleKeywords = matchedKeywords.slice(0, 5).join(", ");
    reasons.push(`Se potrivește prin: ${visibleKeywords}.`);
  }
  if (missingKeywords.length) {
    reasons.push(`De verificat, lipsesc: ${missingKeywords.slice(0, 3).join(", ")}.`);
  }

  if (item.dealQuality?.productMatch >= 90) {
    reasons.push("Potrivire foarte bună cu produsul căutat, fără nepotrivire critică detectată.");
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
  if (item.condition) reasons.push(`Condiție declarată: ${item.condition}.`);
  if (item.dealQuality?.risk >= 80 && item.riskFlags?.length === 0) {
    reasons.push("Nu apar semnale majore de risc în datele disponibile.");
  } else if (item.riskFlags?.length) {
    reasons.push(`Verifică: ${item.riskFlags.slice(0, 2).map((flag) => flag.label).join(", ")}.`);
  }
  const phoneEvidence = [
    phoneSpecs?.storageGb ? `storage ${phoneSpecs.storageGb}GB` : null,
    phoneSpecs?.batteryHealthPct ? `Battery health ${phoneSpecs.batteryHealthPct}%` : null
  ].filter(Boolean);
  if (phoneEvidence.length) {
    reasons.push(`Specificații detectate: ${phoneEvidence.join(" + ")}.`);
  }
  if (phoneSpecs?.warranty || phoneSpecs?.invoice) {
    reasons.push([phoneSpecs.warranty ? "garanție" : null, phoneSpecs.invoice ? "factură" : null].filter(Boolean).join(" + "));
  }
  if (recencyScore(item.postedAt) >= 14) {
    reasons.push("Anunț recent.");
  } else if (!item.postedAt) {
    reasons.push("Data publicării nu este disponibilă; verifică actualitatea anunțului.");
  }

  if (!Number.isFinite(item.priceRon)) {
    reasons.push("Prețul nu a putut fi comparat cu piața.");
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
  const risk = Number.isFinite(item.dealQuality?.risk)
    ? item.dealQuality.risk
    : scoreRisk(item.riskFlags || []);
  const confidence = Number.isFinite(item.evidenceConfidence?.score)
    ? item.evidenceConfidence.score
    : buildEvidenceConfidence(item).score;
  const conditionScore =
    condition === "any" ? 70 :
    matchesCondition(item, condition) ? 100 :
    25;

  let score = Math.round(
    (relevance * 0.38) +
    (value * 0.20) +
    (freshness * 0.08) +
    (conditionScore * 0.10) +
    (risk * 0.14) +
    (confidence * 0.10)
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
  if (!Number.isFinite(item.priceRon)) {
    score -= 10;
  }
  if (item.riskFlags?.some((flag) => flag.code === "very_low_price")) {
    score -= 18;
  }
  if (item.riskFlags?.some((flag) => flag.severity === "bad")) {
    score -= 22;
  }

  return Math.max(0, Math.min(100, score));
}

function enrichItemWithDealIntelligence(item, medianPriceRon, condition) {
  const priceInsight = buildPriceInsight(item, medianPriceRon);
  const phoneSpecs = extractPhoneSpecs(item);
  const riskFlags = buildRiskFlags(item, medianPriceRon);
  const evidenceConfidence = buildEvidenceConfidence({ ...item, phoneSpecs });
  const dealQuality = buildDealQuality({ ...item, riskFlags, phoneSpecs, evidenceConfidence }, medianPriceRon, condition);
  const enrichedItem = {
    ...item,
    priceInsight,
    riskFlags,
    dealQuality,
    phoneSpecs,
    evidenceConfidence
  };

  return {
    ...enrichedItem,
    whyThisDeal: buildWhyThisDeal(enrichedItem)
  };
}

function buildRecommendationExplanation(item, comparisonPool) {
  const pricedPool = comparisonPool.filter((candidate) => Number.isFinite(candidate.priceRon) && candidate.priceRon > 0);
  const marketplaceCount = new Set(comparisonPool.map((candidate) => candidate.site).filter(Boolean)).size;
  const segmentRank = comparisonPool.findIndex((candidate) => itemRankKey(candidate) === itemRankKey(item)) + 1;
  const confidence = item.evidenceConfidence || buildEvidenceConfidence(item);
  const reasons = [];
  const cautions = [];

  if (item.dealQuality?.productMatch >= 90 && !item.keywordSignals?.missingKeywords?.length) {
    reasons.push(`Potrivire exactă cu produsul căutat (${item.dealQuality.productMatch}%), fără termeni esențiali lipsă.`);
  } else {
    reasons.push(`Potrivire cu produsul căutat: ${item.dealQuality?.productMatch ?? item.relevanceScore ?? 0}%.`);
  }

  if (
    Number.isFinite(item.priceRon) &&
    Number.isFinite(item.priceInsight?.marketMedianRon) &&
    pricedPool.length >= 3
  ) {
    const delta = item.priceInsight.priceDeltaPct;
    const comparison =
      delta < 0 ? `${Math.abs(delta)}% sub` :
      delta > 0 ? `${delta}% peste` :
      "la nivelul";
    reasons.push(
      `Prețul de ${Math.round(item.priceRon).toLocaleString("ro-RO")} RON este ${comparison} medianei de ${Math.round(item.priceInsight.marketMedianRon).toLocaleString("ro-RO")} RON, calculată din ${pricedPool.length} oferte comparabile.`
    );
  } else if (Number.isFinite(item.priceRon)) {
    reasons.push(`Are preț verificabil (${Math.round(item.priceRon).toLocaleString("ro-RO")} RON), dar eșantionul de comparație este încă mic.`);
  }

  if (item.riskFlags?.length === 0) {
    reasons.push("Nu am detectat termeni de defect, variantă greșită sau preț suspect în datele disponibile.");
  }
  if (hasMeaningfulValue(item.condition)) {
    reasons.push(`Condiție declarată: ${item.condition}.`);
  }
  if (recencyScore(item.postedAt) >= 14) {
    reasons.push(`Anunț recent: ${item.postedAt}.`);
  }
  if (confidence.available.length) {
    reasons.push(`Recomandarea se bazează pe: ${confidence.available.slice(0, 5).join(", ")}.`);
  }

  if (item.riskFlags?.length) {
    cautions.push(`Verifică înainte de contact: ${item.riskFlags.slice(0, 3).map((flag) => flag.label).join(", ")}.`);
  }
  if (confidence.missing.length) {
    cautions.push(`Date încă lipsă: ${confidence.missing.slice(0, 4).join(", ")}.`);
  }
  if (pricedPool.length < 3) {
    cautions.push("Comparația de preț are mai puțin de 3 oferte și trebuie tratată ca orientativă.");
  }

  const hasSevereRisk = item.riskFlags?.some((flag) => flag.severity === "bad");
  const strong = (
    segmentRank === 1 &&
    comparisonPool.length >= 2 &&
    confidence.score >= 55 &&
    item.dealQuality?.productMatch >= 80 &&
    !hasSevereRisk
  );
  const summary =
    strong && confidence.score >= 75
      ? `Cea mai echilibrată ofertă dintre ${comparisonPool.length} rezultate comparabile de pe ${marketplaceCount} marketplace-uri.`
      : strong
        ? `Cel mai bun compromis găsit între potrivire, preț și risc, dintre ${comparisonPool.length} rezultate comparabile.`
        : `Cea mai bună opțiune din datele disponibile, dar recomandarea are nevoie de verificări suplimentare.`;

  return {
    strong,
    summary,
    confidenceScore: confidence.score,
    confidenceLabel: confidence.label,
    comparedListings: comparisonPool.length,
    comparedMarketplaces: marketplaceCount,
    reasons: reasons.slice(0, 5),
    cautions: cautions.slice(0, 3)
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

function getCandidateDuplicateKey(item = {}) {
  if (isNewProductSource(item)) {
    return dedupeCandidateKey(item);
  }

  return item.url ? "url:" + item.url : dedupeCandidateKey(item);
}

function dedupeNormalizedResults(results) {
  const bestByDuplicateKey = new Map();
  let originalItemCount = 0;

  for (const result of results) {
    if (!result.ok) {
      continue;
    }

    for (const item of result.items) {
      originalItemCount += 1;
      const itemWithSite = { ...item, site: result.site };
      const duplicateKey = getCandidateDuplicateKey(itemWithSite);
      if (!duplicateKey) {
        continue;
      }
      bestByDuplicateKey.set(
        duplicateKey,
        compareDuplicateCandidates(itemWithSite, bestByDuplicateKey.get(duplicateKey))
      );
    }
  }

  const survivorKeys = new Set(
    [...bestByDuplicateKey.values()].map((item) => itemRankKey(item))
  );
  const dedupedResults = results.map((result) => {
    if (!result.ok) {
      return result;
    }

    const items = result.items.filter((item) => survivorKeys.has(itemRankKey({ ...item, site: result.site })));
    return {
      ...result,
      includedItemCount: items.length,
      itemCount: items.length,
      items
    };
  });
  const dedupedItemCount = dedupedResults
    .filter((result) => result.ok)
    .reduce((sum, result) => sum + result.items.length, 0);

  return {
    results: dedupedResults,
    duplicateListings: Math.max(0, originalItemCount - dedupedItemCount)
  };
}

function getReferenceMedianForItem(item, { usedMedianPriceRon, newMedianPriceRon, globalMedianPriceRon }) {
  if (isNewProductSource(item)) {
    return Number.isFinite(newMedianPriceRon) ? newMedianPriceRon : globalMedianPriceRon;
  }
  return Number.isFinite(usedMedianPriceRon) ? usedMedianPriceRon : globalMedianPriceRon;
}

function buildPriceIntelligence({ usedMedianPriceRon, newMedianPriceRon, globalMedianPriceRon, usedPricedItems, newPricedItems, allPricedItems, bestUsedOffer, bestNewBenchmark }) {
  const benchmarkPriceRon = Number.isFinite(bestNewBenchmark?.priceRon) ? bestNewBenchmark.priceRon : null;
  const usedBestPriceRon = Number.isFinite(bestUsedOffer?.priceRon) ? bestUsedOffer.priceRon : null;
  const savingsVsNewPct = Number.isFinite(usedBestPriceRon) && Number.isFinite(benchmarkPriceRon) && benchmarkPriceRon > 0
    ? Math.round((1 - (usedBestPriceRon / benchmarkPriceRon)) * 100)
    : null;
  const primaryMedian = Number.isFinite(usedMedianPriceRon) ? usedMedianPriceRon : globalMedianPriceRon;

  return {
    medianRon: Number.isFinite(primaryMedian) ? Math.round(primaryMedian) : null,
    fairLowRon: Number.isFinite(primaryMedian) ? Math.round(primaryMedian * 0.75) : null,
    fairHighRon: Number.isFinite(primaryMedian) ? Math.round(primaryMedian * 1.15) : null,
    pricedListingsRon: allPricedItems.length,
    usedMedianRon: Number.isFinite(usedMedianPriceRon) ? Math.round(usedMedianPriceRon) : null,
    usedFairLowRon: Number.isFinite(usedMedianPriceRon) ? Math.round(usedMedianPriceRon * 0.75) : null,
    usedFairHighRon: Number.isFinite(usedMedianPriceRon) ? Math.round(usedMedianPriceRon * 1.15) : null,
    usedPricedListingsRon: usedPricedItems.length,
    newMedianRon: Number.isFinite(newMedianPriceRon) ? Math.round(newMedianPriceRon) : null,
    newLowestRon: Number.isFinite(benchmarkPriceRon) ? Math.round(benchmarkPriceRon) : null,
    newPricedListingsRon: newPricedItems.length,
    savingsVsNewPct
  };
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
    const queryMismatchItemCount = Math.max(0, parsedItemCount - matchedItemCount);
    const classifiedItems = sortItemsByFreshness(
      result.items
        .map(normalizeListing)
        .map((item) => ({ ...item, marketType: classifyMarketSegment(item) }))
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
    const pricedItems = items.filter((item) => Number.isFinite(item.priceRon) && item.priceRon > 0);
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
      queryMismatchItemCount,
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

  const { results: dedupedResults, duplicateListings } = dedupeNormalizedResults(normalizedResults);
  const allPricedItems = dedupedResults
    .filter((result) => result.ok)
    .flatMap((result) => result.items)
    .filter((item) => Number.isFinite(item.priceRon) && item.priceRon > 0);
  const allScoredItems = dedupedResults
    .filter((result) => result.ok)
    .flatMap((result) => result.items.map((item) => ({
      ...item,
      site: result.site
    })));
  const usedPricedItems = allPricedItems.filter((item) => item.marketType === "secondary");
  const newPricedItems = allPricedItems.filter((item) => item.marketType === "retail");
  const mixedPricedItems = allPricedItems.filter((item) => item.marketType === "mixed");

  const averagePriceRon = allPricedItems.length
    ? allPricedItems.reduce((sum, item) => sum + item.priceRon, 0) / allPricedItems.length
    : null;
  const globalMedianPriceRon = median(allPricedItems.map((item) => item.priceRon));
  const usedMedianPriceRon = median(usedPricedItems.map((item) => item.priceRon));
  const newMedianPriceRon = median(newPricedItems.map((item) => item.priceRon));
  const medianContext = { usedMedianPriceRon, newMedianPriceRon, globalMedianPriceRon };
  const allBestCandidates = allScoredItems.map((item) => {
    const referenceMedianRon = getReferenceMedianForItem(item, medianContext);
    const enrichedItem = enrichItemWithDealIntelligence(item, referenceMedianRon, condition);
    return {
      ...enrichedItem,
      recommendationScore: scoreGlobalRecommendation(enrichedItem, referenceMedianRon, condition)
    };
  });
  const rankedBaseCandidates = allBestCandidates
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
  const rankedCandidates = rankedBaseCandidates.map((item) => {
    const comparisonPool = rankedBaseCandidates.filter(
      (candidate) => isNewProductSource(candidate) === isNewProductSource(item)
    );
    const recommendation = buildRecommendationExplanation(item, comparisonPool);
    return {
      ...item,
      recommendation,
      whyThisDeal: [
        ...recommendation.reasons,
        ...item.whyThisDeal
      ].filter((reason, index, reasons) => reasons.indexOf(reason) === index).slice(0, 10)
    };
  });
  const rankByKey = new Map(rankedCandidates.map((item) => [itemRankKey(item), item]));
  const rankedResults = dedupedResults.map((result) => {
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
  const bestUsedOffer = rankedCandidates.find((item) => !isNewProductSource(item)) || null;
  const bestNewBenchmark = rankedCandidates
    .filter((item) => isNewProductSource(item))
    .sort((a, b) => safePriceForTieBreak(a.priceRon) - safePriceForTieBreak(b.priceRon) || b.recommendationScore - a.recommendationScore)[0] || null;
  const recommendedOffers = pickTopRecommendationsByMarketplace(rankedCandidates);
  const successfulResults = rankedResults.filter((result) => result.ok);
  const failedResults = rankedResults.filter((result) => !result.ok);
  const parsedListings = successfulResults.reduce((sum, result) => sum + (result.parsedItemCount ?? result.rawItemCount ?? 0), 0);
  const matchedListings = successfulResults.reduce((sum, result) => sum + (result.matchedItemCount ?? result.itemCount ?? 0), 0);
  const queryMismatchListings = successfulResults.reduce((sum, result) => sum + (result.queryMismatchItemCount || 0), 0);
  const includedListings = successfulResults.reduce((sum, result) => sum + result.items.length, 0);
  const excludedListings = successfulResults.reduce((sum, result) => sum + (result.excludedItemCount || 0), 0);
  const priceIntelligence = buildPriceIntelligence({
    usedMedianPriceRon,
    newMedianPriceRon,
    globalMedianPriceRon,
    usedPricedItems,
    newPricedItems,
    allPricedItems,
    bestUsedOffer,
    bestNewBenchmark
  });

  return {
    results: rankedResults,
    bestOffer,
    summary: {
      searchedAt: new Date().toISOString(),
      condition,
      conditionLabel: condition === "new" ? "Nou" : condition === "used" ? "Folosit" : "Oricare",
      creditBudget,
      creditsUsed,
      marketplaces: rankedResults.length,
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
      queryMismatchListings,
      includedListings,
      excludedListings,
      duplicateListings,
      totalListings: includedListings,
    pricedListingsRon: allPricedItems.length,
    secondaryMarketListingsRon: usedPricedItems.length,
    retailMarketListingsRon: newPricedItems.length,
    mixedMarketListingsRon: mixedPricedItems.length,
      averagePriceRon,
      priceIntelligence,
      bestOffer,
      bestUsedOffer,
      bestNewBenchmark,
      recommendedOffers
    }
  };
}
