"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Check, CircleHelp, Search, X } from "lucide-react";

type Source = {
  domain: string; tier: "free" | "premium"; status: string; selection: string; categories: string[];
  productionValidation?: { checkedAt: string; accepted: number }[];
  directValidation?: { checkedAt: string; queriesChecked: number; queriesWithAcceptedOffers: number } | null;
};
type Availability = "available" | "empty" | "unknown";
const LABELS = { available: "Oferte găsite", empty: "Fără oferte", unknown: "Neverificat" };

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
  const Icon = state === "available" ? Check : state === "empty" ? X : CircleHelp;
  return <span className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide ${state === "available" ? "border-[#15803d] bg-[#dcfce7] text-[#166534]" : state === "empty" ? "border-[#c02662] bg-[#ffe4ef] text-[#9d174d]" : "border-[#11111133] bg-[#11111108] text-[#555]"}`}><Icon size={13} aria-hidden="true" />{LABELS[state]}</span>;
}

export function DiscoveryStatus() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState("all");
  const [status, setStatus] = useState("all");
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
  const filtered = rows.filter(({ source, check }) =>
    (tier === "all" || source.tier === tier) && (status === "all" || check.state === status) &&
    `${source.domain} ${(source.categories || []).join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()));
  const counts = { available: rows.filter(row => row.check.state === "available").length, empty: rows.filter(row => row.check.state === "empty").length, unknown: rows.filter(row => row.check.state === "unknown").length };
  const latest = rows.map(row => row.check.date).filter(Boolean).sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  return <>
    <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[{ label: "Surse în catalog", count: sources.length, color: "#111" }, { label: "Cu oferte la verificare", count: counts.available, color: "#166534" }, { label: "Fără oferte la verificare", count: counts.empty, color: "#9d174d" }, { label: "De verificat", count: counts.unknown, color: "#555" }].map(item =>
        <div key={item.label} className="border border-[#111111] bg-white/50 p-4 sm:p-5"><p className="text-3xl font-bold tabular-nums" style={{ color: item.color }}>{loading || error ? "—" : item.count}</p><p className="mt-2 text-[10px] font-bold uppercase leading-relaxed tracking-wide">{item.label}</p></div>)}
    </div>
    <div className="mt-6 border-l-2 border-[#FF4B8B] pl-4 text-xs leading-relaxed text-[#555]">
      <p>Verde: sursa a returnat oferte la ultima verificare publicată. Roz: nu a returnat oferte în acel test; poate fi blocată sau fără rezultate pentru produsele testate. Gri: încă neverificată.</p>
      <p className="mt-2">Verificări punctuale, nu monitorizare continuă. Disponibilitatea depinde de produs și poate varia. {latest && !error && <>Cel mai recent test publicat: <strong>{latest.slice(0, 10)}</strong>.</>}</p>
    </div>
    <div className="mt-10 flex flex-col gap-4 border-y border-[#111111]/20 py-5 lg:flex-row lg:items-end">
      <label className="flex-1 text-[10px] font-bold uppercase tracking-widest">Caută o sursă
        <span className="mt-2 flex min-h-12 items-center gap-3 border border-[#111111] bg-white/60 px-3"><Search size={16} aria-hidden="true" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="OLX, eMAG, fashion…" className="min-w-0 flex-1 bg-transparent py-3 text-sm font-normal normal-case tracking-normal outline-none" /></span>
      </label>
      <label className="text-[10px] font-bold uppercase tracking-widest">Acces<select value={tier} onChange={event => setTier(event.target.value)} className="mt-2 block min-h-12 w-full border border-[#111111] bg-white/60 px-3 text-sm normal-case tracking-normal lg:w-40"><option value="all">Free + Premium</option><option value="free">Free</option><option value="premium">Premium</option></select></label>
      <label className="text-[10px] font-bold uppercase tracking-widest">Ultima verificare<select value={status} onChange={event => setStatus(event.target.value)} className="mt-2 block min-h-12 w-full border border-[#111111] bg-white/60 px-3 text-sm normal-case tracking-normal lg:w-48"><option value="all">Toate statusurile</option>{Object.entries(LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {loading ? <p role="status" className="py-12 text-sm">Se încarcă sursele și verificările…</p> : error ? <div role="status" className="my-8 border border-[#c02662] bg-[#ffe4ef] p-6"><p>Nu am putut încărca statusul surselor.</p><button onClick={() => { setError(false); setLoading(true); setAttempt(value => value + 1); }} className="mt-4 min-h-11 border border-[#111] bg-white px-4 text-sm font-bold">Încearcă din nou</button></div> : <>
      <p role="status" className="my-5 text-xs text-[#555]">{filtered.length} din {sources.length} surse</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map(({ source, check }) => <article key={source.domain} className="flex flex-col border border-[#111111]/30 bg-white/50 p-5 transition-colors hover:border-[#111111]">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-widest">{source.tier === "premium" ? "Premium" : "Free"}</span><StatusBadge state={check.state} /></div>
          <a href={`https://${source.domain}`} target="_blank" rel="noopener noreferrer" className="mt-5 flex min-h-11 items-center justify-between gap-3 text-xl font-bold hover:underline"><span className="break-all">{source.domain}</span><ArrowUpRight size={18} className="shrink-0" aria-hidden="true" /><span className="sr-only"> (se deschide într-o filă nouă)</span></a>
          <p className="mt-1 text-xs text-[#555]">{source.selection === "vehicles" ? "Autoturisme" : source.selection === "refurbished-tech" ? "Tehnologie recondiționată" : "Selectată în funcție de căutare"}{source.status === "experimental" ? " · Experimental" : ""}</p>
          <div className="mt-5 border-t border-[#111111]/15 pt-4 text-[11px] leading-relaxed text-[#555]"><p>{check.detail}</p><p className="mt-1">{check.date ? `Verificat: ${check.date.slice(0, 10)}` : "Verificare în așteptare"}</p></div>
        </article>)}
      </div>
      {!filtered.length && <p className="py-10 text-sm">Nicio sursă pentru filtrele alese. Încearcă alt nume sau selectează toate statusurile.</p>}
    </>}
  </>;
}
