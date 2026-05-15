"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";

const BG   = "#F3F0E7";
const INK  = "#101010";
const PINK = "#FF4F8B";
const MONO = "var(--font-mono-var), monospace";

// ── Data ──────────────────────────────────────────────────────────────────────

const TOP_QUERIES = [
  { rank: 1,  query: "iphone 15",                count: 28 },
  { rank: 2,  query: "jeep compass",              count: 9  },
  { rank: 3,  query: "masa",                      count: 6  },
  { rank: 4,  query: "iphone",                    count: 4  },
  { rank: 5,  query: "ochelari lumina albastra",  count: 4  },
  { rank: 6,  query: "bmw",                       count: 4  },
  { rank: 7,  query: "trompeta",                  count: 3  },
  { rank: 8,  query: "iphone 17",                 count: 3  },
  { rank: 9,  query: "iphone 16",                 count: 3  },
  { rank: 10, query: "samsung combina frigorifica", count: 3 },
  { rank: 11, query: "kirby",                     count: 3  },
  { rank: 12, query: "airfryer",                  count: 3  },
];

const DAILY_VOLUME = [
  { date: "2026-04-07", count: 1,  pct: 2   },
  { date: "2026-04-13", count: 9,  pct: 18  },
  { date: "2026-04-15", count: 5,  pct: 10  },
  { date: "2026-04-17", count: 23, pct: 47  },
  { date: "2026-04-18", count: 3,  pct: 6   },
  { date: "2026-04-20", count: 5,  pct: 10  },
  { date: "2026-04-24", count: 8,  pct: 16  },
  { date: "2026-05-06", count: 31, pct: 63  },
  { date: "2026-05-07", count: 11, pct: 22  },
  { date: "2026-05-08", count: 5,  pct: 10  },
  { date: "2026-05-13", count: 49, pct: 100 },
  { date: "2026-05-14", count: 9,  pct: 18  },
  { date: "2026-05-15", count: 11, pct: 22  },
];

const TOP_KEYWORDS = [
  { kw: "iphone",      n: 41 }, { kw: "jeep",       n: 13 },
  { kw: "compass",     n: 13 }, { kw: "masa",        n: 7  },
  { kw: "samsung",     n: 6  }, { kw: "bmw",         n: 6  },
  { kw: "ochelari",    n: 4  }, { kw: "lumina",      n: 4  },
  { kw: "albastra",    n: 4  }, { kw: "minge",       n: 4  },
  { kw: "inductie",    n: 4  }, { kw: "trompeta",    n: 3  },
  { kw: "dinti",       n: 3  }, { kw: "tigaie",      n: 3  },
  { kw: "valiza",      n: 3  }, { kw: "roti",        n: 3  },
  { kw: "combina",     n: 3  }, { kw: "frigorifica", n: 3  },
  { kw: "kirby",       n: 3  }, { kw: "placa",       n: 3  },
];

const RECENT_SEARCHES = [
  { query: "casca",     listings: 562, time: "16 mai 2026, 00:54", detail: "4/5 marketplace-uri · Best offer: Casca Oneal impecabila · 170 RON" },
  { query: "casca",     listings: 434, time: "16 mai 2026, 00:53", detail: "3/5 marketplace-uri · Best offer: Cască Moto/Scuter · Ochelari Soare Încorporați · Mărime XL · ECE 22.05 · 220 RON" },
  { query: "pisica",    listings: 107, time: "16 mai 2026, 00:53", detail: "3/5 marketplace-uri · Best offer: Litieră acoperită pisică tip ratan cu tăviță/grătar — ca nouă · 120 RON" },
  { query: "iphone 15", listings: 268, time: "16 mai 2026, 00:53", detail: "5/5 marketplace-uri · Best offer: Iphone 15 impecabil · 1.450 RON" },
  { query: "Racheta",   listings: 260, time: "16 mai 2026, 00:53", detail: "4/5 marketplace-uri · Best offer: Racheta tenis fischer · 100 RON" },
];

const METRICS = [
  { label: "Total Searches",   value: 170 },
  { label: "Unique Queries",   value: 98  },
  { label: "Unique Keywords",  value: 127 },
];

// ── Tiny SVG icons ─────────────────────────────────────────────────────────────

function IconSearch() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={PINK} strokeWidth="1.8" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={PINK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="1" /><path d="M8 17V13M12 17V9M16 17V13" />
    </svg>
  );
}
function IconHash() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={PINK} strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
    </svg>
  );
}
function IconServer() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}
function IconTrendUp() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={PINK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

// ── Count-up hook ──────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1400) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const steps = 50;
    const step = duration / steps;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setVal(Math.floor((target * i) / steps));
      if (i >= steps) { setVal(target); clearInterval(id); }
    }, step);
    return () => clearInterval(id);
  }, [target, duration]);
  return val;
}

// ── Components ─────────────────────────────────────────────────────────────────

function MetricCard({ label, value, icon, delay }: { label: string; value: number; icon: React.ReactNode; delay: number }) {
  const displayed = useCountUp(value);
  return (
    <div
      className="relative flex items-center gap-5 hover:-translate-y-1 hover:-translate-x-1 transition-all duration-200 cursor-default"
      style={{ border: `1px solid ${INK}`, background: "white", boxShadow: `4px 4px 0 0 ${INK}`, padding: "20px" }}
    >
      <div className="absolute top-2 right-2 w-1.5 h-1.5 animate-pulse" style={{ background: PINK, animationDelay: `${delay}ms` }} />
      <div className="w-12 h-12 flex items-center justify-center shrink-0" style={{ border: `1px solid ${INK}`, background: BG }}>
        {icon}
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-widest mb-1 font-bold" style={{ color: `${INK}80`, fontFamily: MONO }}>{label}</div>
        <div className="font-bold leading-none" style={{ fontSize: 36, fontFamily: MONO, color: INK }}>{displayed}</div>
      </div>
    </div>
  );
}

function CardShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="relative" style={{ border: `1px solid ${INK}`, background: BG, boxShadow: `4px 4px 0 0 ${INK}`, padding: "24px" }}>
      <div className="absolute top-3 right-3 flex gap-1">
        {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: INK }} />)}
      </div>
      <div className="mb-5">
        <h2 className="text-[12px] font-bold uppercase tracking-widest" style={{ color: INK, fontFamily: MONO }}>{title}</h2>
        <p className="text-[11px] mt-1" style={{ color: `${INK}80`, fontFamily: MONO }}>{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function BarsSection() {
  const [active, setActive] = useState(false);
  useEffect(() => { const t = setTimeout(() => setActive(true), 400); return () => clearTimeout(t); }, []);
  return (
    <div className="space-y-2.5 mt-2">
      {DAILY_VOLUME.map((d) => (
        <div
          key={d.date}
          className="flex items-center gap-4 text-[11px] group cursor-default hover:bg-white transition-colors px-1 -mx-1"
          style={{ fontFamily: MONO }}
        >
          <div className="w-[88px] shrink-0" style={{ color: `${INK}80` }}>{d.date}</div>
          <div className="flex-grow relative h-4 flex items-center">
            <div className="absolute inset-x-0 bottom-0 h-px" style={{ borderBottom: `1px dotted ${INK}40` }} />
            <div
              className="absolute left-0 h-[6px] transition-all duration-1000 ease-out"
              style={{ width: active ? `${d.pct}%` : "0%", background: PINK }}
            />
          </div>
          <div
            className="w-6 text-right font-bold shrink-0"
            style={{ color: d.pct === 100 ? PINK : INK, fontFamily: MONO }}
          >
            {d.count}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function TrenduriPage() {
  const router = useRouter();
  const [searchVal, setSearchVal] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchVal.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <div style={{ background: BG, fontFamily: MONO, minHeight: "100vh" }}>
      <Navbar />

      {/* Background decor */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-40">
        <svg className="absolute top-1/4 -left-10 w-64 h-64" viewBox="0 0 100 100" fill="none">
          <path d="M0,100 C40,100 80,60 100,0" stroke={INK} strokeWidth="0.5" strokeDasharray="2 4" />
        </svg>
        <svg className="absolute top-1/2 -right-20 w-96 h-96" viewBox="0 0 100 100" fill="none">
          <path d="M100,100 C60,100 20,60 0,0" stroke={INK} strokeWidth="0.5" strokeDasharray="2 4" />
        </svg>
        <div className="absolute top-1/4 left-1/4 w-2 h-2 animate-pulse" style={{ background: PINK, border: `1px solid ${INK}` }} />
        <div className="absolute bottom-1/4 right-12 w-2.5 h-2.5" style={{ background: PINK, border: `1px solid ${INK}` }} />
      </div>

      <main className="relative z-10 max-w-[1440px] mx-auto px-4 md:px-8 pt-[100px] pb-16 space-y-8">

        {/* Hero row */}
        <div className="flex flex-col lg:flex-row justify-between items-start gap-8 mt-4">
          <div className="max-w-xl">
            <div
              className="inline-flex items-center gap-2 px-2.5 py-1 text-[11px] mb-5 bg-white cursor-default hover:-translate-y-0.5 transition-transform"
              style={{ border: `1px solid ${INK}`, boxShadow: `2px 2px 0 0 ${INK}`, fontFamily: MONO }}
            >
              <IconTrendUp /> TRENDING SEARCHES
            </div>
            <h1
              className="font-bold leading-[1.05] mb-4"
              style={{ fontSize: "clamp(32px, 5vw, 52px)", color: INK, fontFamily: MONO }}
            >
              Ce caută oamenii<br />pe LiberGent
            </h1>
            <p className="text-[13px] leading-relaxed" style={{ color: `${INK}99`, fontFamily: MONO, maxWidth: 400 }}>
              Top căutări, keywords recente și activitate din istoricul aplicației.
            </p>
          </div>

          {/* Status card */}
          <div
            className="relative group cursor-default w-full lg:w-auto min-w-[300px]"
            style={{ border: `1px solid ${INK}`, background: "white", boxShadow: `4px 4px 0 0 ${INK}`, padding: "20px" }}
          >
            <div className="absolute top-3 right-3 flex gap-1">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: PINK }} />
              ))}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: INK, fontFamily: MONO }}>Status</div>
            <div className="flex flex-col gap-2 text-[11px]" style={{ color: `${INK}CC`, fontFamily: MONO }}>
              <div className="flex items-center gap-2"><IconServer /> Actualizat 16 mai 2026, 00:55 (server).</div>
              <div className="flex items-center gap-2"><IconServer /> Sursă: server</div>
            </div>
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <MetricCard label="Total Searches"  value={170} icon={<IconSearch />} delay={0}   />
          <MetricCard label="Unique Queries"  value={98}  icon={<IconChart />}  delay={200} />
          <MetricCard label="Unique Keywords" value={127} icon={<IconHash />}   delay={400} />
        </div>

        {/* Dashboard grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Left */}
          <div className="space-y-8">

            {/* Top Queries */}
            <CardShell title="Top Queries" subtitle="Cele mai repetate căutări din istoric.">
              <div style={{ borderTop: `1px solid ${INK}`, borderBottom: `1px solid ${INK}` }}>
                {TOP_QUERIES.map((q) => (
                  <div
                    key={q.rank}
                    className="flex justify-between items-center py-2.5 hover:bg-white transition-colors cursor-default group"
                    style={{ borderBottom: `1px solid ${INK}20` }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-6 h-6 flex items-center justify-center text-[11px] font-bold bg-white group-hover:border-[#FF4F8B] transition-colors shrink-0"
                        style={{ border: `1px solid ${INK}`, fontFamily: MONO }}
                      >
                        {q.rank}
                      </div>
                      <span className="text-[12px] font-bold" style={{ fontFamily: MONO }}>{q.query}</span>
                    </div>
                    <span className="text-[12px] font-bold" style={{ color: PINK, fontFamily: MONO }}>{q.count}</span>
                  </div>
                ))}
              </div>
            </CardShell>

            {/* Daily Volume */}
            <CardShell title="Daily Search Volume" subtitle="Volumul căutărilor pe ultimele zile disponibile.">
              <BarsSection />
            </CardShell>
          </div>

          {/* Right */}
          <div className="space-y-8">

            {/* Top Keywords */}
            <CardShell title="Top Keywords" subtitle="Cuvintele care apar cel mai des în căutări.">
              <div className="flex flex-wrap gap-2 mt-4">
                {TOP_KEYWORDS.map((k) => (
                  <div
                    key={k.kw}
                    className="flex gap-3 px-3 py-1.5 text-[11px] bg-white cursor-default transition-all hover:-translate-y-0.5"
                    style={{
                      border: `1px solid ${INK}`,
                      fontFamily: MONO,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = PINK)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = INK)}
                  >
                    <span className="font-bold">{k.kw}</span>
                    <span className="font-bold" style={{ color: PINK }}>{k.n}</span>
                  </div>
                ))}
              </div>
            </CardShell>

            {/* Recent Searches */}
            <CardShell title="Recent Searches" subtitle="Ultimele căutări care au intrat în sistem.">
              <div style={{ borderTop: `1px solid ${INK}`, borderBottom: `1px solid ${INK}` }}>
                {RECENT_SEARCHES.map((r, i) => (
                  <div
                    key={i}
                    className="py-4 hover:bg-white transition-colors cursor-default group -mx-2 px-2"
                    style={{ borderBottom: i < RECENT_SEARCHES.length - 1 ? `1px solid ${INK}20` : undefined }}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div
                        className="text-[13px] font-bold group-hover:transition-colors"
                        style={{ color: INK, fontFamily: MONO }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = PINK)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = INK)}
                      >
                        {r.query}
                      </div>
                      <div className="text-[11px] font-bold" style={{ color: PINK, fontFamily: MONO }}>{r.listings} listings</div>
                    </div>
                    <div className="text-[10px] mb-1.5 flex items-center gap-1.5" style={{ color: `${INK}60`, fontFamily: MONO }}>
                      <IconClock /> {r.time}
                    </div>
                    <div className="text-[11px] leading-relaxed" style={{ color: `${INK}CC`, fontFamily: MONO }}>{r.detail}</div>
                  </div>
                ))}
              </div>
            </CardShell>

          </div>
        </div>
      </main>
    </div>
  );
}
