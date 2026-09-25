"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

type Source = {
  domain: string; tier: "free" | "premium"; status: string; selection: string; categories: string[];
  productionValidation?: { checkedAt: string; accepted: number }[];
  directValidation?: { checkedAt: string; queriesChecked: number; queriesWithAcceptedOffers: number } | null;
};
type Availability = "available" | "empty" | "unknown";

function evidence(source: Source) {
  const checks = (source.productionValidation || []).filter(check => Number.isFinite(Date.parse(check.checkedAt)));
  const latestProduction = checks.reduce((latest, check) => check.checkedAt > latest ? check.checkedAt : latest, "");
  const direct = source.directValidation;
  if (latestProduction && (!direct || Date.parse(latestProduction) >= Date.parse(direct.checkedAt))) {
    const latest = checks.filter(check => check.checkedAt === latestProduction);
    const accepted = latest.filter(check => check.accepted > 0).length;
    return { state: (accepted ? "available" : "empty") as Availability, date: latestProduction, detail: `${accepted}/${latest.length} căutări cu oferte · pe site` };
  }
  if (direct && direct.queriesChecked > 0 && Number.isFinite(Date.parse(direct.checkedAt))) {
    return { state: (direct.queriesWithAcceptedOffers > 0 ? "available" : "empty") as Availability, date: direct.checkedAt,
      detail: `${direct.queriesWithAcceptedOffers}/${direct.queriesChecked} căutări cu oferte · test direct` };
  }
  return { state: "unknown" as Availability, date: "", detail: "Nu există încă o verificare publicată." };
}

function StatusBadge({ state }: { state: Availability }) {
  const label = state === "available" ? "Oferte primite la ultima verificare" : state === "empty" ? "Fără oferte la ultima verificare" : "Funcționare neconfirmată: sursă neverificată";
  return <span role="img" aria-label={label} title={label} className={`h-3 w-3 shrink-0 rounded-full ${state === "available" ? "bg-[#16a34a]" : "bg-[#dc2626]"}`} />;
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
  const filtered = rows.filter(({ source }) =>
    `${source.domain} ${(source.categories || []).join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <>
    <p className="mt-8 text-[11px] leading-relaxed text-[#555]">Ultima verificare publicată · Verde: oferte primite · Roșu: fără oferte sau încă neconfirmat.</p>
    <label className="mt-4 flex min-h-11 items-center gap-3 border border-[#111111]/30 bg-white/60 px-3">
      <Search size={15} aria-hidden="true" />
      <span className="sr-only">Caută o sursă</span>
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Caută un magazin…" className="min-w-0 flex-1 bg-transparent py-3 text-xs outline-none" />
    </label>
    {loading ? <p role="status" className="py-12 text-sm">Se încarcă sursele și verificările…</p> : error ? <div role="status" className="my-8 border border-[#c02662] bg-[#ffe4ef] p-6"><p>Nu am putut încărca statusul surselor.</p><button onClick={() => { setError(false); setLoading(true); setAttempt(value => value + 1); }} className="mt-4 min-h-11 border border-[#111] bg-white px-4 text-sm font-bold">Încearcă din nou</button></div> : <>
      <p role="status" className="my-5 text-xs text-[#555]">{filtered.length} din {sources.length} surse</p>
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
              {visibleRows.map(({ source, check }) => <li key={source.domain} className="px-4 transition-colors hover:bg-white/70">
                <div className="flex items-center justify-between gap-3">
                  <a href={`https://${source.domain}`} target="_blank" rel="noopener noreferrer" className="flex min-h-11 min-w-0 flex-1 items-center text-xs font-medium hover:underline">
                    <span className="break-all">{source.domain}</span><span className="sr-only"> (se deschide într-o filă nouă)</span>
                  </a>
                  <StatusBadge state={check.state} />
                </div>
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
