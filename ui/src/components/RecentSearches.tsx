"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, History } from "lucide-react";

export function RecentSearches() {
  const [searches, setSearches] = useState<string[]>([]);
  const [status, setStatus] = useState("Se încarcă ultimele căutări…");

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    let active = true;
    async function loadSearches() {
      try {
        const response = await fetch("/api/history", { cache: "no-store", signal: controller.signal });
        const payload = await response.json();
        if (!response.ok || payload.error || !Array.isArray(payload.recentSearches)) throw new Error("History unavailable");
        const seen = new Set<string>();
        const queries: string[] = [];
        // The Trends API returns searches ordered by searched_at descending.
        for (const entry of payload.recentSearches) {
          if (typeof entry?.query !== "string") continue;
          const query = entry.query.trim().replace(/\s+/g, " ").slice(0, 120);
          const key = query.toLocaleLowerCase("ro");
          if (!query || seen.has(key)) continue;
          seen.add(key);
          queries.push(query);
          if (queries.length === 5) break;
        }
        if (!active) return;
        setSearches(queries);
        setStatus("Încă nu există căutări recente. Începe cu produsul pe care îl cauți.");
      } catch {
        if (active) setStatus("Căutările recente nu sunt disponibile momentan. Poți căuta un produs mai sus.");
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void loadSearches();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  return (
    <section aria-labelledby="recent-searches-heading" className="w-full max-w-xl border-t border-[#101010]/15 pt-4 text-[#101010]">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 id="recent-searches-heading" className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest">
          <History size={14} aria-hidden="true" className="text-[#FF4F8B]" />
          Ultimele căutări
        </h2>
        <Link href="/trenduri" className="flex min-h-11 items-center gap-1 px-2 text-[11px] text-[#101010]/65 underline decoration-[#101010]/25 underline-offset-4 transition-colors hover:text-[#101010] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#101010]">
          Vezi trendurile <ArrowUpRight size={12} aria-hidden="true" />
        </Link>
      </div>
      {searches.length > 0 ? (
        <>
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Cele mai recente cinci căutări">
            {searches.map((query, index) => (
              <li key={query.toLocaleLowerCase("ro")} className="min-w-0 max-w-full">
                <Link href={`/search?q=${encodeURIComponent(query)}`} prefetch={false} title={query}
                  className="group flex min-h-11 max-w-full items-center gap-3 border border-[#101010]/20 bg-white/45 px-3 py-2 text-sm transition-colors hover:border-[#101010] hover:bg-[#FF4F8B]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#101010]">
                  <span aria-hidden="true" className="shrink-0 text-[10px] tabular-nums text-[#101010]/45">0{index + 1}</span>
                  <span className="truncate font-semibold">{query}</span>
                  <ArrowUpRight size={14} aria-hidden="true" className="shrink-0 text-[#101010]/45 transition-colors group-hover:text-[#101010]" />
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-[#101010]/60">Căutate recent pe LiberGent. Descoperă ofertele cu un singur clic.</p>
        </>
      ) : (
        <p role="status" className="mt-3 text-xs leading-relaxed text-[#101010]/60">{status}</p>
      )}
    </section>
  );
}
