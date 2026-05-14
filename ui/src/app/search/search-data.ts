import type { Product } from "@/components/search/ProductCard";

export type ApiListing = {
  title?: string;
  priceRon?: number | null;
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
};

export type ApiResult = {
  ok: boolean;
  site?: string;
  items?: ApiListing[];
};

export type SearchPayload = {
  results?: ApiResult[];
  summary?: {
    totalListings?: number;
    searchedAt?: string;
    bestOffer?: {
      title?: string;
      site?: string;
      priceRon?: number | null;
      condition?: string;
      location?: string;
      postedAt?: string;
      imageUrl?: string;
      image?: string;
      thumbnailUrl?: string;
      url?: string;
      rank?: number;
      offerScore?: number;
      recommendationScore?: number;
    } | null;
  };
  error?: string;
};

const platformLabels: Record<string, string> = {
  "autovit.ro": "Autovit",
  "lajumate.ro": "Lajumate",
  "okazii.ro": "Okazii",
  "olx.ro": "OLX",
  "olx.pl": "OLX",
  "publi24.ro": "Publi24",
  "vinted.ro": "Vinted",
  "vinted.pl": "Vinted",
};

const platformColors: Record<string, string> = {
  Autovit: "#E44911",
  Lajumate: "#EF7D00",
  Okazii: "#6D28D9",
  OLX: "#0047AB",
  Publi24: "#E84C0C",
  Vinted: "#09B1BA",
};

export function mapProducts(payload: SearchPayload): Product[] {
  const groups = (payload.results || [])
    .filter((result) => result.ok)
    .map((result) =>
      (result.items || []).map((item, index) => {
        const platform = getPlatformLabel(item.site || result.site || "Marketplace");
        return {
          id: item.url || `${platform}-${index}-${item.title || "listing"}`,
          title: item.title || "Anunț fără titlu",
          price: Number.isFinite(item.priceRon) ? Math.round(Number(item.priceRon)) : null,
          platform,
          platformColor: platformColors[platform] || "#4F7CFF",
          condition: normalizeCondition(item.condition),
          location: item.location || "România",
          daysAgo: estimateDaysAgo(item.postedAt),
          postedDateLabel: formatPostedDateLabel(item.postedAt),
          image: pickListingImage(item),
          images: pickListingImages(item),
          url: item.url || undefined,
          rank: typeof item.rank === "number" && Number.isFinite(item.rank) ? item.rank : undefined,
          recommendationScore: pickRecommendationScore(item),
        };
      })
    );

  return interleave(groups);
}

export function mapBestOffer(payload: SearchPayload, products: Product[]): Product | null {
  const bestOffer = payload.summary?.bestOffer;
  if (!bestOffer) return null;

  const bestOfferUrl = bestOffer.url?.trim();
  if (bestOfferUrl) {
    const existingByUrl = products.find((product) => product.url === bestOfferUrl);
    if (existingByUrl) return existingByUrl;
  }

  const bestOfferTitle = bestOffer.title?.trim();
  const bestOfferSite = getPlatformLabel(bestOffer.site || "Marketplace");
  if (bestOfferTitle) {
    const existingByTitleAndSite = products.find(
      (product) => product.title.trim() === bestOfferTitle && product.platform === bestOfferSite
    );
    if (existingByTitleAndSite) return existingByTitleAndSite;
  }

  const fallbackId = bestOfferUrl || `best-offer-${bestOfferSite}-${bestOfferTitle || "listing"}`;
  return {
    id: fallbackId,
    title: bestOfferTitle || "Anunț recomandat",
    price: Number.isFinite(bestOffer.priceRon) ? Math.round(Number(bestOffer.priceRon)) : null,
    platform: bestOfferSite,
    platformColor: platformColors[bestOfferSite] || "#4F7CFF",
    condition: normalizeCondition(bestOffer.condition),
    location: bestOffer.location || "România",
    daysAgo: estimateDaysAgo(bestOffer.postedAt),
    postedDateLabel: formatPostedDateLabel(bestOffer.postedAt),
    image: pickListingImage(bestOffer),
    images: pickListingImages(bestOffer),
    url: bestOfferUrl || undefined,
    rank: typeof bestOffer.rank === "number" && Number.isFinite(bestOffer.rank) ? bestOffer.rank : undefined,
    recommendationScore: pickRecommendationScore(bestOffer),
  };
}

function pickRecommendationScore(item: ApiListing) {
  if (typeof item.recommendationScore === "number" && Number.isFinite(item.recommendationScore)) {
    return item.recommendationScore;
  }
  if (typeof item.offerScore === "number" && Number.isFinite(item.offerScore)) {
    return item.offerScore;
  }
  return undefined;
}

function pickListingImage(item: ApiListing) {
  const candidates = collectListingImageCandidates(item);

  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }

  return undefined;
}

function pickListingImages(item: ApiListing) {
  return collectListingImageCandidates(item);
}

function collectListingImageCandidates(item: ApiListing) {
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
  if (!raw) {
    return undefined;
  }

  if (raw.startsWith("data:image/")) {
    return raw;
  }

  if (raw.startsWith("//")) {
    return proxiedMarketplaceImage(`https:${raw}`);
  }

  if (/^https?:\/\//i.test(raw)) {
    return proxiedMarketplaceImage(raw);
  }

  try {
    if (listingUrl && /^https?:\/\//i.test(listingUrl)) {
      return new URL(raw, listingUrl).toString();
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function proxiedMarketplaceImage(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname === "frankfurt.apollo.olxcdn.com" || url.hostname === "images.olxcdn.com") {
      return `/api/image?url=${encodeURIComponent(url.toString())}`;
    }
  } catch {
    return value;
  }

  return value;
}

function interleave<T>(groups: T[][]) {
  const items: T[] = [];
  const maxLength = Math.max(0, ...groups.map((group) => group.length));

  for (let index = 0; index < maxLength; index += 1) {
    for (const group of groups) {
      if (group[index]) {
        items.push(group[index]);
      }
    }
  }

  return items;
}

function getPlatformLabel(site: string) {
  return platformLabels[site] || site;
}

function normalizeCondition(condition = "") {
  const value = condition.trim().toLowerCase();
  if (!value) return "Acceptabil";
  if (value.includes("ca nou")) return "Ca nou";
  if (value.includes("nou") || value.includes("new")) return "Nou";
  if (value.includes("bun") || value.includes("used") || value.includes("utilizat")) return "Bun";
  return condition.trim();
}

function estimateDaysAgo(postedAt = "") {
  const parsed = parsePostedDate(postedAt);
  if (!parsed) return 0;
  return daysBetweenLocalDates(new Date(), parsed);
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

  if (!value || value.includes("azi") || value.includes("reactualizat")) {
    return new Date();
  }

  if (value.includes("ieri")) {
    return addDays(new Date(), -1);
  }

  const relativeDayMatch = value.match(/(\d+)\s*(?:z|zi|zile)\b/);
  if (relativeDayMatch) {
    const relativeDays = Number.parseInt(relativeDayMatch[1], 10);
    if (Number.isFinite(relativeDays)) {
      return addDays(new Date(), -relativeDays);
    }
  }

  const dottedDateMatch = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dottedDateMatch) {
    const day = Number.parseInt(dottedDateMatch[1], 10);
    const month = Number.parseInt(dottedDateMatch[2], 10);
    const year = Number.parseInt(dottedDateMatch[3], 10);
    const parsed = new Date(year, month - 1, day);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const fallback = new Date(raw);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback;
  }

  return null;
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
