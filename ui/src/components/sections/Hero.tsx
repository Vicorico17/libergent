"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

const MONO  = "var(--font-mono-var), monospace";
const PINK  = "#FF4F8B";
const INK   = "#101010";
const CREAM = "#F3F0E7";

/* ── City marker ── */
function CityMarker({
  name,
  style,
  reverse = false,
  pingDelay = "0s",
  lineWidth = 48,
}: {
  name: string;
  style: React.CSSProperties;
  reverse?: boolean;
  pingDelay?: string;
  lineWidth?: number;
}) {
  return (
    <div
      className={`absolute flex items-center ${reverse ? "flex-row-reverse" : ""}`}
      style={style}
    >
      <span
        className={`text-[9px] font-bold uppercase opacity-70 whitespace-nowrap ${reverse ? "ml-3" : "mr-3"}`}
        style={{ fontFamily: MONO, letterSpacing: "0.1em" }}
      >
        {name}
      </span>
      <div
        className={`border-t-[1.5px] border-dashed border-[#101010]/40 shrink-0 ${reverse ? "ml-2" : "mr-2"}`}
        style={{ width: lineWidth }}
      />
      <div className="relative w-5 h-5 flex items-center justify-center shrink-0">
        <div
          className="absolute inset-0 bg-[#FF4F8B]/20 animate-ping"
          style={{ animationDuration: pingDelay }}
        />
        <div className="absolute inset-0 border-[1.5px] border-[#FF4F8B]" />
        <div className="w-1.5 h-1.5 bg-[#FF4F8B]" />
      </div>
    </div>
  );
}

/* ── Source row ── */
const SOURCES = [
  { code: "OX", name: "OLX",     delay: "0s" },
  { code: "V",  name: "VINTED",  delay: "0.2s" },
  { code: "OK", name: "OKAZII",  delay: "0.4s" },
  { code: "P",  name: "PUBLI24", delay: "0.1s" },
  { code: "A",  name: "AUTOVIT", delay: "0.5s" },
];

/* ── Checklist ── */
const CHECKLIST: [string, boolean][] = [
  ["Elimin duplicate",  false],
  ["Analizez prețuri",  false],
  ["Sortez rezultate",  true],
];

export function Hero() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <section
      className="pt-[108px] md:pt-[90px] min-h-screen flex items-center"
      style={{ background: CREAM, fontFamily: MONO }}
    >
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-12 w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center py-10 sm:py-16 lg:py-20">

        {/* ── LEFT ── */}
        <div className="lg:col-span-5 flex flex-col gap-8 lg:pr-8">

          {/* Headline */}
          <h1
            className="font-semibold leading-[1.1]"
            style={{ fontFamily: MONO, fontSize: "clamp(40px, 5.5vw, 72px)", color: INK }}
          >
            Cauți mai puțin<span style={{ color: PINK }}>.</span>
            <br />
            Găsești mai bine<span style={{ color: PINK }}>.</span>
          </h1>

          {/* Body copy */}
          <p className="text-base lg:text-lg leading-relaxed max-w-lg" style={{ color: `${INK}E6` }}>
            LiberGent caută produse second-hand pe mai multe platforme din România
            și îți arată doar rezultatele care merită atenția ta.
          </p>

          {/* Search form with gradient hover border */}
          <div className="mt-4 relative group w-full max-w-xl">
            {/* Gradient border overlay — visible on hover */}
            <div
              className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              style={{
                inset: "-1px",
                background: `linear-gradient(90deg, ${PINK}, ${INK}, ${PINK})`,
                zIndex: 0,
              }}
            />
            <form
              onSubmit={handleSubmit}
              className="relative flex flex-col sm:flex-row"
              style={{ border: `1px solid ${INK}`, zIndex: 1, background: `${CREAM}80` }}
            >
              <div
                className="flex-grow flex items-center px-4 py-3 sm:py-4 border-b sm:border-b-0 sm:border-r"
                style={{ borderColor: INK, background: CREAM }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="shrink-0 mr-3 opacity-50">
                  <circle cx="11" cy="11" r="8" stroke={INK} strokeWidth="2" />
                  <path d="M21 21l-4.35-4.35" stroke={INK} strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Caută produsul..."
                  className="bg-transparent outline-none w-full text-lg font-semibold"
                  style={{ fontFamily: MONO, color: INK }}
                  autoComplete="off"
                />
              </div>
              <button
                type="submit"
                className="font-bold text-[12px] tracking-widest px-8 py-4 transition-colors whitespace-nowrap uppercase flex items-center justify-center gap-3 shrink-0"
                style={{ background: INK, color: "white", fontFamily: MONO }}
                onMouseEnter={(e) => (e.currentTarget.style.background = PINK)}
                onMouseLeave={(e) => (e.currentTarget.style.background = INK)}
              >
                CAUTĂ GRATUIT
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </form>
          </div>

          {/* Status line */}
          <div className="flex items-center gap-2 text-sm mt-2" style={{ color: `${INK}CC` }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke={PINK} strokeWidth="2" strokeLinejoin="round" />
            </svg>
            <span style={{ fontFamily: MONO }}>
              Agentul este <span style={{ color: PINK }}>activ</span>. Găsim noi restul.
            </span>
          </div>
        </div>

        {/* ── RIGHT — terminal dashboard ── */}
        <div className="lg:col-span-7 w-full h-full relative group">
          <div
            className="flex flex-col w-full min-h-[430px] sm:min-h-[550px] overflow-hidden transition-all duration-300 relative z-10 cursor-default"
            style={{
              border: `1.5px solid ${INK}`,
              boxShadow: `8px 8px 0 0 ${INK}`,
              background: CREAM,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = "translate(-4px,-4px)";
              (e.currentTarget as HTMLDivElement).style.boxShadow = `12px 12px 0 0 ${INK}`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = "";
              (e.currentTarget as HTMLDivElement).style.boxShadow = `8px 8px 0 0 ${INK}`;
            }}
          >
            {/* Header bar */}
            <div
              className="flex justify-between items-center px-4 py-3"
              style={{ borderBottom: `1.5px solid ${INK}`, background: "rgba(255,255,255,0.4)" }}
            >
              <span className="font-bold tracking-widest text-[13px] uppercase" style={{ fontFamily: MONO }}>
                LIVE SEARCH
              </span>
              <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-3 h-3" style={{ background: INK, opacity: 0.8 }} />
                ))}
              </div>
            </div>

            {/* Scan status */}
            <div
              className="px-5 py-3 text-sm flex items-center gap-2"
              style={{ borderBottom: `1.5px solid ${INK}20`, background: "rgba(255,255,255,0.2)" }}
            >
              <span className="font-bold animate-pulse" style={{ color: PINK }}>&gt;</span>
              <span className="opacity-70" style={{ fontFamily: MONO }}>scanare în desfășurare...</span>
            </div>

            {/* Map area */}
            <div
              className="relative overflow-hidden"
              style={{ height: 320, borderBottom: `1.5px solid ${INK}`, background: "rgba(255,255,255,0.3)" }}
            >
              {/* Uniform dot grid background */}
              <div className="absolute inset-0 pointer-events-none opacity-35">
                <svg width="100%" height="100%">
                  <defs>
                    <pattern id="hero-dots" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
                      <rect x="0" y="0" width="2.5" height="2.5" fill={INK} />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#hero-dots)" />
                </svg>
              </div>

              {/* Scan line */}
              <div className="scan-line absolute left-0 right-0 h-[2px] pointer-events-none" style={{ background: `${PINK}35` }} />

              {/* City markers */}
              <div className="relative w-full max-w-[500px] h-full mx-auto">
                <CityMarker name="CLUJ"      style={{ top: "25%", left: "20%" }} pingDelay="2s"   lineWidth={48} />
                <CityMarker name="TIMIȘOARA" style={{ top: "50%", left: "10%" }} pingDelay="3s"   lineWidth={64} />
                <CityMarker name="CRAIOVA"   style={{ bottom: "20%", left: "25%" }} pingDelay="2.5s" lineWidth={40} />
                <CityMarker name="IAȘI"      style={{ top: "20%", right: "15%" }} pingDelay="1.8s" lineWidth={56} reverse />
                <CityMarker name="BRAȘOV"    style={{ top: "45%", right: "25%" }} pingDelay="2.2s" lineWidth={64} reverse />
                <CityMarker name="BUCUREȘTI" style={{ bottom: "25%", right: "10%" }} pingDelay="1.5s" lineWidth={80} reverse />
              </div>
            </div>

            {/* Lower data area */}
            <div className="flex flex-col md:flex-row flex-grow" style={{ background: "rgba(255,255,255,0.4)" }}>

              {/* Active sources */}
              <div
                className="w-full md:w-[35%] p-5 flex flex-col gap-4"
                style={{ borderBottom: `1.5px solid ${INK}`, borderRight: "none" }}
              >
                <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1" style={{ fontFamily: MONO }}>
                  Surse Active
                </h3>
                <div className="flex flex-col gap-3">
                  {SOURCES.map((s) => (
                    <div key={s.name} className="flex justify-between items-center text-[12px]">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 text-white flex items-center justify-center text-[9px] font-bold shrink-0"
                          style={{ background: INK }}
                        >
                          {s.code}
                        </div>
                        <span className="font-semibold" style={{ fontFamily: MONO }}>{s.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 bg-green-500"
                          style={{ animation: `pulse 1.5s ease-in-out infinite ${s.delay}` }}
                        />
                        <span className="text-[10px] opacity-60 tracking-widest" style={{ fontFamily: MONO }}>ONLINE</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Checklist + metrics */}
              <div
                className="flex-1 p-5 flex flex-col justify-between"
                style={{ borderLeft: `1.5px solid ${INK}` }}
              >
                {/* Checklist */}
                <div className="flex flex-col gap-3 mt-2">
                  {CHECKLIST.map(([label, dimmed]) => (
                    <div key={label} className="flex items-end text-[13px]">
                      <span className="font-semibold whitespace-nowrap" style={{ fontFamily: MONO }}>{label}</span>
                      <div
                        className="flex-grow mx-3 mb-[6px]"
                        style={{ borderBottom: `1.5px dotted ${INK}40` }}
                      />
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        className={`shrink-0 ${dimmed ? "opacity-35 animate-pulse" : ""}`}
                      >
                        <path d="M20 6L9 17l-5-5" stroke={INK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  ))}
                </div>

                {/* Metrics card */}
                <div
                  className="mt-6 p-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4"
                  style={{ border: `1.5px solid ${INK}`, background: "rgba(255,255,255,0.6)" }}
                >
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1" style={{ fontFamily: MONO }}>
                      Rezultate actuale
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold leading-none" style={{ fontFamily: MONO }}>297</span>
                      <span className="text-[10px] uppercase font-semibold opacity-70" style={{ fontFamily: MONO }}>anunțuri găsite</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-start sm:items-end">
                    <div className="flex gap-1 mb-2">
                      {[...Array(8)].map((_, i) => (
                        <div
                          key={i}
                          className="w-3 h-4"
                          style={i < 5
                            ? { background: INK }
                            : { border: `1.5px solid ${INK}` }
                          }
                        />
                      ))}
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[10px] uppercase font-semibold opacity-70" style={{ fontFamily: MONO }}>relevanță</span>
                      <span className="text-lg font-bold leading-none" style={{ fontFamily: MONO }}>84%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer status */}
            <div
              className="px-5 py-3 text-[11px] flex items-center gap-2 shrink-0"
              style={{ borderTop: `1.5px solid ${INK}`, background: `${CREAM}CC` }}
            >
              <span style={{ color: PINK }}>&gt;</span>
              <span className="opacity-80" style={{ fontFamily: MONO }}>
                agent <span className="font-semibold" style={{ color: PINK }}>activ</span>. continuăm căutarea celor mai bune oferte.
              </span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
