"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MascotSVG } from "@/components/MascotSVG";
import { SearchBar } from "@/components/SearchBar";
import { ProductCard, type Product } from "@/components/search/ProductCard";
import { SearchFilters, type Filters } from "@/components/search/SearchFilters";

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

const platformColors: Record<string, string> = {
  Autovit: "#E44911",
  Lajumate: "#EF7D00",
  Okazii: "#6D28D9",
  OLX: "#0047AB",
  Publi24: "#E84C0C",
  Vinted: "#09B1BA",
};

const platformLabels: Record<string, string> = {
  "autovit.ro": "Autovit",
  "lajumate.ro": "Lajumate",
  "okazii.ro": "Okazii",
  "olx.ro": "OLX",
  "publi24.ro": "Publi24",
  "vinted.ro": "Vinted",
};

const defaultFilters: Filters = {
  platforms: [],
  conditions: [],
  priceMin: "",
  priceMax: "",
  sort: "Relevanță",
};

type SearchClientProps = {
  query: string;
  initialProducts: Product[];
  initialError?: string;
  searchedAt?: string;
};

export function SearchClient({
  query,
  initialProducts,
  initialError = "",
  searchedAt = "",
}: SearchClientProps) {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const products = initialProducts;
  const error = initialError;

  const filtered = useMemo(() => products.filter((p) => {
    if (filters.platforms.length > 0 && !filters.platforms.includes(p.platform)) return false;
    if (filters.conditions.length > 0 && !filters.conditions.includes(p.condition)) return false;
    if (filters.priceMin && !hasPriceAtLeast(p.price, Number(filters.priceMin))) return false;
    if (filters.priceMax && !hasPriceAtMost(p.price, Number(filters.priceMax))) return false;
    return true;
  }).sort((a, b) => {
    const aPrice = a.price !== null && Number.isFinite(a.price) ? a.price : Number.POSITIVE_INFINITY;
    const bPrice = b.price !== null && Number.isFinite(b.price) ? b.price : Number.POSITIVE_INFINITY;
    if (filters.sort === "Preț crescător") return aPrice - bPrice;
    if (filters.sort === "Preț descrescător") return bPrice - aPrice;
    if (filters.sort === "Cel mai recent") return a.daysAgo - b.daysAgo;
    return 0;
  }), [filters, products]);

  const updatedLabel = searchedAt
    ? new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(searchedAt))
    : "în timp real";

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Search navbar */}
      <header className="bg-white border-b border-[#D9D9D9] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <MascotSVG size={28} />
            <span className="font-pixel text-[#111111] hidden sm:block" style={{ fontSize: "11px" }}>
              LiberGent
            </span>
          </Link>
          <SearchBar defaultValue={query} size="normal" className="flex-1 max-w-2xl" />
          <Link
            href="/auth"
            className="shrink-0 hidden sm:flex items-center px-4 py-2 rounded-lg bg-[#4F7CFF] text-white text-sm font-semibold hover:bg-[#3d6aec] transition-colors"
          >
            Cont
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Results meta */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-[#111111]">
              {query ? (
                <>
                  Rezultate pentru{" "}
                  <span className="text-[#4F7CFF]">„{query}”</span>
                </>
              ) : (
                "Toate produsele"
              )}
            </h1>
            <p className="text-sm text-[#6B6B6B] mt-0.5">{filtered.length} produse găsite</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#6B6B6B]">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-pulse" />
            Actualizat {updatedLabel}
          </div>
        </div>

        {/* Layout */}
        <div className="flex gap-6 items-start">
          <SearchFilters filters={filters} onChange={setFilters} />

          <div className="flex-1 min-w-0">
            {error ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <MascotSVG size={64} className="mb-4 opacity-30" />
                <p className="font-semibold text-[#111111] mb-1">Căutarea a eșuat</p>
                <p className="text-sm text-[#6B6B6B] max-w-md">{error}</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <MascotSVG size={64} className="mb-4 opacity-30" />
                <p className="font-semibold text-[#111111] mb-1">Niciun rezultat</p>
                <p className="text-sm text-[#6B6B6B]">Încearcă să ajustezi filtrele sau caută altceva.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export function mapProducts(payload: SearchPayload): Product[] {
  return (payload.results || [])
    .filter((result) => result.ok)
    .flatMap((result) =>
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

function hasPriceAtLeast(price: number | null, min: number) {
  return price !== null && Number.isFinite(price) && price >= min;
}

function hasPriceAtMost(price: number | null, max: number) {
  return price !== null && Number.isFinite(price) && price <= max;
}

function estimateDaysAgo(postedAt = "") {
  const value = postedAt.toLowerCase();
  if (!value || value.includes("azi") || value.includes("reactualizat")) return 0;
  if (value.includes("ieri")) return 1;
  const number = Number.parseInt(value.match(/\d+/)?.[0] || "", 10);
  return Number.isFinite(number) ? number : 0;
}
