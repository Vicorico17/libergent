"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { LogoIcon } from "@/components/LogoIcon";
import { MascotNewspaper } from "@/components/MascotSVG";
import { agentStats, count, latestTimestamp, recentProbes, sampleStats, validCount, type History, type Source, type Radar } from "./stats-data";
import styles from "./stats.module.css";

type Snapshot = { history: History | null; sources: Source[] | null; radar: Radar | null; checkedAt: number; errors: string[] };
const format = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString("ro-RO");
function date(value: string | null) {
  return value ? new Date(value).toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short" }) : "Nicio activitate înregistrată";
}
async function fetchJson(path: string, signal: AbortSignal) {
  const response = await fetch(path, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Unavailable");
  const data = await response.json();
  if (!data || data.error) throw new Error("Unavailable");
  return data;
}
function Metric({ label, value, note, accent = false }: { label: string; value: string; note: string; accent?: boolean }) {
  return <article className={styles.metric} data-accent={accent}><p>{label}</p><strong>{value}</strong><span>{note}</span></article>;
}
export function StatsDashboard() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    let busy = false;
    let controller: AbortController | null = null;
    async function refresh() {
      if (busy || document.hidden) return;
      busy = true;
      setRefreshing(true);
      controller = new AbortController();
      const timer = setTimeout(() => controller?.abort(), 12_000);
      const results = await Promise.allSettled([
        fetchJson("/api/history", controller.signal).then(data => {
          if (!validCount(data.totals?.searches) || !validCount(data.totals?.uniqueQueries) || !Array.isArray(data.recentSearches) || !Array.isArray(data.dailyTrend)) throw new Error("Invalid history");
          return data as History;
        }),
        fetchJson("/api/sources", controller.signal).then(data => {
          if (!Array.isArray(data.sources)) throw new Error("Invalid sources");
          return data.sources.filter((source: Source) => typeof source?.domain === "string") as Source[];
        }),
        fetchJson("/api/discovery/probes", controller.signal).then(data => {
          if (!Array.isArray(data.runs) || !Array.isArray(data.sources)) throw new Error("Invalid radar");
          return data as Radar;
        }),
      ]);
      clearTimeout(timer);
      if (!disposed) {
        const [history, sources, radar] = results;
        setSnapshot({ history: history.status === "fulfilled" ? history.value : null, sources: sources.status === "fulfilled" ? sources.value : null, radar: radar.status === "fulfilled" ? radar.value : null, checkedAt: Date.now(), errors: results.flatMap((result, index) => result.status === "rejected" ? [["istoricul căutărilor", "catalogul surselor", "activitatea Discovery"][index]] : []) });
        setRefreshing(false);
      }
      busy = false;
    }
    void refresh();
    const interval = setInterval(() => void refresh(), 30_000);
    const visible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => { disposed = true; controller?.abort(); clearInterval(interval); document.removeEventListener("visibilitychange", visible); };
  }, [attempt]);

  const history = snapshot?.history || null;
  const radar = snapshot?.radar || null;
  const sources = snapshot?.sources || null;
  const sample = sampleStats(history);
  const agents = agentStats(radar);
  const recent = recentProbes(radar?.runs || [], snapshot?.checkedAt || 0);
  const recentSources = new Set(recent.map(run => run.source_site)).size;
  const lastSearch = latestTimestamp(history?.recentSearches.map(entry => entry.searchedAt) || []);
  const lastProbe = latestTimestamp(radar?.runs.map(run => run.searched_at) || []);
  const trend = (history?.dailyTrend || []).filter(day => /^\d{4}-\d{2}-\d{2}$/.test(day.date) && validCount(day.count)).slice(-14);
  const maxDaily = Math.max(1, ...trend.map(day => day.count));
  const runs = [...(radar?.runs || [])].filter(run => Number.isFinite(Date.parse(run.searched_at))).sort((a, b) => Date.parse(b.searched_at) - Date.parse(a.searched_at)).slice(0, 6);

  return <div className={styles.page}>
    <Navbar />
    <main className={styles.main}>
      <header className={styles.hero}>
        <div><p className={styles.eyebrow}>LIBERGENT / ÎN CIFRE</p><h1>Mai puțin zgomot.<br /><span>Mai multe date.</span></h1><p className={styles.intro}>Câte căutări facem, ce rezultate găsim și când au lucrat ultima dată agenții LiberGent.</p></div>
        <div className={styles.heroMascot}><LogoIcon size={112} /><span>OBSERVĂ. COMPARĂ. RAPORTEAZĂ.</span></div>
      </header>
      <div className={styles.toolbar}>
        <p role="status"><span className={styles.indicator} data-ok={Boolean(snapshot && !snapshot.errors.length)} />{refreshing ? "Actualizăm datele…" : snapshot?.errors.length ? "Date parțial indisponibile" : "Conectat la datele LiberGent"}<small>Actualizare automată la 30 secunde{snapshot ? ` · ${new Date(snapshot.checkedAt).toLocaleTimeString("ro-RO")}` : ""}</small></p>
        <button type="button" disabled={refreshing} onClick={() => setAttempt(value => value + 1)}><RefreshCw size={14} aria-hidden="true" />Actualizează</button>
      </div>
      {snapshot && snapshot.errors.length > 0 && <p className={styles.error} role="alert">Nu putem încărca: {snapshot.errors.join(", ")}. Valorile lipsă apar ca „—”. Poți reîncerca folosind Actualizează.</p>}
      <section className={styles.metrics} aria-label="Statistici principale">
        <Metric label="Căutări înregistrate" value={format(history?.totals.searches)} note="În istoricul serverului LiberGent" accent />
        <Metric label="Căutări distincte" value={format(history?.totals.uniqueQueries)} note="Termeni diferiți în istoricul serverului" />
        <Metric label="Surse în catalog" value={sources ? format(new Set(sources.map(source => source.domain)).size) : "—"} note="Marketplace-uri și magazine · nu toate sunt active" />
        <Metric label="Verificări automate · 15 min" value={radar ? format(recent.length) : "—"} note={radar ? `${recentSources} surse distincte în verificările recente disponibile` : "Activitate Discovery indisponibilă"} />
      </section>
      <section className={styles.panel} aria-labelledby="agents-heading">
        <div className={styles.sectionHeader}><div><p className={styles.eyebrow}>PULSUL LIBERGENT</p><h2 id="agents-heading">Agenții, la vedere.</h2></div><Link href="/discovery">Explorează Discovery <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
        <p className={styles.note}>Măsurători din căutările salvate și execuțiile Discovery. Se actualizează la 30 secunde; nu reprezintă un contor al agenților care rulează acum.</p>
        <div className={styles.agentCards}>
          <article className={styles.agentCard}>
            <header><LogoIcon size={52} /><div><h3>Agent de căutare</h3><span className={styles.badge}>{history ? `${sample.size} căutări în eșantion` : "Date indisponibile"}</span></div></header>
            <dl className={styles.agentMetrics}>
              <div><dt>Căutări înregistrate · total</dt><dd>{format(history?.totals.searches)}</dd></div>
              <div><dt>Oferte returnate · eșantion</dt><dd>{format(sample.listings)}</dd></div>
              <div><dt>Căutări cu rezultate · eșantion</dt><dd>{sample.withResults == null ? "—" : `${sample.withResults}%`}</dd></div>
              <div><dt>Răspunsuri reușite de la surse</dt><dd>{sample.sourceSuccess == null ? "—" : `${sample.sourceSuccess}%`}</dd></div>
            </dl>
            <p className={styles.agentTimestamp}>Ultima căutare: <strong>{history ? date(lastSearch) : "—"}</strong></p>
            <p className={styles.note}>Ofertele sunt însumate în ultimele {sample.size} căutări disponibile, fără deduplicare între căutări.</p>
          </article>
          <article className={styles.agentCard}>
            <header><MascotNewspaper size={48} /><div><h3>Agent Discovery</h3><span className={styles.badge} data-active={recent.length > 0}>{!radar ? "Date indisponibile" : `${recent.length} verificări în ultimele 15 min · eșantion`}</span></div></header>
            <dl className={styles.agentMetrics}>
              <div><dt>Execuții în eșantion</dt><dd>{radar ? format(agents.runs) : "—"}</dd></div>
              <div><dt>Oferte găsite</dt><dd>{format(agents.offers)}</dd></div>
              <div><dt>Anunțuri citite</dt><dd>{format(agents.parsed)}</dd></div>
              <div><dt>Durată mediană / execuție</dt><dd>{agents.medianMs == null ? "—" : `${(agents.medianMs / 1000).toLocaleString("ro-RO", { maximumFractionDigits: 1 })} s`}</dd></div>
            </dl>
            {radar && <div className={styles.outcomes}><span data-kind="success">{agents.withOffers} cu oferte</span><span>{agents.empty} fără oferte</span><span data-kind="error">{agents.errors} erori</span></div>}
            <p className={styles.agentTimestamp}>Ultima verificare: <strong>{radar ? date(lastProbe) : "—"}</strong></p>
            <p className={styles.note}>Ultimele {radar ? agents.runs : "—"} execuții disponibile. Ofertele pot fi găsite în mai multe execuții.</p>
          </article>
        </div>
        <div className={styles.sourceHeading}><h3>Activitate reală, sursă cu sursă</h3><p className={styles.note}>Din aceleași execuții Discovery. Sursele fără execuții în eșantion nu sunt marcate ca active.</p></div>
        {!radar ? <p className={styles.empty}>{snapshot ? "Datele Discovery sunt indisponibile. Reîncearcă actualizarea." : "Se încarcă execuțiile…"}</p> : !agents.sourceRows.length ? <p className={styles.empty}>Nu există încă execuții sau surse raportate.</p> : <div className={styles.sourceTableWrap} tabIndex={0} role="region" aria-label="Activitate Discovery pe surse, tabel derulabil">
          <table className={styles.sourceTable}><caption>Execuții și rezultate pentru fiecare sursă · eșantion de {agents.runs} verificări</caption><thead><tr><th scope="col">Sursă</th><th scope="col">Execuții</th><th scope="col">Cu oferte</th><th scope="col">Erori</th><th scope="col">Ultima execuție</th><th scope="col">Următoarea verificare</th></tr></thead><tbody>
            {agents.sourceRows.map(source => <tr key={source.site}><th scope="row">{source.site}</th><td>{source.checks}</td><td>{source.withOffers}</td><td>{source.errors}</td><td><span className={styles.badge} data-active={source.outcome === "results"}>{source.outcome === "results" ? "Oferte găsite" : source.outcome === "error" ? "Eroare" : source.outcome === "empty" ? "Fără oferte" : "Fără execuții în eșantion"}</span><small>{source.latest ? date(source.latest) : "—"}</small></td><td>{source.coolingDown ? <>Pauză programată<small>{source.retryAt && Number.isFinite(Date.parse(source.retryAt)) ? `Eligibilă după ${date(source.retryAt)}` : "Ora nu este raportată"}</small></> : "Fără pauză raportată"}</td></tr>)}
          </tbody></table>
        </div>}
        <p className={styles.note}>Pauzele pot urma atât verificări reușite, cât și erori. Ora de eligibilitate nu garantează ora următoarei execuții.</p>
        <div className={styles.repairSummary}><span><strong>{format(agents.openRepairs)}</strong> cazuri sursă + căutare de reverificat</span><span><strong>{format(agents.recovered)}</strong> cazuri cu oferte la ultima reverificare</span></div>
        <p className={styles.note}>Cazurile de reverificare provin din ultimele maximum 100 de execuții analizate de server; pot include căutări fără rezultate, nu doar erori.</p>
      </section>
      <div className={styles.columns}>
        <section className={styles.panel} aria-labelledby="trend-heading"><p className={styles.eyebrow}>RITMUL CĂUTĂRILOR</p><h2 id="trend-heading">Activitate pe zile</h2><p className={styles.note}>Ultimele {trend.length} zile cu date, din maximum 500 de căutări recente. Zilele sunt în UTC; valorile pot fi parțiale.</p>
          {!history ? <p className={styles.empty}>{snapshot ? "Istoric indisponibil." : "Se încarcă istoricul…"}</p> : !trend.length ? <p className={styles.empty}>Graficul va apărea după primele căutări.</p> : <div className={styles.chart} role="list" aria-label="Căutări pe zi">{trend.map(day => <div key={day.date} role="listitem" className={styles.barColumn} title={`${day.date}: ${day.count} căutări`} aria-label={`${day.date}: ${day.count} căutări`}><span>{format(day.count)}</span><div className={styles.barTrack}><div style={{ height: `${day.count / maxDaily * 100}%` }} /></div><small>{day.date.slice(8)}/{day.date.slice(5, 7)}</small></div>)}</div>}
        </section>
        <section className={styles.panel} aria-labelledby="results-heading"><p className={styles.eyebrow}>CE GĂSIM</p><h2 id="results-heading">Rezultate recente</h2><p className={styles.note}>Eșantion: {history ? sample.size : "—"} căutări recente. Ofertele pot apărea în mai multe căutări; nu sunt produse unice.</p><dl className={styles.results}><div><dt>Oferte returnate</dt><dd>{format(sample.listings)}</dd></div><div><dt>Căutări cu rezultate</dt><dd>{sample.withResults == null ? "—" : `${sample.withResults}%`}</dd></div><div><dt>Răspunsuri reușite de la surse</dt><dd>{sample.sourceSuccess == null ? "—" : `${sample.sourceSuccess}%`}</dd></div></dl><Link href="/#cautare" className={styles.cta}>Pornește o căutare <ArrowUpRight size={18} aria-hidden="true" /></Link></section>
      </div>
      <section className={styles.panel} aria-labelledby="activity-heading"><div className={styles.sectionHeader}><div><p className={styles.eyebrow}>JURNAL AUTOMAT</p><h2 id="activity-heading">Ultimele verificări Discovery</h2></div><span className={styles.note}>Cele mai recente 6 verificări</span></div>
        {!radar ? <p className={styles.empty}>{snapshot ? "Activitatea automată nu este disponibilă momentan." : "Se încarcă activitatea…"}</p> : !runs.length ? <p className={styles.empty}>Nu există încă verificări înregistrate.</p> : <ul className={styles.activity}>{runs.map((run, index) => <li key={`${run.id}-${index}`}><LogoIcon size={26} /><div><strong>{run.source_site}</strong><small>{date(run.searched_at)}</small></div><span className={styles.badge} data-active={run.outcome === "results"}>{run.outcome === "results" ? `${format(count(run.results_count))} oferte` : run.outcome === "error" ? "Verificare nereușită" : run.outcome === "empty" ? "Fără oferte" : "Stare necunoscută"}</span></li>)}</ul>}
      </section>
      <p className={styles.footnote}>Cifrele provin din istoricul serverului, catalogul surselor și verificările automate Discovery. Nu includ căutări nesalvate sau un contor în timp real al utilizatorilor. Nu afișăm valori demonstrative.</p>
    </main><Footer />
  </div>;
}
