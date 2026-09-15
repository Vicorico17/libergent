"use client";

import { useState } from "react";
import Link from "next/link";
import { Footer } from "@/components/Footer";

type Source = { site: string; ok: boolean; itemCount?: number; rawItemCount?: number; parsedItemCount?: number; error?: string };
type Report = {
  results: Source[];
  summary: { totalListings?: number; parsedListings?: number; excludedListings?: number; cacheHit?: boolean; searchedAt?: string };
};

export default function HealthPage() {
  const [query, setQuery] = useState("iphone 15");
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState("");
  const [testedQuery, setTestedQuery] = useState("");
  const [duration, setDuration] = useState(0);

  async function check(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !query.trim()) return;
    setBusy(true);
    setReport(null);
    setError("");
    setChecked("");
    const started = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    setTestedQuery(query.trim());
    try {
      const params = new URLSearchParams({ q: query.trim(), site: "all", provider: "auto", limit: "120", pages: "1" });
      const response = await fetch(`/api/search/free?${params}`, { signal: controller.signal });
      if (!response.headers.get("content-type")?.includes("application/json")) throw new Error(`API nu a returnat JSON (HTTP ${response.status}).`);
      const payload = await response.json();
      if (!response.ok || payload.error) throw new Error(payload.error || `HTTP ${response.status}`);
      if (!Array.isArray(payload.results) || !payload.summary) throw new Error("Răspuns API incomplet.");
      setReport(payload);
    } catch (failure) {
      setError(controller.signal.aborted ? "Verificarea a depășit 120 de secunde. Încearcă din nou." : failure instanceof Error ? failure.message : "Verificarea a eșuat.");
    } finally {
      clearTimeout(timer);
      setChecked(new Date().toLocaleString("ro-RO"));
      setDuration(Math.round(performance.now() - started));
      setBusy(false);
    }
  }

  const failures = report?.results.filter((source) => !source.ok).length || 0;
  const total = report?.summary.totalListings || 0;
  const status = error ? "Verificare eșuată" : !report ? "Neverificat" : report.results.length === 0 || failures === report.results.length ? "Surse indisponibile" : total === 0 ? "Fără rezultate pentru această căutare" : failures ? "Funcționare parțială" : "Căutarea funcționează";

  return (
    <div className="min-h-screen bg-[#F3F0E7] text-[#111]">
      <main className="mx-auto max-w-5xl px-6 py-12 space-y-8">
        <Link href="/" className="underline">← LiberGent</Link>
        <header className="space-y-3">
          <h1 className="text-4xl font-bold">Stare servicii</h1>
          <p>Verifică API-ul de căutare Free și sursele selectate pentru un produs. Verificarea pornește doar la apăsarea butonului.</p>
          <p className="text-sm">Nu verifică autentificarea, Premium, plățile sau alertele. Zero rezultate nu înseamnă automat că serviciul este oprit.</p>
        </header>
        <form onSubmit={check} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-2 flex-1 min-w-48">Produs de test
            <input value={query} onChange={(event) => setQuery(event.target.value)} required maxLength={200} className="border border-black bg-white p-3" />
          </label>
          <button disabled={busy || !query.trim()} className="bg-black text-white p-3 disabled:opacity-50">{busy ? "Se verifică…" : "Rulează healthcheck"}</button>
        </form>
        <section aria-live="polite" aria-busy={busy} className="border border-black bg-white p-6 space-y-3">
          <h2 className="text-2xl font-bold">{busy ? "Verificare în curs…" : status}</h2>
          {checked && <p className="text-sm">Verificat: {checked} · {(duration / 1000).toFixed(1)} secunde · „{testedQuery}”</p>}
          {error && <p role="alert" className="text-red-700 break-words">{error}</p>}
          {report && <>
            <p>{total} rezultate · {report.summary.parsedListings ?? "—"} anunțuri citite · {report.summary.excludedListings ?? "—"} excluse · {failures}/{report.results.length} surse cu erori</p>
            <p className="text-sm">{report.summary.cacheHit ? "Răspuns din cache (până la 5 minute). Nu reprezintă o verificare nouă a surselor." : "Răspuns fără cache."} {report.summary.searchedAt && `Căutare: ${report.summary.searchedAt}`}</p>
            {total === 0 && <p>Verifică ortografia și încearcă un termen mai simplu. Exemplu: „chrome hearts”, nu „chrome hearths”. Compară cu „iphone 15” pentru a verifica o căutare uzuală.</p>}
            <Link className="underline" href={`/search?q=${encodeURIComponent(testedQuery)}`}>Deschide rezultatele căutării →</Link>
          </>}
        </section>
        {report && <div className="overflow-x-auto border border-black bg-white">
          <table className="w-full text-left text-sm">
            <caption className="text-left p-4 font-bold">Surse pentru „{testedQuery}”</caption>
            <thead><tr>{["Sursă", "Stare", "Citite", "Rezultate"].map((title) => <th key={title} className="p-3 border-b">{title}</th>)}</tr></thead>
            <tbody>{report.results.map((source) => <tr key={source.site} className="border-b">
              <th className="p-3 align-top">{source.site}</th>
              <td className="p-3">{!source.ok ? "Eroare" : (source.itemCount || 0) > 0 ? "Rezultate disponibile" : "Fără potriviri"}{source.error && <p className="mt-1 text-red-700 break-words max-w-md">{source.error}</p>}</td>
              <td className="p-3">{source.parsedItemCount ?? source.rawItemCount ?? "—"}</td>
              <td className="p-3">{source.itemCount ?? 0}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </main>
      <Footer />
    </div>
  );
}
