"use client";

import Link from "next/link";
import { LogoIcon } from "@/components/LogoIcon";

const BG   = "#F3F0E7";
const INK  = "#111111";
const PINK = "#FF4B8B";
const MONO = "var(--font-mono-var), monospace";

const NAV_LINKS = [
  { label: "Cum funcționează", href: "/#cum-functioneaza" },
  { label: "Căutare",          href: "/#cautare" },
  { label: "Întrebări",        href: "/#intrebari" },
  { label: "Trenduri",         href: "/trenduri" },
];

const BETA_FEATURES = [
  "Căutare rapidă prin conexiuni directe",
  "Marketplace-uri active și validate",
  "Rezultate normalizate și comparabile",
  "Filtre și sortare rapidă",
  "Scor agent și recomandări prioritare",
  "Insight-uri și trenduri de bază",
];

const PREMIUM_FEATURES = [
  "Mai multe magazine și marketplace-uri verificate",
  "Retail fashion: Sizeer, ePantofi, Fashion Days, Zalando, ABOUT YOU, Answear și MODIVO",
  "Comparație extinsă de preț",
  "Recomandare mai sigură pentru bugetul tău",
  "Monitorizare și alerte automate",
  "Contact și follow-up cu sellerii",
  "Istoric privat al conversațiilor",
];

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
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ArrowRight({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-2" />
      <path d="M16 12h5v4h-5a2 2 0 010-4z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4v6h6M23 20v-6h-6" />
      <path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15" />
    </svg>
  );
}

function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 20h20M5 20L3 8l4.5 4.5L12 4l4.5 8.5L21 8l-2 12" />
    </svg>
  );
}

export default function PricingPage() {
  return (
    <div
      className="min-h-screen flex flex-col p-0 sm:p-2 md:p-4"
      style={{ background: BG, fontFamily: MONO }}
    >
      {/* Outer frame */}
      <div
        className="border-2 flex flex-col flex-grow relative overflow-hidden"
        style={{ borderColor: INK, background: BG }}
      >

        {/* Background SVG animation */}
        <div className="absolute inset-0 pointer-events-none z-0 opacity-40">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <path d="M-50,200 Q200,150 400,-50" stroke={INK} strokeWidth="1.5" strokeDasharray="4 8" fill="none" style={{ animation: "drift 10s linear infinite" }} />
            <path d="M-100,600 Q300,500 200,900" stroke={INK} strokeWidth="1.5" strokeDasharray="4 8" fill="none" style={{ animation: "drift 15s linear infinite reverse" }} />
            <path d="M1200,100 Q800,400 1100,900" stroke={INK} strokeWidth="1.5" strokeDasharray="4 8" fill="none" style={{ animation: "drift 12s linear infinite" }} />

            <g transform="translate(150, 250)">
              <circle cx="0" cy="0" r="8" fill="none" stroke={INK} strokeWidth="1.5" />
              <line x1="-16" y1="0" x2="16" y2="0" stroke={INK} strokeWidth="1.5" />
              <line x1="0" y1="-16" x2="0" y2="16" stroke={INK} strokeWidth="1.5" />
            </g>

            <g transform="translate(850, 500)">
              <circle cx="0" cy="0" r="8" fill="none" stroke={INK} strokeWidth="1.5" />
              <line x1="-16" y1="0" x2="16" y2="0" stroke={INK} strokeWidth="1.5" />
              <line x1="0" y1="-16" x2="0" y2="16" stroke={INK} strokeWidth="1.5" />
            </g>

            <rect x="250" y="150" width="4" height="4" fill="none" stroke={INK} strokeWidth="1" />
            <rect x="180" y="550" width="8" height="8" fill={PINK} stroke={INK} strokeWidth="1.5" />
            <rect x="950" y="350" width="4" height="4" fill="none" stroke={INK} strokeWidth="1" />
            <rect x="880" y="700" width="8" height="8" fill={PINK} stroke={INK} strokeWidth="1.5" />
            <rect x="1000" y="530" width="6" height="6" fill="#3B82F6" stroke={INK} strokeWidth="1.5" />
            <rect x="100" y="780" width="6" height="6" fill="#3B82F6" stroke={INK} strokeWidth="1.5" />
          </svg>
        </div>

        {/* Nav */}
        <header
          className="flex flex-nowrap justify-between items-center px-4 py-4 md:px-8 md:py-5 z-20 relative"
          style={{ borderBottom: `2px solid ${INK}`, background: BG }}
        >
          <Link href="/" className="flex items-center gap-3">
            <LogoIcon size={22} />
            <span className="text-[15px] font-bold tracking-tight uppercase sm:text-lg" style={{ color: INK }}>
              LiberGent<span style={{ color: PINK }}>.</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-5 text-[11px] uppercase tracking-widest">
            {NAV_LINKS.map((l, i) => (
              <div key={l.label} className="flex items-center gap-5">
                {i > 0 && <div style={{ width: 6, height: 6, background: PINK }} />}
                <Link href={l.href} className="hover:opacity-60 transition-opacity" style={{ color: INK }}>
                  {l.label}
                </Link>
              </div>
            ))}
          </nav>

          <Link href="/search" className="flex min-h-10 items-center justify-center px-3 text-[9px] font-bold uppercase sm:px-4" style={{ border: `2px solid ${INK}`, color: INK }}>Înapoi la căutare</Link>
        </header>

        {/* Main */}
        <main className="flex-grow flex flex-col items-center px-3 pb-12 pt-9 sm:px-4 md:pb-24 md:pt-20 z-10 relative">

          {/* Section label */}
          <div className="mb-5 flex items-center gap-2 text-[10px] tracking-widest uppercase md:mb-10 md:text-[11px]" style={{ color: PINK }}>
            <div style={{ width: 5, height: 5, background: PINK }} />
            Prețuri
            <div style={{ width: 5, height: 5, background: PINK }} />
          </div>

          {/* Headline */}
          <div className="mb-8 max-w-2xl text-center md:mb-16">
            <h1
              className="mb-4 text-[32px] font-bold tracking-tight leading-[1.05] sm:text-[40px] md:mb-6 md:text-[64px] lg:text-[80px]"
              style={{ color: INK, fontFamily: MONO }}
            >
              Mai multe surse.<br />
              O alegere mai bună<span style={{ color: PINK }}>.</span>
            </h1>
            <p className="mx-auto max-w-xl text-[12px] leading-relaxed md:text-sm" style={{ color: `${INK}99` }}>
              Începe gratuit sau testează Deep Search pentru acoperire extinsă și mai multe șanse să găsești oferta potrivită.
            </p>
          </div>

          {/* Cards */}
          <div className="grid w-full max-w-5xl gap-5 md:grid-cols-2 md:gap-12">

            {/* BETA card */}
            <div
              className="order-2 relative flex flex-col transition-all duration-300 md:order-1 md:hover:-translate-x-1 md:hover:-translate-y-1"
              style={{
                border: `2px solid ${INK}`,
                background: BG,
                boxShadow: `6px 6px 0 0 ${INK}`,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = `8px 8px 0 0 ${INK}`)}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = `6px 6px 0 0 ${INK}`)}
            >
              <div className="flex h-full flex-col p-5 sm:p-7 md:p-8">
              <div className="flex justify-between items-start mb-6">
                <div
                  className="w-12 h-12 flex items-center justify-center"
                  style={{ border: `2px solid ${INK}` }}
                >
                  <StarIcon />
                </div>
                <div
                  className="px-3 py-1 text-[11px] font-bold uppercase tracking-widest"
                  style={{ background: PINK, border: `2px solid ${INK}`, color: "white" }}
                >
                  Start Aici
                </div>
              </div>

              <h2 className="font-bold text-3xl tracking-tight mb-2" style={{ color: INK, fontFamily: MONO }}>
                Beta
              </h2>

              <div className="flex items-baseline gap-2 mb-4">
                <span className="font-bold tracking-tight" style={{ fontSize: 44, color: INK, fontFamily: MONO }}>0</span>
                <span className="text-lg uppercase" style={{ color: INK }}>RON</span>
              </div>

              <p className="text-sm leading-relaxed mb-6" style={{ color: `${INK}B3`, minHeight: 48 }}>
                Acces gratuit la experiența curentă de căutare multi-platformă.
              </p>

              <div style={{ borderTop: `1px dashed ${INK}`, marginBottom: "1.5rem" }} />

              <ul className="mb-7 flex flex-col gap-3 text-[12px] md:mb-10 md:flex-grow md:gap-4 md:text-sm">
                {BETA_FEATURES.slice(0, 3).map((item) => (
                  <li key={item} className="flex items-start gap-3" style={{ color: INK }}>
                    <CheckIcon />
                    <span>{item}</span>
                  </li>
                ))}
                {BETA_FEATURES.slice(3).map((item) => (
                  <li key={item} className="hidden items-start gap-3 md:flex" style={{ color: INK }}><CheckIcon /><span>{item}</span></li>
                ))}
              </ul>

              <details className="mb-6 md:hidden"><summary className="cursor-pointer text-[10px] font-bold uppercase underline">Vezi toate funcțiile Free</summary><ul className="mt-4 flex flex-col gap-3 text-[11px]">{BETA_FEATURES.slice(3).map((item) => <li key={item} className="flex items-start gap-2"><CheckIcon /><span>{item}</span></li>)}</ul></details>

              <Link
                href="/#cautare"
                className="group flex justify-center items-center gap-3 py-4 font-bold text-[12px] uppercase tracking-widest transition-all duration-150 hover:-translate-y-0.5 hover:-translate-x-0.5"
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
                Caută acum
                <ArrowRight size={18} />
              </Link>
              </div>
            </div>

            {/* PREMIUM card (locked) */}
            <div
              className="order-1 relative flex flex-col md:order-2"
              style={{
                border: `2px solid ${INK}`,
                background: BG,
                boxShadow: `6px 6px 0 0 ${PINK}`,
              }}
            >
              <div className="flex h-full flex-col p-5 sm:p-7 md:p-8">
              <div className="flex justify-between items-start mb-6">
                <div
                  className="w-12 h-12 flex items-center justify-center"
                  style={{ border: `2px solid ${INK}`, color: PINK }}
                >
                  <CrownIcon />
                </div>
                <div
                  className="px-3 py-1 text-[11px] font-bold uppercase tracking-widest"
                  style={{ background: PINK, border: `2px solid ${INK}`, color: "white" }}
                >
                  În curând
                </div>
              </div>

              <h2 className="mb-2 text-[27px] font-bold tracking-tight md:text-3xl" style={{ color: INK, fontFamily: MONO }}>
                LiberGent Premium
              </h2>

              <div className="mb-4">
                <div
                  className="mb-2 inline-flex px-2 py-1 text-[10px] font-bold uppercase tracking-widest"
                  style={{ background: "#FCE7F3", border: `1px solid ${PINK}`, color: PINK }}
                >
                  Preț de lansare
                </div>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-[40px] font-bold tracking-tight md:text-[44px]" style={{ color: INK, fontFamily: MONO }}>39</span>
                  <span className="text-base uppercase md:text-lg" style={{ color: INK }}>RON / lună</span>
                  <span className="text-xs uppercase line-through md:text-sm" style={{ color: `${INK}66` }}>99 RON / lună</span>
                </div>
              </div>

              <p className="mb-4 text-[12px] leading-relaxed md:text-sm" style={{ color: `${INK}B3`, minHeight: 48 }}>
                Include retaileri de fashion, sneakers și încălțăminte pentru un benchmark nou mai precis.
              </p>

              {/* Locked notice */}
              <div
                className="flex items-start gap-3 p-3 mb-2"
                style={{ background: "#FCE7F3", border: `1px solid ${PINK}` }}
              >
                <div
                  className="flex items-center justify-center shrink-0 mt-0.5 text-white"
                  style={{ width: 22, height: 22, background: PINK }}
                >
                  <LockIcon size={12} />
                </div>
                <p className="text-xs leading-snug" style={{ color: INK }}>
                  Testează căutarea Premium acum. Abonamentul se lansează în curând.
                </p>
              </div>

              <Link href="/search?tier=premium" className="mt-3 flex min-h-12 items-center justify-center gap-3 px-4 py-3 text-[11px] font-bold uppercase tracking-widest" style={{ border: `2px solid ${INK}`, background: PINK, color: INK, boxShadow: `4px 4px 0 ${INK}`, fontFamily: MONO }}>Încearcă Premium <ArrowRight size={16} /></Link>
              <p className="mt-3 text-center text-[9px] uppercase" style={{ color: `${INK}77` }}>Fără card în perioada de test</p>

              <div style={{ borderTop: `1px dashed ${INK}`, margin: "1.25rem 0" }} />

              <ul className="mb-7 flex flex-col gap-3 text-[12px] md:mb-10 md:flex-grow md:gap-4 md:text-sm">
                {PREMIUM_FEATURES.slice(0, 3).map((item) => (
                  <li key={item} className="flex items-start gap-3" style={{ color: INK }}>
                    <DotIcon />
                    <span>{item}</span>
                  </li>
                ))}
                {PREMIUM_FEATURES.slice(3).map((item) => (
                  <li key={item} className="hidden items-start gap-3 md:flex" style={{ color: INK }}><DotIcon /><span>{item}</span></li>
                ))}
              </ul>

              <details className="mb-6 md:hidden"><summary className="cursor-pointer text-[10px] font-bold uppercase underline">Vezi toate beneficiile</summary><ul className="mt-4 flex flex-col gap-3 text-[11px]">{PREMIUM_FEATURES.slice(3).map((item) => <li key={item} className="flex items-start gap-2"><DotIcon /><span>{item}</span></li>)}</ul></details>

              </div>
            </div>

          </div>
        </main>

        {/* Bottom strip */}
        <footer
          className="relative z-20 grid grid-cols-2 gap-px md:grid-cols-5"
          style={{ borderTop: `2px solid ${INK}`, background: INK }}
        >
          {[
            {
              icon: <div className="w-5 h-5 rounded-full shrink-0" style={{ background: PINK, border: `2px solid ${INK}` }} />,
              title: "Beta activă",
              sub: "Public & activ",
            },
            {
              icon: (
                <div className="w-6 h-6 flex items-center justify-center shrink-0 text-white" style={{ background: "#9CA3AF" }}>
                  <LockIcon size={12} />
                </div>
              ),
              title: "Premium în curând",
              sub: "Test disponibil",
            },
            {
              icon: <WalletIcon />,
              title: "Fără taxă de activare",
              sub: "Zero cost inițial",
            },
            {
              icon: <RefreshIcon />,
              title: "Anulare oricând",
              sub: "Fără obligații",
            },
            {
              icon: <div className="w-5 h-5 rounded-full shrink-0" style={{ background: "#22C55E", border: `2px solid ${INK}` }} />,
              title: "Status Online",
              sub: "Sistem operațional",
            },
          ].map((item, i) => (
            <div
              key={item.title}
              className={`flex items-center gap-3 bg-[#F3F0E7] px-3 py-4 md:px-6 md:py-5 ${i === 4 ? "col-span-2 md:col-span-1" : ""}`}
            >
              {item.icon}
              <div className="flex flex-col">
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: INK }}>{item.title}</span>
                <span className="text-[11px] mt-0.5" style={{ color: `${INK}80` }}>{item.sub}</span>
              </div>
            </div>
          ))}
        </footer>

      </div>

      <style>{`
        @keyframes drift {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: 100; }
        }
      `}</style>
    </div>
  );
}
