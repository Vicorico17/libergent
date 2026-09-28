"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

type Source = {
  domain: string; tier: "free" | "premium"; status: string; selection: string; categories: string[];
  productionValidation?: { checkedAt: string; accepted: number; ok?: boolean; error?: string }[];
  browserValidation?: { checkedAt: string; accepted: number; engine: string; priceVerified: boolean }[];
  directValidation?: { checkedAt: string; queriesChecked: number; queriesWithAcceptedOffers: number;
    checks?: { query: string; ok: boolean; accepted: number; error: string }[] } | null;
};
type Availability = "available" | "empty" | "failed" | "unknown";

function evidence(source: Source) {
  const checks = (source.productionValidation || []).filter(check => Number.isFinite(Date.parse(check.checkedAt)));
  const latestProduction = checks.reduce((latest, check) => check.checkedAt > latest ? check.checkedAt : latest, "");
  const direct = source.directValidation;
  const browser = (source.browserValidation || [])
    .filter(check => check.accepted > 0 && check.priceVerified && Number.isFinite(Date.parse(check.checkedAt)))
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];
  if (browser && (!direct || browser.checkedAt.slice(0, 10) >= direct.checkedAt.slice(0, 10)) &&
    (!latestProduction || browser.checkedAt.slice(0, 10) >= latestProduction.slice(0, 10))) {
    return { state: "available" as Availability, date: browser.checkedAt,
      detail: `${browser.accepted} oferte · Cloudflare Browser Run (${browser.engine})`, reason: "" };
  }
  if (latestProduction && (!direct || latestProduction.slice(0, 10) >= direct.checkedAt.slice(0, 10))) {
    const latest = checks.filter(check => check.checkedAt.slice(0, 10) === latestProduction.slice(0, 10));
    const accepted = latest.filter(check => check.accepted > 0).length;
    const failed = latest.every(check => check.ok === false);
    return { state: (accepted ? "available" : failed ? "failed" : "empty") as Availability, date: latestProduction,
      detail: `${accepted}/${latest.length} căutări cu oferte · pe site`, reason: failed ? latest[0]?.error || "Verificarea a eșuat." : "" };
  }
  if (direct && direct.queriesChecked > 0 && Number.isFinite(Date.parse(direct.checkedAt))) {
    const failed = direct.checks?.length === direct.queriesChecked && direct.checks.every(check => !check.ok);
    return { state: (direct.queriesWithAcceptedOffers > 0 ? "available" : failed ? "failed" : "empty") as Availability, date: direct.checkedAt,
      detail: `${direct.queriesWithAcceptedOffers}/${direct.queriesChecked} căutări cu oferte · test direct`,
      reason: failed ? direct.checks?.[0]?.error || "Verificarea a eșuat." : "" };
  }
  return { state: "unknown" as Availability, date: "", detail: "Nu există încă o verificare publicată.", reason: "" };
}

function StatusBadge({ state }: { state: Availability }) {
  const label = state === "available" ? "Oferte" : state === "empty" ? "Fără oferte" : state === "failed" ? "Eroare" : "Neverificat";
  const color = state === "available" ? "border-[#16a34a] bg-[#dcfce7] text-[#14532d]"
    : state === "unknown" ? "border-[#999] bg-[#eee] text-[#555]" : "border-[#dc2626] bg-[#fee2e2] text-[#991b1b]";
  return <span className={`shrink-0 border px-2 py-1 text-[10px] font-bold uppercase ${color}`}>{label}</span>;
}

export function DiscoveryStatus() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    fetch("/api/sources", { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Sources unavailable");
        const payload = await response.json();
        if (!Array.isArray(payload.sources)) throw new Error("Invalid catalog");
        if (active) setSources(payload.sources.filter((source: Source) => typeof source?.domain === "string"));
      })
      .catch(() => { if (active) setError(true); })
      .finally(() => { clearTimeout(timeout); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [attempt]);
  const rows = sources.map(source => ({ source, check: evidence(source) }));
  const availableCount = rows.filter(row => row.check.state === "available").length;
  const unavailableCount = rows.filter(row => row.check.state === "empty" || row.check.state === "failed").length;
  const filtered = rows.filter(({ source }) =>
    `${source.domain} ${(source.categories || []).join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <>
    <p className="mt-8 text-[11px] leading-relaxed text-[#555]">Ultima verificare publicată · Verde: oferte primite · Roșu: eroare sau fără oferte la test · Gri: neverificat. Un test fără oferte nu dovedește că magazinul este închis.</p>
    <label className="mt-4 flex min-h-11 items-center gap-3 border border-[#111111]/30 bg-white/60 px-3">
      <Search size={15} aria-hidden="true" />
      <span className="sr-only">Caută o sursă</span>
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Caută un magazin…" className="min-w-0 flex-1 bg-transparent py-3 text-xs outline-none" />
    </label>
    {loading ? <p role="status" className="py-12 text-sm">Se încarcă sursele și verificările…</p> : error ? <div role="status" className="my-8 border border-[#c02662] bg-[#ffe4ef] p-6"><p>Nu am putut încărca statusul surselor.</p><button onClick={() => { setError(false); setLoading(true); setAttempt(value => value + 1); }} className="mt-4 min-h-11 border border-[#111] bg-white px-4 text-sm font-bold">Încearcă din nou</button></div> : <>
      <p role="status" className="my-5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#555]">
        <span>{filtered.length} din {sources.length} surse</span>
        <span className="font-bold text-[#14532d]">{availableCount} cu oferte</span>
        <span className="font-bold text-[#991b1b]">{unavailableCount} fără oferte la verificare</span>
      </p>
      <div className="grid items-start gap-6 md:grid-cols-2">
        {(["free", "premium"] as const).map(tier => {
          const tierRows = rows.filter(row => row.source.tier === tier);
          const visibleRows = filtered.filter(row => row.source.tier === tier);
          return <section key={tier} aria-labelledby={`discovery-${tier}`} className="min-w-0 border-2 border-[#111111] bg-white/40">
            <header className={`border-b-2 border-[#111111] p-4 ${tier === "free" ? "bg-[#dcfce7]" : "bg-[#ffe4ef]"}`}>
              <div className="flex items-center justify-between gap-3">
                <h2 id={`discovery-${tier}`} className="text-base font-bold">{tier === "free" ? "Free" : "Premium"}</h2>
                <span className="border border-[#111111]/30 bg-white/60 px-2 py-1 text-xs font-bold tabular-nums">{tierRows.length} surse</span>
              </div>
            </header>
            <ul className="divide-y divide-[#111111]/15">
              {visibleRows.map(({ source, check }) => <li key={source.domain} className={`border-l-4 px-4 py-2 transition-colors ${check.state === "available" ? "border-[#16a34a] bg-[#f0fdf4]" : check.state === "unknown" ? "border-[#999] bg-[#f5f5f5]" : "border-[#dc2626] bg-[#fef2f2]"}`}>
                <div className="flex items-center justify-between gap-3">
                  <a href={`https://${source.domain}`} target="_blank" rel="noopener noreferrer" className="flex min-h-11 min-w-0 flex-1 items-center text-xs font-medium hover:underline">
                    <span className="break-all">{source.domain}</span><span className="sr-only"> (se deschide într-o filă nouă)</span>
                  </a>
                  <StatusBadge state={check.state} />
                </div>
                <p className="pb-1 text-[10px] leading-relaxed text-[#555]">{check.detail}{check.date ? ` · ${new Date(check.date).toLocaleDateString("ro-RO")}` : ""}</p>
                {check.reason && <p className="truncate pb-1 text-[10px] text-[#991b1b]" title={check.reason}>{check.reason}</p>}
              </li>)}
            </ul>
            {!visibleRows.length && <p className="p-5 text-sm text-[#555]">Nicio sursă {tier === "free" ? "Free" : "Premium"} pentru filtrele alese.</p>}
          </section>;
        })}
      </div>
      {!filtered.length && <p className="py-10 text-sm">Nicio sursă pentru filtrele alese. Încearcă alt nume.</p>}
    </>}
  </>;
}
