"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowUpRight, History } from "lucide-react";
import {
  clearRecentSearches,
  getRecentSearchesServerSnapshot,
  getRecentSearchesSnapshot,
  parseRecentSearches,
  subscribeToRecentSearches,
} from "@/lib/recent-searches";

export function RecentSearches() {
  const snapshot = useSyncExternalStore(subscribeToRecentSearches, getRecentSearchesSnapshot, getRecentSearchesServerSnapshot);
  const searches = parseRecentSearches(snapshot);

  return (
    <section aria-labelledby="recent-searches-heading" className="w-full max-w-xl border-t border-[#101010]/15 pt-4 text-[#101010]">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 id="recent-searches-heading" className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest">
          <History size={14} aria-hidden="true" className="text-[#FF4F8B]" />
          Ultimele căutări
        </h2>
        {searches.length > 0 && (
          <button type="button" onClick={clearRecentSearches} aria-label="Șterge istoricul căutărilor de pe acest browser"
            className="min-h-11 px-2 text-[11px] text-[#101010]/65 underline decoration-[#101010]/25 underline-offset-4 transition-colors hover:text-[#101010] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#101010]">
            Șterge istoricul
          </button>
        )}
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
          <p className="mt-3 text-[11px] leading-relaxed text-[#101010]/60">Pe acest browser. Reia o căutare cu un singur clic.</p>
        </>
      ) : (
        <p className="mt-3 text-xs leading-relaxed text-[#101010]/60">Ai ceva în minte? Caută mai sus — ultimele 5 căutări vor apărea aici.</p>
      )}
    </section>
  );
}
