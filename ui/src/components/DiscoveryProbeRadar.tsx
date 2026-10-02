"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type ProbeOffer = { title: string; url: string; site: string; priceRon: number | null; relevanceScore: number | null };
type ProbeRun = {
  id: string; query: string; source_site: string; parent_query: string | null; outcome: "results" | "empty" | "error";
  results_count: number; parsed_count: number; offers: ProbeOffer[]; suggested_queries: string[]; elapsed_ms: number;
  error: string; searched_at: string;
};
type ProbeTerm = {
  query: string; origin: string; parentQuery: string; searchCount: number; priority: number;
  usefulCount: number; irrelevantCount: number; lastProbedAt: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "încă neprobat";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "necunoscut" : date.toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short" });
}

export function DiscoveryProbeRadar() {
  const [runs, setRuns] = useState<ProbeRun[]>([]);
  const [terms, setTerms] = useState<ProbeTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/discovery/probes", { signal, cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Nu am putut încărca probele.");
      setRuns(Array.isArray(payload.runs) ? payload.runs : []);
      setTerms(Array.isArray(payload.terms) ? payload.terms : []);
      setError("");
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Nu am putut încărca probele.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const timer = setInterval(() => void refresh(), 60_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [refresh]);

  async function sendFeedback(query: string, value: "useful" | "irrelevant") {
    setFeedback((current) => ({ ...current, [query]: "Se salvează…" }));
    const client = getSupabaseBrowserClient();
    const session = client ? (await client.auth.getSession()).data.session : null;
    if (!session?.access_token) {
      setFeedback((current) => ({ ...current, [query]: "Autentifică-te pentru a oferi feedback." }));
      return;
    }
    try {
      const response = await fetch("/api/discovery/probes/feedback", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ query, feedback: value })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Feedbackul nu a putut fi salvat.");
      setFeedback((current) => ({ ...current, [query]: "Feedback salvat." }));
      await refresh();
    } catch (cause) {
      setFeedback((current) => ({ ...current, [query]: cause instanceof Error ? cause.message : "Eroare la salvare." }));
    }
  }

  return <section className="mt-12 border-2 border-[#111] bg-white/60" aria-labelledby="probe-radar-heading">
    <header className="flex flex-col gap-3 border-b-2 border-[#111] bg-[#e8e1d3] p-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a51d50]">Probe automate · România</p>
        <h2 id="probe-radar-heading" className="mt-2 text-2xl font-bold uppercase">Radar de căutări</h2>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#555]">O căutare de produs la fiecare minut, rotită între marketplace-uri. Termenii populari pornesc din căutări agregate recente; ofertele relevante pot propune variante noi.</p>
      </div>
      <span className="shrink-0 border border-[#111]/30 bg-white/70 px-3 py-2 text-[10px] font-bold uppercase">{loading ? "Se încarcă…" : `${runs.length} verificări recente`}</span>
    </header>

    {error ? <p role="status" className="border-b border-[#111]/15 bg-[#fee2e2] p-4 text-xs text-[#991b1b]">{error} · Verifică dacă a fost aplicată migrarea `discovery-probes.sql` în Supabase.</p> : null}

    <div className="grid gap-6 p-4 md:grid-cols-[0.8fr_1.2fr] md:p-6">
      <div>
        <h3 className="text-sm font-bold uppercase">Următoarele căutări</h3>
        <p className="mt-1 text-[10px] leading-relaxed text-[#666]">Interesul recent și feedbackul influențează ordinea. Variantele noi vin din titlurile ofertelor potrivite.</p>
        <ul className="mt-3 divide-y divide-[#111]/10 border border-[#111]/15 bg-white">
          {terms.slice(0, 15).map((term) => <li key={term.query} className="p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/search?q=${encodeURIComponent(term.query)}`} className="text-xs font-bold hover:underline">{term.query}</Link>
              <span className="text-[9px] uppercase text-[#666]">prioritate {term.priority}</span>
            </div>
            <p className="mt-1 text-[9px] text-[#666]">{term.origin === "result_expansion" ? `Sugestie din „${term.parentQuery}”` : `${term.searchCount} căutări recente`} · {formatDate(term.lastProbedAt)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void sendFeedback(term.query, "useful")} className="flex min-h-8 items-center gap-1 border border-[#111]/20 px-2 text-[9px] font-bold uppercase hover:bg-[#dcfce7]"><ThumbsUp size={11} />Util</button>
              <button type="button" onClick={() => void sendFeedback(term.query, "irrelevant")} className="flex min-h-8 items-center gap-1 border border-[#111]/20 px-2 text-[9px] font-bold uppercase hover:bg-[#fee2e2]"><ThumbsDown size={11} />Irelevant</button>
              <span className="text-[9px] text-[#666]">{term.usefulCount} util · {term.irrelevantCount} irelevant</span>
              {feedback[term.query] ? <span role="status" className="text-[9px] text-[#555]">{feedback[term.query]}</span> : null}
            </div>
          </li>)}
          {!loading && !terms.length ? <li className="p-4 text-xs text-[#666]">Așteptăm căutări de produse repetate pentru a forma prima coadă.</li> : null}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-bold uppercase">Rezultatele ultimelor probe</h3>
        <ul className="mt-3 space-y-3">
          {runs.slice(0, 20).map((run) => <li key={run.id} className="border border-[#111]/15 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/search?q=${encodeURIComponent(run.query)}`} className="text-xs font-bold hover:underline">{run.query}</Link>
                <span className={`border px-2 py-1 text-[9px] font-bold uppercase ${run.outcome === "results" ? "border-[#16a34a] bg-[#dcfce7] text-[#14532d]" : run.outcome === "error" ? "border-[#dc2626] bg-[#fee2e2] text-[#991b1b]" : "border-[#999] bg-[#eee] text-[#555]"}`}>{run.outcome === "results" ? `${run.results_count} oferte` : run.outcome === "error" ? "eroare" : "fără rezultate"}</span>
              </div>
              <span className="text-[9px] uppercase text-[#666]">{run.source_site} · {formatDate(run.searched_at)}</span>
            </div>
            {run.parent_query ? <p className="mt-1 text-[9px] text-[#666]">Generată din „{run.parent_query}”</p> : null}
            {run.error ? <p className="mt-2 text-[10px] text-[#991b1b]">{run.error}</p> : null}
            {run.offers?.length ? <ul className="mt-2 divide-y divide-[#111]/10">
              {run.offers.slice(0, 3).map((offer) => <li key={offer.url} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[10px]">
                <a href={offer.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 hover:underline">{offer.title}</a>
                <span className="shrink-0 font-bold">{offer.priceRon ? `${offer.priceRon.toLocaleString("ro-RO")} RON` : "preț necunoscut"}</span>
              </li>)}
            </ul> : null}
            {run.suggested_queries?.length ? <p className="mt-2 text-[9px] text-[#555]">Sugestii noi: {run.suggested_queries.join(" · ")}</p> : null}
          </li>)}
          {!loading && !runs.length ? <li className="border border-[#111]/15 bg-white p-4 text-xs text-[#666]">Prima probă automată va apărea aici după activarea cozii.</li> : null}
        </ul>
      </div>
    </div>
    <p className="border-t border-[#111]/15 p-4 text-[10px] leading-relaxed text-[#666]">Probeaza doar căutări de produse valide, recurente și filtrate pentru date personale ori termeni ofensatori. JEV nu este apelat de această funcție.</p>
  </section>;
}
