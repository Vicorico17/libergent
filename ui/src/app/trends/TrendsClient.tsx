"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { BarChart3, Clock3, Hash, Search, TrendingUp } from "lucide-react";
import { MascotSVG } from "@/components/MascotSVG";
import { SearchBar } from "@/components/SearchBar";

const HISTORY_STORAGE_KEY = "libergent-search-history-v1";

type CountEntry = {
  value: string;
  count: number;
};

type RecentSearch = {
  query?: string;
  searchedAt?: string;
  successfulMarketplaces?: number;
  marketplaces?: number;
  totalListings?: number;
  bestOffer?: {
    title?: string;
    priceRon?: number;
  } | null;
};

type DailyEntry = {
  date: string;
  count: number;
};

type HistoryPayload = {
  updatedAt?: string;
  error?: string;
  totals?: {
    searches?: number;
    uniqueQueries?: number;
    uniqueKeywords?: number;
  };
  topQueries?: CountEntry[];
  topKeywords?: CountEntry[];
  dailyTrend?: DailyEntry[];
  recentSearches?: RecentSearch[];
};

type Source = "server" | "browser local";

export function TrendsClient() {
  const [payload, setPayload] = useState<HistoryPayload | null>(null);
  const [source, setSource] = useState<Source>("server");
  const [status, setStatus] = useState("Se încarcă trendurile...");

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      try {
        const response = await fetch("/api/history", { cache: "no-store" });
        const serverPayload = (await response.json()) as HistoryPayload;

        if (!response.ok) {
          throw new Error(serverPayload.error || "Nu am putut încărca istoricul.");
        }

        if ((serverPayload.totals?.searches || 0) > 0) {
          if (!active) return;
          setPayload(serverPayload);
          setSource("server");
          setStatus(buildStatus(serverPayload, "server"));
          return;
        }

        const browserPayload = loadBrowserHistoryPayload();
        if (browserPayload) {
          if (!active) return;
          setPayload(browserPayload);
          setSource("browser local");
          setStatus(buildStatus(browserPayload, "browser local"));
          return;
        }

        if (!active) return;
        setPayload(serverPayload);
        setSource("server");
        setStatus(serverPayload.error ? `Istoricul serverului nu este disponibil: ${serverPayload.error}` : buildStatus(serverPayload, "server"));
      } catch (error) {
        const browserPayload = loadBrowserHistoryPayload();
        if (browserPayload) {
          if (!active) return;
          setPayload(browserPayload);
          setSource("browser local");
          setStatus(buildStatus(browserPayload, "browser local"));
          return;
        }

        if (!active) return;
        setStatus(error instanceof Error ? error.message : String(error));
      }
    }

    loadHistory();

    return () => {
      active = false;
    };
  }, []);

  const totals = payload?.totals || {};
  const topQueries = payload?.topQueries || [];
  const topKeywords = payload?.topKeywords || [];
  const dailyTrend = payload?.dailyTrend || [];
  const recentSearches = payload?.recentSearches || [];
  const maxDailyCount = useMemo(() => Math.max(...dailyTrend.map((entry) => entry.count), 1), [dailyTrend]);

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="bg-white border-b border-[#D9D9D9] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <MascotSVG size={28} />
            <span className="font-pixel text-[#111111] hidden sm:block" style={{ fontSize: "11px" }}>
              LiberGent
            </span>
          </Link>
          <SearchBar size="normal" className="flex-1 max-w-2xl" />
          <Link href="/search" className="hidden sm:inline-flex text-sm font-semibold text-[#6B6B6B] hover:text-[#111111]">
            Căutare
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
        <section className="mb-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white border border-[#D9D9D9] px-3 py-1 text-xs font-semibold text-[#6B6B6B] mb-4">
              <TrendingUp size={14} className="text-[#4F7CFF]" />
              Trending searches
            </div>
            <h1 className="text-3xl md:text-5xl font-semibold text-[#111111] tracking-normal leading-tight">
              Ce caută oamenii pe LiberGent
            </h1>
            <p className="mt-4 text-base md:text-lg text-[#6B6B6B] max-w-2xl">
              Top căutări, keywords recurente și activitate recentă din istoricul aplicației.
            </p>
          </div>

          <div className="bg-white border border-[#D9D9D9] rounded-lg p-5 self-end">
            <p className="text-sm font-semibold text-[#111111] mb-2">Status</p>
            <p className="text-sm text-[#6B6B6B] leading-relaxed">{status}</p>
            <p className="mt-3 text-xs text-[#6B6B6B]">Sursă: {source}</p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3 mb-6">
          <MetricCard icon={<Search size={18} />} label="Total searches" value={totals.searches || 0} color="#4F7CFF" />
          <MetricCard icon={<BarChart3 size={18} />} label="Unique queries" value={totals.uniqueQueries || 0} color="#A259FF" />
          <MetricCard icon={<Hash size={18} />} label="Unique keywords" value={totals.uniqueKeywords || 0} color="#FF6B6B" />
        </section>

        <section className="grid gap-6 lg:grid-cols-2 mb-6">
          <Panel title="Top queries" description="Cele mai repetate căutări din istoric.">
            <CountList entries={topQueries} empty="Nu există încă suficiente date." />
          </Panel>

          <Panel title="Top keywords" description="Cuvintele care apar cel mai des în căutări.">
            {topKeywords.length ? (
              <div className="flex flex-wrap gap-2">
                {topKeywords.map((entry) => (
                  <span
                    key={entry.value}
                    className="inline-flex items-center gap-2 rounded-full border border-[#D9D9D9] bg-[#F8F9FA] px-3 py-2 text-sm font-semibold text-[#111111]"
                  >
                    {entry.value}
                    <span className="text-xs text-[#6B6B6B]">{entry.count}</span>
                  </span>
                ))}
              </div>
            ) : (
              <EmptyState>Nu există keywords înregistrate încă.</EmptyState>
            )}
          </Panel>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Panel title="Daily search volume" description="Volumul căutărilor pe ultimele zile disponibile.">
            {dailyTrend.length ? (
              <div className="space-y-3">
                {dailyTrend.map((entry) => (
                  <div key={entry.date} className="grid grid-cols-[88px_1fr_32px] items-center gap-3 text-sm">
                    <span className="text-[#6B6B6B]">{entry.date}</span>
                    <span className="h-2.5 rounded-full bg-[#F8F9FA] border border-[#D9D9D9] overflow-hidden">
                      <span
                        className="block h-full rounded-full bg-[#4F7CFF]"
                        style={{ width: `${Math.max(8, (entry.count / maxDailyCount) * 100)}%` }}
                      />
                    </span>
                    <span className="font-semibold text-[#111111] text-right">{entry.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState>Nu există încă activitate zilnică.</EmptyState>
            )}
          </Panel>

          <Panel title="Recent searches" description="Ultimele căutări care au intrat în sistem.">
            {recentSearches.length ? (
              <div className="space-y-3">
                {recentSearches.slice(0, 12).map((entry, index) => (
                  <article key={`${entry.query || "search"}-${entry.searchedAt || index}`} className="rounded-lg border border-[#D9D9D9] bg-[#F8F9FA] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-[#111111]">{entry.query || "Căutare fără nume"}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-[#6B6B6B]">
                          <Clock3 size={13} />
                          {formatDateTime(entry.searchedAt)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white border border-[#D9D9D9] px-2.5 py-1 text-xs font-semibold text-[#6B6B6B]">
                        {entry.totalListings || 0} listings
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-[#6B6B6B]">
                      {(entry.successfulMarketplaces || 0)}/{entry.marketplaces || 0} marketplace-uri
                      {entry.bestOffer?.title ? ` · Best offer: ${entry.bestOffer.title} · ${formatRon(entry.bestOffer.priceRon)}` : " · Fără best offer valid"}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState>Nu există încă căutări înregistrate.</EmptyState>
            )}
          </Panel>
        </section>
      </main>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  color,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <article className="bg-white border border-[#D9D9D9] rounded-lg p-5">
      <div className="flex items-center justify-between">
        <span className="text-[#6B6B6B]">{icon}</span>
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      </div>
      <p className="mt-5 text-sm font-semibold text-[#6B6B6B]">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-[#111111]">{value}</p>
    </article>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="bg-white border border-[#D9D9D9] rounded-lg p-5">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-[#111111]">{title}</h2>
        <p className="mt-1 text-sm text-[#6B6B6B]">{description}</p>
      </div>
      {children}
    </section>
  );
}

function CountList({ entries, empty }: { entries: CountEntry[]; empty: string }) {
  if (!entries.length) {
    return <EmptyState>{empty}</EmptyState>;
  }

  return (
    <div className="space-y-2">
      {entries.map((entry, index) => (
        <Link
          key={entry.value}
          href={`/search?q=${encodeURIComponent(entry.value)}`}
          className="grid grid-cols-[36px_1fr_44px] items-center gap-3 rounded-lg border border-[#D9D9D9] bg-[#F8F9FA] px-3 py-3 hover:border-[#4F7CFF] transition-colors"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-xs font-semibold text-[#6B6B6B]">
            {index + 1}
          </span>
          <span className="min-w-0 truncate font-semibold text-[#111111]">{entry.value}</span>
          <span className="text-right text-sm font-semibold text-[#4F7CFF]">{entry.count}</span>
        </Link>
      ))}
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-[#D9D9D9] bg-[#F8F9FA] p-4 text-sm text-[#6B6B6B]">{children}</p>;
}

function tokenizeQuery(query = "") {
  return query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token && token.length >= 3);
}

function buildCountList(values: Map<string, number>, limit: number): CountEntry[] {
  return [...values.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function buildHistoryPayloadFromEntries(entries: RecentSearch[]): HistoryPayload {
  const queryCounts = new Map<string, number>();
  const keywordCounts = new Map<string, number>();
  const dailyCounts = new Map<string, number>();

  for (const entry of entries) {
    const normalizedQuery = entry.query?.trim();
    if (normalizedQuery) {
      queryCounts.set(normalizedQuery, (queryCounts.get(normalizedQuery) || 0) + 1);
    }

    for (const token of tokenizeQuery(normalizedQuery)) {
      keywordCounts.set(token, (keywordCounts.get(token) || 0) + 1);
    }

    const day = String(entry.searchedAt || "").slice(0, 10);
    if (day) {
      dailyCounts.set(day, (dailyCounts.get(day) || 0) + 1);
    }
  }

  return {
    updatedAt: new Date().toISOString(),
    totals: {
      searches: entries.length,
      uniqueQueries: queryCounts.size,
      uniqueKeywords: keywordCounts.size,
    },
    topQueries: buildCountList(queryCounts, 12),
    topKeywords: buildCountList(keywordCounts, 20),
    dailyTrend: [...dailyCounts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([date, count]) => ({ date, count })),
    recentSearches: entries.slice(0, 30),
  };
}

function loadBrowserHistoryPayload() {
  const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const entries = JSON.parse(raw);
    return Array.isArray(entries) && entries.length ? buildHistoryPayloadFromEntries(entries) : null;
  } catch {
    window.localStorage.removeItem(HISTORY_STORAGE_KEY);
    return null;
  }
}

function buildStatus(payload: HistoryPayload, sourceLabel: Source) {
  return `Actualizat ${formatDateTime(payload.updatedAt)} (${sourceLabel}).`;
}

function formatDateTime(value?: string) {
  if (!value) {
    return "acum";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatRon(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 0,
  }).format(value);
}
