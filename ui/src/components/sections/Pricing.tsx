"use client";

import Link from "next/link";

const BG   = "#F3F0E7";
const INK  = "#111111";
const PINK = "#FF4B8B";
const MONO = "var(--font-mono-var), monospace";

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5">
      <circle cx="12" cy="12" r="10" stroke={INK} strokeWidth="1.5" />
      <path d="M8 12l3 3 5-5" stroke={INK} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DotIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5">
      <circle cx="12" cy="12" r="10" stroke="#9CA3AF" strokeWidth="1.5" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function CrownIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 20h20M5 20L3 8l4.5 4.5L12 4l4.5 8.5L21 8l-2 12" />
    </svg>
  );
}

const BETA_FEATURES = [
  "Căutare rapidă prin conexiuni directe",
  "Marketplace-uri active și validate",
  "Rezultate normalizate și comparabile",
  "Filtre și sortare rapidă",
  "Scor agent și recomandări prioritare",
  "Insight-uri și trenduri de bază",
];

const PREMIUM_FEATURES = [
  "Deep Search asistat de browser",
  "Acoperire extinsă pe marketplace-uri compatibile",
  "Contact public al vânzătorului, unde este disponibil",
  "Monitorizare și alerte automate",
  "Contact și follow-up cu vânzătorii prin WhatsApp",
  "Conversații cu agentul LiberGent pe WhatsApp",
];

export function Pricing() {
  return (
    <section
      id="pricing"
      className="px-6 py-16 lg:py-24 scroll-mt-24"
      style={{ background: BG, fontFamily: MONO }}
    >
      <div className="max-w-[1280px] mx-auto">

        {/* Header */}
        <div className="text-center mb-16 flex flex-col items-center">
          <div className="text-[11px] tracking-widest uppercase mb-6" style={{ color: PINK }}>
            07 / PREȚURI
          </div>

          <div className="flex items-end justify-center gap-2 mb-6">
            <h2
              className="font-bold tracking-tight leading-[0.95]"
              style={{ fontFamily: MONO, fontSize: "clamp(36px, 5vw, 68px)", color: INK }}
            >
              Lansare beta. Fără cost.
            </h2>
            <div className="animate-pulse shrink-0 mb-2" style={{ width: 12, height: 12, background: PINK }} />
          </div>

          <p className="text-[14px] leading-relaxed" style={{ color: `${INK}99`, maxWidth: 480 }}>
            Beta actuală este gratuită pentru căutări de produse pe mai multe platforme din România.
            Funcțiile avansate sunt pe roadmap și vor fi lansate doar după ce infrastructura este activă.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 max-w-4xl mx-auto">

          {/* BETA */}
          <div
            className="relative flex flex-col hover:-translate-y-1 hover:-translate-x-1 transition-all duration-300"
            style={{
              border: `2px solid ${INK}`,
              background: BG,
              boxShadow: `6px 6px 0 0 ${INK}`,
              padding: "32px",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.boxShadow = `8px 8px 0 0 ${INK}`)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.boxShadow = `6px 6px 0 0 ${INK}`)}
          >
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 flex items-center justify-center" style={{ border: `2px solid ${INK}` }}>
                <StarIcon />
              </div>
              <div
                className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white"
                style={{ background: PINK, border: `2px solid ${INK}` }}
              >
                Start Aici
              </div>
            </div>

            <h3 className="font-bold text-3xl tracking-tight mb-2" style={{ color: INK }}>Beta</h3>

            <div className="flex items-baseline gap-2 mb-4">
              <span className="font-bold" style={{ fontSize: 44, color: INK }}>0</span>
              <span className="text-lg uppercase" style={{ color: INK }}>RON</span>
            </div>

            <p className="text-[13px] leading-relaxed mb-6" style={{ color: `${INK}B3`, minHeight: 44 }}>
              Acces gratuit la căutare de produse pe platformele active și la compararea rapidă a ofertelor.
            </p>

            <div style={{ borderTop: `1px dashed ${INK}`, marginBottom: "1.5rem" }} />

            <ul className="flex flex-col gap-4 text-[13px] flex-grow mb-8">
              {BETA_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3" style={{ color: INK }}>
                  <CheckIcon />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/#cautare"
              className="flex justify-center items-center gap-3 py-4 font-bold text-[11px] uppercase tracking-widest transition-all duration-150 hover:-translate-y-0.5 hover:-translate-x-0.5"
              style={{
                border: `2px solid ${INK}`,
                background: BG,
                color: PINK,
                boxShadow: `4px 4px 0 0 ${INK}`,
                fontFamily: MONO,
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.background = PINK;
                el.style.color = "white";
                el.style.boxShadow = `6px 6px 0 0 ${INK}`;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.background = BG;
                el.style.color = PINK;
                el.style.boxShadow = `4px 4px 0 0 ${INK}`;
              }}
            >
              Caută acum →
            </Link>
          </div>

          {/* PREMIUM */}
          <div
            className="relative flex flex-col"
            style={{
              border: "2px solid #9CA3AF",
              background: BG,
              boxShadow: "6px 6px 0 0 #9CA3AF",
              padding: "32px",
              opacity: 0.8,
            }}
          >
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 flex items-center justify-center" style={{ border: "2px solid #9CA3AF" }}>
                <CrownIcon />
              </div>
              <div
                className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
                style={{ background: "#D1D5DB", border: "2px solid #9CA3AF", color: "#6B7280" }}
              >
                Blocat
              </div>
            </div>

            <h3 className="font-bold text-3xl tracking-tight mb-2" style={{ color: "#6B7280" }}>LiberGent Premium</h3>

            <div className="mb-4">
              <div
                className="mb-2 inline-flex px-2 py-1 text-[10px] font-bold uppercase tracking-widest"
                style={{ background: "#FCE7F3", border: "1px solid #9CA3AF", color: PINK }}
              >
                În pregătire
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-bold uppercase" style={{ fontSize: 32, color: "#6B7280" }}>În curând</span>
              </div>
            </div>

            <p className="text-[13px] leading-relaxed mb-4" style={{ color: "#9CA3AF", minHeight: 44 }}>
              Căutare mai profundă cu browser automatizat, acoperire extinsă și instrumente de contact și monitorizare.
            </p>

            <div
              className="flex items-start gap-3 p-3 mb-2"
              style={{ background: "#F3F4F6", border: "1px solid #D1D5DB" }}
            >
              <div
                className="flex items-center justify-center shrink-0 mt-0.5 text-white"
                style={{ width: 22, height: 22, background: "#9CA3AF" }}
              >
                <LockIcon />
              </div>
              <p className="text-[11px] leading-snug" style={{ color: "#6B7280" }}>
                Premium nu este disponibil încă.<br />Nu există plată sau abonament activ.
              </p>
            </div>

            <div style={{ borderTop: "1px dashed #D1D5DB", margin: "1.5rem 0" }} />

            <ul className="flex flex-col gap-4 text-[13px] flex-grow mb-8">
              {PREMIUM_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3" style={{ color: "#9CA3AF" }}>
                  <DotIcon />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div
              className="flex justify-center items-center gap-3 py-4 font-bold text-[11px] uppercase tracking-widest cursor-not-allowed"
              style={{ border: "2px solid #9CA3AF", background: "#E5E7EB", color: "#9CA3AF", fontFamily: MONO }}
            >
              Indisponibil momentan
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
