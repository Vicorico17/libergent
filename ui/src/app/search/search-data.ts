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
  };
  error?: string;
};

const platformLabels: Record<string, string> = {
  "autovit.ro": "Autovit",
  "lajumate.ro": "Lajumate",
  "okazii.ro": "Okazii",
  "olx.ro": "OLX",
  "publi24.ro": "Publi24",
  "vinted.ro": "Vinted",
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
          url: item.url || undefined,
        };
      })
    );

  return interleave(groups);
}

function pickListingImage(item: ApiListing) {
  const candidates: Array<string | undefined> = [
    item.imageUrl,
    item.image,
    item.thumbnailUrl,
    ...(item.imageUrls || []),
    ...((item.images || []).map((entry) =>
      typeof entry === "string" ? entry : entry?.url || entry?.src
    )),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeImageUrl(candidate, item.url);
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
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
    return `https:${raw}`;
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
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
