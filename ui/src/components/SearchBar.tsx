"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

interface SearchBarProps {
  defaultValue?: string;
  size?: "hero" | "normal";
  className?: string;
}

export function SearchBar({ defaultValue = "", size = "hero", className = "" }: SearchBarProps) {
  const [query, setQuery] = useState(defaultValue);
  const router = useRouter();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const isHero = size === "hero";

  return (
    <form onSubmit={handleSubmit} className={`flex items-center gap-0 ${className}`}>
      <div
        className={`flex items-center flex-1 bg-white rounded-l-2xl border border-r-0 border-[#D9D9D9] ${
          isHero ? "h-14 px-5 shadow-lg" : "h-11 px-4 shadow-sm"
        }`}
        style={{ boxShadow: isHero ? "0 4px 24px rgba(0,0,0,0.10)" : undefined }}
      >
        <svg
          className="shrink-0 text-[#6B6B6B] mr-3"
          width={isHero ? 20 : 16}
          height={isHero ? 20 : 16}
          viewBox="0 0 20 20"
          fill="none"
        >
          <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M15 15l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Caută produsul..."
          className={`flex-1 bg-transparent outline-none text-[#111111] placeholder-[#6B6B6B] font-medium ${
            isHero ? "text-base" : "text-sm"
          }`}
          autoComplete="off"
        />
      </div>
      <button
        type="submit"
        className={`shrink-0 bg-[#4F7CFF] hover:bg-[#3d6aec] text-white font-semibold rounded-r-2xl transition-colors ${
          isHero ? "h-14 px-7 text-base" : "h-11 px-5 text-sm"
        }`}
      >
        Caută
      </button>
    </form>
  );
}
