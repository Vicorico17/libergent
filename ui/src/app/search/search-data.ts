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
        return {
          id: item.url || `${platform}-${index}-${item.title || "listing"}`,
          title: item.title || "Anunț fără titlu",
          price: Number.isFinite(item.priceRon) ? Math.round(Number(item.priceRon)) : null,
          platform,
          platformColor: platformColors[platform] || "#4F7CFF",
          condition: normalizeCondition(item.condition),
          location: item.location || "România",
          daysAgo: estimateDaysAgo(item.postedAt),
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

function estimateDaysAgo(postedAt = "") {
  const value = postedAt.toLowerCase();
  if (!value || value.includes("azi") || value.includes("reactualizat")) return 0;
  if (value.includes("ieri")) return 1;
  const number = Number.parseInt(value.match(/\d+/)?.[0] || "", 10);
  return Number.isFinite(number) ? number : 0;
}
