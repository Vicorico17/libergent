"use client";

import { useState } from "react";

const platforms = ["OLX", "Vinted", "Lajumate", "Okazii", "Publi24", "Autovit"];
const conditions = ["Nou", "Folosit", "Ca nou", "Bun", "Acceptabil"];
const sortOptions = ["Relevanță", "Preț crescător", "Preț descrescător", "Cel mai recent"];

interface Filters {
  platforms: string[];
  conditions: string[];
  priceMin: string;
  priceMax: string;
  sort: string;
}

interface SearchFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export type { Filters };

export function SearchFilters({ filters, onChange }: SearchFiltersProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const togglePlatform = (p: string) => {
    const next = filters.platforms.includes(p)
      ? filters.platforms.filter((x) => x !== p)
      : [...filters.platforms, p];
    onChange({ ...filters, platforms: next });
  };

  const toggleCondition = (c: string) => {
    const next = filters.conditions.includes(c)
      ? filters.conditions.filter((x) => x !== c)
      : [...filters.conditions, c];
    onChange({ ...filters, conditions: next });
  };

  const filterContent = (
    <div className="flex flex-col gap-6">
      {/* Sort */}
      <div>
        <p className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-widest mb-3">
          Sortare
        </p>
        <div className="flex flex-col gap-1.5">
          {sortOptions.map((opt) => (
            <button
              key={opt}
              onClick={() => onChange({ ...filters, sort: opt })}
              className={`text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                filters.sort === opt
                  ? "bg-[#4F7CFF] text-white font-medium"
                  : "text-[#111111] hover:bg-[#F8F9FA]"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Platforms */}
      <div>
        <p className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-widest mb-3">
          Platforme
        </p>
        <div className="flex flex-col gap-2">
          {platforms.map((p) => (
            <label key={p} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.platforms.includes(p)}
                onChange={() => togglePlatform(p)}
                className="w-4 h-4 rounded border-[#D9D9D9] accent-[#4F7CFF]"
              />
              <span className="text-sm text-[#111111] group-hover:text-[#4F7CFF] transition-colors">
                {p}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Price */}
      <div>
        <p className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-widest mb-3">
          Preț (RON)
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            value={filters.priceMin}
            onChange={(e) => onChange({ ...filters, priceMin: e.target.value })}
            className="w-full h-9 rounded-lg border border-[#D9D9D9] px-3 text-sm text-[#111111] outline-none focus:border-[#4F7CFF] transition-colors"
          />
          <span className="text-[#6B6B6B] text-sm shrink-0">—</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.priceMax}
            onChange={(e) => onChange({ ...filters, priceMax: e.target.value })}
            className="w-full h-9 rounded-lg border border-[#D9D9D9] px-3 text-sm text-[#111111] outline-none focus:border-[#4F7CFF] transition-colors"
          />
        </div>
      </div>

      {/* Condition */}
      <div>
        <p className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-widest mb-3">
          Stare
        </p>
        <div className="flex flex-col gap-2">
          {conditions.map((c) => (
            <label key={c} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.conditions.includes(c)}
                onChange={() => toggleCondition(c)}
                className="w-4 h-4 rounded border-[#D9D9D9] accent-[#4F7CFF]"
              />
              <span className="text-sm text-[#111111] group-hover:text-[#4F7CFF] transition-colors">
                {c}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Reset */}
      <button
        onClick={() =>
          onChange({ platforms: [], conditions: [], priceMin: "", priceMax: "", sort: "Relevanță" })
        }
        className="text-sm text-[#6B6B6B] hover:text-[#FF6B6B] transition-colors text-left"
      >
        Resetează filtrele
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile filter toggle */}
      <div className="lg:hidden mb-4">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex items-center gap-2 text-sm font-medium text-[#111111] border border-[#D9D9D9] px-4 py-2 rounded-xl hover:border-[#4F7CFF] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Filtre
          {(filters.platforms.length > 0 || filters.conditions.length > 0 || filters.priceMin || filters.priceMax) && (
            <span className="w-5 h-5 rounded-full bg-[#4F7CFF] text-white text-xs flex items-center justify-center">
              {filters.platforms.length + filters.conditions.length + (filters.priceMin || filters.priceMax ? 1 : 0)}
            </span>
          )}
        </button>
        {mobileOpen && (
          <div className="mt-3 bg-white rounded-2xl p-5 border border-[#D9D9D9]">
            {filterContent}
          </div>
        )}
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-56 shrink-0">
        <div
          className="bg-white rounded-2xl p-5 sticky top-20"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)" }}
        >
          {filterContent}
        </div>
      </aside>
    </>
  );
}
