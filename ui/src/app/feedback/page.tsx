"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccountSession } from "@/lib/use-account-session";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Report = {
  id: string; query: string; feedback: string; reason: string; correctionText?: string; createdAt: string;
  offer: { title: string; url?: string; description?: string; condition?: string; priceRon?: number; evidenceSource: string };
  lane?: string; review?: { status: string; expectedCandidate?: boolean };
  current?: { candidate: boolean; score: number; reasons: string[] };
};
type Payload = {
  rows: Report[]; canReview: boolean; truncated: boolean;
  evaluation?: { total: number; passed: number; falseAccepts: number; falseRejects: number } | null;
};
const reasons: Record<string, string> = {
  relevant: "Relevant", wrong_product: "Alt produs", wrong_model: "Alt model", part_or_accessory: "Piesă sau accesoriu",
  bad_price: "Preț nepotrivit", duplicate: "Duplicat", unavailable: "Indisponibil", other: "Alt motiv",
};

async function feedbackRequest(reviewMode: boolean, method = "GET", body?: object) {
  const client = getSupabaseBrowserClient();
  const session = client ? (await client.auth.getSession()).data.session : null;
  if (!session?.access_token) throw new Error("Autentifică-te pentru a gestiona feedback-ul.");
  const response = await fetch(`/api/feedback${reviewMode ? "/review" : ""}`, {
    method, cache: "no-store", headers: { authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Feedback indisponibil.");
  return payload;
}

function safeUrl(url?: string) {
  try { const parsed = new URL(url || ""); return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : null; } catch { return null; }
}

export default function FeedbackPage() {
  const account = useAccountSession();
  const [reviewMode, setReviewMode] = useState(false);
  const [data, setData] = useState<{ owner: string; reviewMode: boolean; payload: Payload } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const payload = data?.owner === account.userId && data?.reviewMode === reviewMode ? data.payload : null;

  useEffect(() => {
    let cancelled = false;
    if (!account.userId) return;
    feedbackRequest(reviewMode).then(next => {
      if (!cancelled) { setData({ owner: account.userId || "", reviewMode, payload: next }); setError(""); }
    }).catch(failure => { if (!cancelled) setError(failure.message); });
    return () => { cancelled = true; };
  }, [account.userId, reviewMode, revision]);

  async function act(row: Report, status?: string, expectedCandidate?: boolean) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await feedbackRequest(reviewMode, reviewMode ? "PATCH" : "DELETE", reviewMode
        ? { id: row.id, status, expectedCandidate, evidenceChecked: checked[row.id] === true }
        : { id: row.id });
      setRevision(value => value + 1);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Modificarea nu a fost salvată."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#F5F3EE] text-[#111] px-6 py-10">
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/" className="underline">← LiberGent</Link>
      <h1 className="text-3xl font-bold">{reviewMode ? "Verificare feedback" : "Feedback-ul meu"}</h1>
      <p>{reviewMode
        ? "Verifică raportul și decide dacă oferta ar trebui să corespundă căutării. Exemplele confirmate testează motorul actual; regulile comune se modifică după evaluare."
        : "Rapoartele despre produse, modele și accesorii greșite ascund anunțul exact la aceeași căutare, în contul tău. Ștergerea raportului permite afișarea lui din nou. Prețul și disponibilitatea nu creează excluderi permanente."}</p>
      {!account.userId && <p><Link href="/account" className="underline">Autentifică-te</Link> pentru a vedea feedback-ul.</p>}
      {account.userId && <div className="flex gap-4">
        {(payload?.canReview || reviewMode) && <button className="underline" onClick={() => { setReviewMode(value => !value); setChecked({}); }}>
          {reviewMode ? "Feedback-ul meu" : "Verifică rapoartele tuturor utilizatorilor"}
        </button>}
        <button disabled={busy} className="underline" onClick={() => setRevision(value => value + 1)}>Actualizează</button>
      </div>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {account.userId && !payload && !error && <p role="status">Se încarcă feedback-ul…</p>}
      {payload?.truncated && <p>Sunt afișate cele mai recente 200 de rapoarte. Evaluarea de mai jos include doar această selecție.</p>}
      {payload?.evaluation && <section className="border border-black bg-white p-4" aria-live="polite">
        <h2 className="font-bold">Evaluarea exemplelor confirmate</h2>
        <p>{payload.evaluation.passed}/{payload.evaluation.total} corecte · {payload.evaluation.falseAccepts} acceptate greșit · {payload.evaluation.falseRejects} respinse greșit</p>
      </section>}
      {payload?.rows.length === 0 && <p>Nu există rapoarte salvate.</p>}
      {payload?.rows.map(row => <article key={row.id} className="border border-black bg-white p-5 space-y-3">
        <p className="text-sm">Căutare: <Link className="underline" href={`/search?q=${encodeURIComponent(row.query)}`}>{row.query}</Link> · {reasons[row.reason] || row.reason} · {row.feedback === "like" ? "Pozitiv" : "Negativ"}</p>
        <h2 className="text-xl font-bold">{row.offer.title}</h2>
        {safeUrl(row.offer.url) && <a className="underline" href={safeUrl(row.offer.url)!} target="_blank" rel="noopener noreferrer">Deschide anunțul</a>}
        {row.correctionText && <p>Corecția utilizatorului: {row.correctionText}</p>}
        {reviewMode ? <>
          <p className="text-sm">Dovezi: {row.offer.evidenceSource === "client_report" ? "raportate de browser; necesită verificare" : "raport istoric parțial"}. Stare: {row.review?.status || "pending"}.</p>
          {row.offer.description && <details><summary>Descriere capturată</summary><p className="whitespace-pre-wrap">{row.offer.description}</p></details>}
          <p>{row.offer.priceRon ?? "Preț necunoscut"} {row.offer.priceRon != null ? "RON" : ""} · {row.offer.condition || "Stare necunoscută"}</p>
          {row.current && <p>Motorul actual: {row.current.candidate ? "acceptă" : "respinge"} · scor {row.current.score}. {row.current.reasons.join(", ")}</p>}
          {row.lane === "matching" && <label className="flex gap-2"><input type="checkbox" checked={checked[row.id] || false} onChange={event => setChecked(value => ({ ...value, [row.id]: event.target.checked }))} />Am verificat căutarea și dovezile ofertei.</label>}
          <div className="flex flex-wrap gap-3">
            {row.lane === "matching" && <>
              <button disabled={busy || !checked[row.id]} className="border p-2 disabled:opacity-40" onClick={() => act(row, "confirmed", true)}>Ar trebui acceptat</button>
              <button disabled={busy || !checked[row.id]} className="border p-2 disabled:opacity-40" onClick={() => act(row, "confirmed", false)}>Ar trebui respins</button>
            </>}
            <button disabled={busy} className="border p-2" onClick={() => act(row, "rejected")}>Respinge raportul</button>
            <button disabled={busy} className="border p-2" onClick={() => act(row, "pending")}>Lasă în așteptare</button>
          </div>
        </> : <button disabled={busy} className="border border-black p-2 disabled:opacity-40" onClick={() => act(row)}>Șterge raportul și permite afișarea</button>}
      </article>)}
    </div>
  </main>;
}
