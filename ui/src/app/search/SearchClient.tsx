"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MascotSVG } from "@/components/MascotSVG";
import { SearchBar } from "@/components/SearchBar";
import { ProductCard, type Product } from "@/components/search/ProductCard";
import { SearchFilters, type Filters } from "@/components/search/SearchFilters";
import { mapProducts, type SearchPayload } from "./search-data";

const defaultFilters: Filters = {
  platforms: [],
  conditions: [],
  priceMin: "",
  priceMax: "",
  sort: "Relevanță",
};

type SearchClientProps = {
  query: string;
  initialProducts?: Product[];
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
  const [products, setProducts] = useState<Product[]>(initialProducts || []);
  const [error, setError] = useState(initialError);
  const [updatedAt, setUpdatedAt] = useState(searchedAt);
  const [isLoading, setIsLoading] = useState(Boolean(query));

  useEffect(() => {
    const controller = new AbortController();

    async function runSearch() {
      if (!query) {
        setProducts([]);
        setError("");
        setUpdatedAt("");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          q: query,
          site: "default",
          provider: "auto",
          limit: "500",
        });
        const response = await fetch(`/api/search?${params.toString()}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as SearchPayload;

        if (!response.ok || payload.error) {
          setProducts([]);
          setError(payload.error || "Căutarea nu a putut fi finalizată.");
          setUpdatedAt("");
          return;
        }

        setProducts(mapProducts(payload).slice(0, 120));
        setUpdatedAt(payload.summary?.searchedAt || "");
      } catch (searchError) {
        if (controller.signal.aborted) return;
        setProducts([]);
        setError(searchError instanceof Error ? searchError.message : "Căutarea nu a putut fi finalizată.");
        setUpdatedAt("");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    runSearch();

    return () => controller.abort();
  }, [query]);

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

  const updatedLabel = updatedAt
    ? new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(updatedAt))
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
            href="/trends"
            className="shrink-0 hidden sm:flex items-center px-3 py-2 text-sm font-semibold text-[#6B6B6B] hover:text-[#111111] transition-colors"
          >
            Trenduri
          </Link>
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
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <MascotSVG size={64} className="mb-4 opacity-30" />
                <p className="font-semibold text-[#111111] mb-1">Se caută...</p>
                <p className="text-sm text-[#6B6B6B]">Verificăm marketplace-urile disponibile.</p>
              </div>
            ) : error ? (
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

function hasPriceAtLeast(price: number | null, min: number) {
  return price !== null && Number.isFinite(price) && price >= min;
}

function hasPriceAtMost(price: number | null, max: number) {
  return price !== null && Number.isFinite(price) && price <= max;
}
