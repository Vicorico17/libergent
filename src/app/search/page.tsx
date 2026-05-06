"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MascotSVG } from "@/components/MascotSVG";
import { SearchBar } from "@/components/SearchBar";
import { ProductCard, type Product } from "@/components/search/ProductCard";
import { SearchFilters, type Filters } from "@/components/search/SearchFilters";

const MOCK_PRODUCTS: Product[] = [
  { id: "1", title: "iPhone 14 Pro 256GB Deep Purple, baterie 91%", price: 3400, platform: "OLX", platformColor: "#0047AB", condition: "Ca nou", location: "București", daysAgo: 0 },
  { id: "2", title: "MacBook Air M2 13\" 8GB RAM 256GB SSD Space Gray", price: 4200, platform: "Vinted", platformColor: "#09B1BA", condition: "Bun", location: "Cluj-Napoca", daysAgo: 1 },
  { id: "3", title: "Samsung Galaxy S23 Ultra 256GB Phantom Black", price: 2800, platform: "Facebook Marketplace", platformColor: "#1877F2", condition: "Ca nou", location: "Timișoara", daysAgo: 0 },
  { id: "4", title: "iPad Air 5 256GB WiFi Blue", price: 1900, platform: "OLX", platformColor: "#0047AB", condition: "Bun", location: "Iași", daysAgo: 3 },
  { id: "5", title: "Sony WH-1000XM5 Noise Cancelling Headphones Black", price: 750, platform: "Vinted", platformColor: "#09B1BA", condition: "Ca nou", location: "Brașov", daysAgo: 2 },
  { id: "6", title: "Nintendo Switch OLED White + 3 jocuri", price: 1100, platform: "Publi24", platformColor: "#E84C0C", condition: "Bun", location: "Constanța", daysAgo: 5 },
  { id: "7", title: "Apple Watch Series 8 41mm Midnight", price: 1350, platform: "OLX", platformColor: "#0047AB", condition: "Ca nou", location: "Cluj-Napoca", daysAgo: 1 },
  { id: "8", title: "DJI Mini 3 Pro Drone + extra batteries", price: 2100, platform: "Facebook Marketplace", platformColor: "#1877F2", condition: "Bun", location: "București", daysAgo: 4 },
  { id: "9", title: "GoPro Hero 11 Black + accesorii", price: 980, platform: "Vinted", platformColor: "#09B1BA", condition: "Acceptabil", location: "Sibiu", daysAgo: 6 },
  { id: "10", title: "Logitech MX Master 3 Mouse Wireless", price: 220, platform: "OLX", platformColor: "#0047AB", condition: "Ca nou", location: "București", daysAgo: 0 },
  { id: "11", title: "Kindle Paperwhite 11th Gen 8GB Black", price: 380, platform: "Publi24", platformColor: "#E84C0C", condition: "Bun", location: "Oradea", daysAgo: 7 },
  { id: "12", title: "PS5 Digital Edition + 2 controllere", price: 1700, platform: "Facebook Marketplace", platformColor: "#1877F2", condition: "Bun", location: "Timișoara", daysAgo: 2 },
];

const defaultFilters: Filters = {
  platforms: [],
  conditions: [],
  priceMin: "",
  priceMax: "",
  sort: "Relevanță",
};

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const [filters, setFilters] = useState<Filters>(defaultFilters);

  const filtered = MOCK_PRODUCTS.filter((p) => {
    if (filters.platforms.length > 0 && !filters.platforms.includes(p.platform)) return false;
    if (filters.conditions.length > 0 && !filters.conditions.includes(p.condition)) return false;
    if (filters.priceMin && p.price < Number(filters.priceMin)) return false;
    if (filters.priceMax && p.price > Number(filters.priceMax)) return false;
    return true;
  }).sort((a, b) => {
    if (filters.sort === "Preț crescător") return a.price - b.price;
    if (filters.sort === "Preț descrescător") return b.price - a.price;
    if (filters.sort === "Cel mai recent") return a.daysAgo - b.daysAgo;
    return 0;
  });

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
                  <span className="text-[#4F7CFF]">„{query}"</span>
                </>
              ) : (
                "Toate produsele"
              )}
            </h1>
            <p className="text-sm text-[#6B6B6B] mt-0.5">
              {filtered.length} produse găsite
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#6B6B6B]">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-pulse" />
            Actualizat acum 2 min
          </div>
        </div>

        {/* Layout */}
        <div className="flex gap-6 items-start">
          <SearchFilters filters={filters} onChange={setFilters} />

          <div className="flex-1 min-w-0">
            {filtered.length === 0 ? (
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

export default function SearchPage() {
  return (
    <Suspense>
      <SearchResults />
    </Suspense>
  );
}
