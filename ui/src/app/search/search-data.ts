import type { Product } from "@/components/search/ProductCard";

export type ApiListing = {
  title?: string;
  priceRon?: number | null;
  site?: string;
  condition?: string;
  location?: string;
  postedAt?: string;
  imageUrl?: string;
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
        const { daysAgo, label: postedAtLabel } = normalizePostedAt(item.postedAt);
        return {
          id: item.url || `${platform}-${index}-${item.title || "listing"}`,
          title: item.title || "Anunț fără titlu",
          price: Number.isFinite(item.priceRon) ? Math.round(Number(item.priceRon)) : null,
          platform,
          platformColor: platformColors[platform] || "#4F7CFF",
          condition: normalizeCondition(item.condition),
          location: item.location || "România",
          daysAgo,
          postedAtLabel,
          image: item.imageUrl || undefined,
          url: item.url || undefined,
        };
      })
    );

  return interleave(groups);
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

const romanianMonths: Record<string, number> = {
  ian: 0,
  ianuarie: 0,
  feb: 1,
  februarie: 1,
  mar: 2,
  martie: 2,
  apr: 3,
  aprilie: 3,
  mai: 4,
  iun: 5,
  iunie: 5,
  iul: 6,
  iulie: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  septembrie: 8,
  oct: 9,
  octombrie: 9,
  nov: 10,
  noiembrie: 10,
  dec: 11,
  decembrie: 11,
};

function normalizePostedAt(postedAt = "") {
  const source = postedAt.trim();
  const lower = source.toLowerCase();

  if (!source || lower.includes("reactualizat")) {
    return { daysAgo: 0, label: "azi" };
  }
  if (lower.includes("azi") || lower.includes("astăzi")) {
    return { daysAgo: 0, label: "azi" };
  }
  if (lower.includes("ieri")) {
    return { daysAgo: 1, label: "ieri" };
  }
  const relativeDays = parseRelativeDays(lower);
  if (relativeDays !== null) {
    if (relativeDays > 3650) {
      return { daysAgo: 0, label: "azi" };
    }
    return {
      daysAgo: relativeDays,
      label: relativeDays === 0 ? "azi" : `acum ${relativeDays}z`,
    };
  }

  const parsed = parseRomanianDate(source) || parseDateWithMonthName(source) || parseIsoDate(source);
  if (!parsed) {
    return { daysAgo: 0, label: source };
  }

  const daysAgo = computeDaysAgo(parsed);
  const label = formatPostedAt(parsed);
  return { daysAgo, label };
}

function parseRelativeDays(value = "") {
  const match = value.match(/\b(?:acum\s*)?(\d{1,6})\s*(?:z|zi|zile)\b/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRomanianDate(value = "") {
  const match = value.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/);
  if (!match) return null;

  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10) - 1;
  const year = normalizeYear(match[3]) ?? new Date().getFullYear();
  const date = new Date(year, month, day);
  return isValidDate(date, year, month, day) ? date : null;
}

function parseDateWithMonthName(value = "") {
  const normalized = value
    .toLowerCase()
    .replace(/[,]/g, " ")
    .replace(/[.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const match = normalized.match(/\b(\d{1,2})\s+([a-zăâîșț]+)(?:\s+(\d{4}))?/i);
  if (!match) return null;

  const day = Number.parseInt(match[1], 10);
  const month = romanianMonths[match[2]];
  if (month === undefined) return null;

  const year = Number.parseInt(match[3] || "", 10) || new Date().getFullYear();
  const date = new Date(year, month, day);
  return isValidDate(date, year, month, day) ? date : null;
}

function parseIsoDate(value = "") {
  const match = value.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10) - 1;
  const day = Number.parseInt(match[3], 10);
  const date = new Date(year, month, day);
  return isValidDate(date, year, month, day) ? date : null;
}

function normalizeYear(rawYear?: string) {
  if (!rawYear) return null;
  const parsed = Number.parseInt(rawYear, 10);
  if (!Number.isFinite(parsed)) return null;
  if (rawYear.length === 2) return 2000 + parsed;
  return parsed;
}

function isValidDate(date: Date, year: number, month: number, day: number) {
  return (
    Number.isFinite(date.getTime()) &&
    date.getFullYear() === year &&
    date.getMonth() === month &&
    date.getDate() === day
  );
}

function computeDaysAgo(date: Date) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffMs = startToday.getTime() - startTarget.getTime();
  return diffMs > 0 ? Math.floor(diffMs / 86_400_000) : 0;
}

function formatPostedAt(date: Date) {
  const includeYear = date.getFullYear() !== new Date().getFullYear();
  return new Intl.DateTimeFormat("ro-RO", {
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(date);
}
