export type ApiListing = {
  title?: string;
  price?: number | string | null;
  priceRon?: number | string | null;
  numericPrice?: number | string | null;
  currency?: string | null;
  site?: string;
  condition?: string;
  location?: string;
  postedAt?: string;
  imageUrl?: string;
  image?: string;
  imageUrls?: string[];
  images?: Array<string | { url?: string; src?: string }>;
  thumbnailUrl?: string;
  url?: string;
  rank?: number;
  offerScore?: number;
  recommendationScore?: number;
  dealQuality?: {
    score?: number;
    label?: string;
    productMatch?: number;
    price?: number;
    condition?: number;
    freshness?: number;
    risk?: number;
    reasons?: string[];
  };
  riskFlags?: Array<{
    code?: string;
    label?: string;
    severity?: string;
  }>;
  priceInsight?: {
    label?: string;
    severity?: string;
    marketMedianRon?: number | null;
    fairLowRon?: number | null;
    fairHighRon?: number | null;
    priceDeltaPct?: number | null;
  };
  phoneSpecs?: {
    isPhone?: boolean;
    brand?: string | null;
    model?: string | null;
    variant?: string | null;
    storageGb?: number | null;
    batteryHealthPct?: number | null;
    warranty?: boolean;
    invoice?: boolean;
    lockedRisk?: boolean;
    neverlocked?: boolean;
    refurbished?: boolean;
    serviceHistory?: boolean;
    cracked?: boolean;
    conditionSignals?: string[];
  } | null;
  whyThisDeal?: string[];
  relevanceScore?: number;
  listingType?: string;
  queryType?: string;
  rejectionReasons?: string[];
  keywordSignals?: {
    queryKeywords?: string[];
    expandedKeywords?: string[];
    brandKeywords?: string[];
    matchedKeywords?: string[];
    matchedTitleKeywords?: string[];
    missingKeywords?: string[];
    negativeKeywords?: string[];
    variantMismatch?: string | null;
  };
};

export type ApiResult = {
  ok: boolean;
  site?: string;
  items?: ApiListing[];
  rawItemCount?: number;
  parsedItemCount?: number;
  matchedItemCount?: number;
  includedItemCount?: number;
  excludedItemCount?: number;
  error?: string;
};

export type SearchPayload = {
  results?: ApiResult[];
  summary?: {
    totalListings?: number;
    searchedAt?: string;
    marketplaces?: number;
    successfulMarketplaces?: number;
    parsedListings?: number;
    matchedListings?: number;
    includedListings?: number;
    excludedListings?: number;
    blockedMarketplaces?: string[];
    failedMarketplaces?: Array<{ site?: string; provider?: string; error?: string }>;
    priceIntelligence?: {
      medianRon?: number | null;
      fairLowRon?: number | null;
      fairHighRon?: number | null;
      pricedListingsRon?: number;
    };
    bestOffer?: ApiListing | null;
  };
  error?: string;
};

export type SearchResultItem = {
  id: string;
  title: string;
  price: number | null;
  priceLabel: string;
  source: string;
  city: string;
  condition: string;
  daysAgo: number;
  postedDateLabel: string;
  image?: string;
  images: string[];
  url?: string;
  rank?: number;
  score: number;
  dealQuality: {
    score: number;
    label: string;
    productMatch: number;
    price: number;
    condition: number;
    freshness: number;
    risk: number;
    reasons: string[];
  };
  riskFlags: Array<{
    code: string;
    label: string;
    severity: string;
  }>;
  priceInsight: {
    label: string;
    severity: string;
    marketMedianRon: number | null;
    fairLowRon: number | null;
    fairHighRon: number | null;
    priceDeltaPct: number | null;
  };
  phoneSpecs: {
    isPhone: boolean;
    brand: string | null;
    model: string | null;
    variant: string | null;
    storageGb: number | null;
    batteryHealthPct: number | null;
    warranty: boolean;
    invoice: boolean;
    lockedRisk: boolean;
    neverlocked: boolean;
    refurbished: boolean;
    serviceHistory: boolean;
    cracked: boolean;
    conditionSignals: string[];
  } | null;
  whyThisDeal: string[];
  relevanceScore: number;
  listingType: string;
  queryType: string;
  rejectionReasons: string[];
  keywordSignals: {
    queryKeywords: string[];
    expandedKeywords: string[];
    brandKeywords: string[];
    matchedKeywords: string[];
    matchedTitleKeywords: string[];
    missingKeywords: string[];
    negativeKeywords: string[];
    variantMismatch: string | null;
  };
};

const platformLabels: Record<string, string> = {
  "anuntul.ro": "ANUNTUL",
  "autovit.ro": "AUTOVIT",
  "lajumate.ro": "LAJUMATE",
  "okazii.ro": "OKAZII",
  "olx.ro": "OLX",
  "publi24.ro": "PUBLI24",
  "vinted.ro": "VINTED",
};

export function mapSearchResults(payload: SearchPayload): SearchResultItem[] {
  const groups = (payload.results || [])
    .filter((result) => result.ok)
    .map((result) =>
      (result.items || []).map((item, index) => mapListing(item, item.site || result.site || "Marketplace", index))
    );

  return interleave(groups);
}

export function mapBestOffer(payload: SearchPayload, results: SearchResultItem[]): SearchResultItem | null {
  const bestOffer = payload.summary?.bestOffer;
  if (!bestOffer) return results[0] || null;

  const bestOfferUrl = bestOffer.url?.trim();
  if (bestOfferUrl) {
    const existingByUrl = results.find((product) => product.url === bestOfferUrl);
    if (existingByUrl) return existingByUrl;
  }

  const source = bestOffer.site || "Marketplace";
  const bestOfferTitle = bestOffer.title?.trim();
  if (bestOfferTitle) {
    const existingByTitleAndSite = results.find(
      (product) => product.title.trim() === bestOfferTitle && product.source === getPlatformLabel(source)
    );
    if (existingByTitleAndSite) return existingByTitleAndSite;
  }

  return mapListing(bestOffer, source, 0, "best-offer");
}

function mapListing(item: ApiListing, source: string, index: number, idPrefix?: string): SearchResultItem {
  const platform = getPlatformLabel(source);
  const url = item.url?.trim();
  const images = pickListingImages(item);
  const score = pickRecommendationScore(item);
  const priceRon = getPriceRon(item);

  return {
    id: url || `${idPrefix || platform}-${index}-${item.title || "listing"}`,
    title: item.title || "Anunț fără titlu",
    price: isFiniteNumber(priceRon) ? priceRon : null,
    priceLabel: formatPriceLabel(item, priceRon),
    source: platform,
    city: item.location || "România",
    condition: normalizeCondition(item.condition),
    daysAgo: estimateDaysAgo(item.postedAt),
    postedDateLabel: formatPostedDateLabel(item.postedAt),
    image: images[0],
    images,
    url: url || undefined,
    rank: typeof item.rank === "number" && Number.isFinite(item.rank) ? item.rank : undefined,
    score,
    dealQuality: normalizeDealQuality(item.dealQuality, score),
    riskFlags: normalizeRiskFlags(item.riskFlags),
    priceInsight: normalizePriceInsight(item.priceInsight),
    phoneSpecs: normalizePhoneSpecs(item.phoneSpecs),
    whyThisDeal: normalizeStringList(item.whyThisDeal),
    relevanceScore: pickRelevanceScore(item),
    listingType: item.listingType || "main_product",
    queryType: item.queryType || "main_product",
    rejectionReasons: Array.isArray(item.rejectionReasons) ? item.rejectionReasons : [],
    keywordSignals: normalizeKeywordSignals(item.keywordSignals),
  };
}

function normalizeScore(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : fallback;
}

function normalizeDealQuality(value: ApiListing["dealQuality"], fallbackScore: number): SearchResultItem["dealQuality"] {
  const score = normalizeScore(value?.score, fallbackScore);
  return {
    score,
    label: value?.label || (score >= 80 ? "deal bun" : "verifică detaliile"),
    productMatch: normalizeScore(value?.productMatch, score),
    price: normalizeScore(value?.price, 50),
    condition: normalizeScore(value?.condition, 70),
    freshness: normalizeScore(value?.freshness, 0),
    risk: normalizeScore(value?.risk, 70),
    reasons: normalizeStringList(value?.reasons),
  };
}

function normalizeRiskFlags(value: ApiListing["riskFlags"]): SearchResultItem["riskFlags"] {
  return Array.isArray(value)
    ? value
      .map((flag) => ({
        code: String(flag?.code || "").trim(),
        label: String(flag?.label || "").trim(),
        severity: String(flag?.severity || "neutral").trim(),
      }))
      .filter((flag) => flag.code && flag.label)
    : [];
}

function normalizePriceInsight(value: ApiListing["priceInsight"]): SearchResultItem["priceInsight"] {
  return {
    label: value?.label || "preț necunoscut",
    severity: value?.severity || "neutral",
    marketMedianRon: typeof value?.marketMedianRon === "number" && Number.isFinite(value.marketMedianRon) ? value.marketMedianRon : null,
    fairLowRon: typeof value?.fairLowRon === "number" && Number.isFinite(value.fairLowRon) ? value.fairLowRon : null,
    fairHighRon: typeof value?.fairHighRon === "number" && Number.isFinite(value.fairHighRon) ? value.fairHighRon : null,
    priceDeltaPct: typeof value?.priceDeltaPct === "number" && Number.isFinite(value.priceDeltaPct) ? value.priceDeltaPct : null,
  };
}

function normalizeNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizePhoneSpecs(value: ApiListing["phoneSpecs"]): SearchResultItem["phoneSpecs"] {
  if (!value?.isPhone) {
    return null;
  }

  return {
    isPhone: true,
    brand: normalizeNullableString(value.brand),
    model: normalizeNullableString(value.model),
    variant: normalizeNullableString(value.variant),
    storageGb: normalizeNullableNumber(value.storageGb),
    batteryHealthPct: normalizeNullableNumber(value.batteryHealthPct),
    warranty: Boolean(value.warranty),
    invoice: Boolean(value.invoice),
    lockedRisk: Boolean(value.lockedRisk),
    neverlocked: Boolean(value.neverlocked),
    refurbished: Boolean(value.refurbished),
    serviceHistory: Boolean(value.serviceHistory),
    cracked: Boolean(value.cracked),
    conditionSignals: normalizeStringList(value.conditionSignals),
  };
}

function normalizeStringList(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.map((entry) => String(entry || "").trim()).filter(Boolean))]
    : [];
}

function normalizeKeywordSignals(value: ApiListing["keywordSignals"]): SearchResultItem["keywordSignals"] {
  return {
    queryKeywords: normalizeStringList(value?.queryKeywords),
    expandedKeywords: normalizeStringList(value?.expandedKeywords),
    brandKeywords: normalizeStringList(value?.brandKeywords),
    matchedKeywords: normalizeStringList(value?.matchedKeywords),
    matchedTitleKeywords: normalizeStringList(value?.matchedTitleKeywords),
    missingKeywords: normalizeStringList(value?.missingKeywords),
    negativeKeywords: normalizeStringList(value?.negativeKeywords),
    variantMismatch: value?.variantMismatch ? String(value.variantMismatch) : null,
  };
}

function normalizeCurrency(value: number | string | null | undefined, priceText = "") {
  const raw = String(value || "").trim().toUpperCase();
  const text = priceText.toLowerCase();
  if (raw === "LEI" || raw === "LEU" || raw === "RON" || text.includes("lei") || text.includes("ron")) {
    return "RON";
  }
  if (raw === "€" || raw === "EUR" || text.includes("€") || text.includes("eur")) {
    return "EUR";
  }
  return raw || null;
}

function formatNumber(value: number) {
  return Number(value).toLocaleString("ro-RO", { maximumFractionDigits: 2 });
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getRawPriceText(item: ApiListing) {
  if (typeof item.price === "string" && item.price.trim()) {
    return item.price.trim();
  }
  if (typeof item.price === "number" && Number.isFinite(item.price)) {
    return formatNumber(item.price);
  }
  return "";
}

function getPriceRon(item: ApiListing) {
  const explicitPriceRon = parseApiNumber(item.priceRon);
  if (isFiniteNumber(explicitPriceRon)) {
    return explicitPriceRon;
  }

  const rawPrice = getRawPriceText(item);
  const currency = normalizeCurrency(item.currency, rawPrice);
  const numericPrice = parseApiNumber(item.numericPrice) ?? parseApiNumber(rawPrice);

  if (!isFiniteNumber(numericPrice)) {
    return null;
  }
  if (currency === "RON") {
    return numericPrice;
  }
  if (currency === "EUR") {
    return numericPrice * 5;
  }
  return null;
}

function formatPriceLabel(item: ApiListing, priceRon: number | null) {
  const rawPrice = getRawPriceText(item);
  const currency = normalizeCurrency(item.currency, rawPrice);
  const numericPrice = parseApiNumber(item.numericPrice) ?? parseApiNumber(rawPrice);

  if (rawPrice && (currency === "EUR" || /€|eur/i.test(rawPrice))) {
    return rawPrice;
  }
  if (currency === "EUR" && isFiniteNumber(numericPrice)) {
    return `${formatNumber(numericPrice)} EUR`;
  }
  if (isFiniteNumber(priceRon)) {
    return `${formatNumber(priceRon)} RON`;
  }
  if (rawPrice) {
    return rawPrice;
  }
  return "Preț n/a";
}

function parseApiNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(/\d[\d.,\s]*/);
  if (!match) {
    return null;
  }

  const compact = match[0].replace(/\s/g, "");
  const lastCommaIndex = compact.lastIndexOf(",");
  const lastDotIndex = compact.lastIndexOf(".");
  const decimalSeparator =
    lastCommaIndex >= 0 && lastDotIndex >= 0
      ? lastCommaIndex > lastDotIndex ? "," : "."
      : /[,.]\d{1,2}$/.test(compact)
        ? compact.at(-2) === "," || compact.at(-2) === "." ? compact.at(-2) : compact.at(-3)
        : null;
  const normalized = decimalSeparator
    ? `${compact.slice(0, compact.lastIndexOf(decimalSeparator)).replace(/[^\d]/g, "")}.${compact.slice(compact.lastIndexOf(decimalSeparator) + 1).replace(/[^\d]/g, "")}`
    : compact.replace(/[^\d]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickRecommendationScore(item: ApiListing) {
  if (typeof item.recommendationScore === "number" && Number.isFinite(item.recommendationScore)) {
    return Math.round(item.recommendationScore);
  }
  if (typeof item.offerScore === "number" && Number.isFinite(item.offerScore)) {
    return Math.round(item.offerScore);
  }
  if (typeof item.rank === "number" && Number.isFinite(item.rank)) {
    return Math.max(1, Math.min(100, 100 - item.rank));
  }
  return 50;
}

function pickRelevanceScore(item: ApiListing) {
  if (typeof item.relevanceScore === "number" && Number.isFinite(item.relevanceScore)) {
    return Math.round(item.relevanceScore);
  }
  return pickRecommendationScore(item);
}

function pickListingImages(item: ApiListing) {
  const rawCandidates: Array<string | undefined> = [
    item.imageUrl,
    item.image,
    item.thumbnailUrl,
    ...(item.imageUrls || []),
    ...((item.images || []).map((entry) =>
      typeof entry === "string" ? entry : entry?.url || entry?.src
    )),
  ];
  const candidates: string[] = [];
  const seen = new Set<string>();

  for (const candidate of rawCandidates) {
    const normalized = normalizeImageUrl(candidate, item.url);
    if (normalized && !seen.has(normalized)) {
      candidates.push(normalized);
      seen.add(normalized);
    }
  }

  return candidates;
}

function normalizeImageUrl(value?: string, listingUrl?: string) {
  const raw = value?.trim();
  if (!raw) return undefined;

  if (raw.startsWith("data:image/")) return raw;
  if (raw.startsWith("//")) return proxiedMarketplaceImage(`https:${raw}`);
  if (/^https?:\/\//i.test(raw)) return proxiedMarketplaceImage(raw);

  try {
    if (listingUrl && /^https?:\/\//i.test(listingUrl)) {
      return proxiedMarketplaceImage(new URL(raw, listingUrl).toString());
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function proxiedMarketplaceImage(value: string) {
  try {
    const url = unwrapOlxOptimizerUrl(new URL(value));
    if (isOlxCdnHost(url.hostname)) {
      return `/api/image?url=${encodeURIComponent(url.toString())}`;
    }
  } catch {
    return value;
  }

  return value;
}

function unwrapOlxOptimizerUrl(url: URL) {
  if (url.hostname !== "www.olx.ro" || url.pathname !== "/_next/image") {
    return url;
  }

  const nestedUrl = url.searchParams.get("url");
  if (!nestedUrl) {
    return url;
  }

  try {
    return new URL(nestedUrl);
  } catch {
    return url;
  }
}

function isOlxCdnHost(hostname = "") {
  const value = hostname.toLowerCase();
  return value === "olxcdn.com" || value.endsWith(".olxcdn.com");
}

function interleave<T>(groups: T[][]) {
  const items: T[] = [];
  const maxLength = Math.max(0, ...groups.map((group) => group.length));

  for (let index = 0; index < maxLength; index += 1) {
    for (const group of groups) {
      if (group[index]) items.push(group[index]);
    }
  }

  return items;
}

function getPlatformLabel(site: string) {
  return platformLabels[site] || site.toUpperCase();
}

function normalizeCondition(condition = "") {
  const value = condition.trim().toLowerCase();
  if (!value) return "acceptabil";
  if (value.includes("ca nou")) return "ca nou";
  if (value.includes("nou") || value.includes("new")) return "nou";
  if (value.includes("bun") || value.includes("used") || value.includes("utilizat") || value.includes("folosit")) {
    return "folosit";
  }
  if (value.includes("acceptabil")) return "acceptabil";
  return value;
}

function estimateDaysAgo(postedAt = "") {
  const parsed = parsePostedDate(postedAt);
  if (!parsed) return 0;
  return Math.max(0, daysBetweenLocalDates(new Date(), parsed));
}

function formatPostedDateLabel(postedAt = "") {
  const parsed = parsePostedDate(postedAt);
  if (!parsed) return "azi";
  if (daysBetweenLocalDates(new Date(), parsed) === 0) return "azi";
  return new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" }).format(parsed);
}

function parsePostedDate(postedAt = "") {
  const raw = postedAt.trim();
  const value = raw.toLowerCase();

  if (!value || value.includes("azi") || value.includes("reactualizat")) return new Date();
  if (value.includes("ieri")) return addDays(new Date(), -1);

  const relativeDayMatch = value.match(/(\d+)\s*(?:z|zi|zile)\b/);
  if (relativeDayMatch) {
    const relativeDays = Number.parseInt(relativeDayMatch[1], 10);
    if (Number.isFinite(relativeDays)) return addDays(new Date(), -relativeDays);
  }

  const dottedDateMatch = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dottedDateMatch) {
    const day = Number.parseInt(dottedDateMatch[1], 10);
    const month = Number.parseInt(dottedDateMatch[2], 10);
    const year = Number.parseInt(dottedDateMatch[3], 10);
    const parsed = new Date(year, month - 1, day);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function addDays(value: Date, deltaDays: number) {
  const result = new Date(value);
  result.setDate(result.getDate() + deltaDays);
  return result;
}

function daysBetweenLocalDates(a: Date, b: Date) {
  const startA = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const startB = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((startA.getTime() - startB.getTime()) / 86400000);
}
