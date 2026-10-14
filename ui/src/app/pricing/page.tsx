"use client";

import Link from "next/link";
import styles from "./pricing.module.css";
import { LogoIcon } from "@/components/LogoIcon";
import { AccountNavLink } from "@/components/AccountNavLink";
import { PremiumNavLink } from "@/components/PremiumNavLink";
import { PricingCards } from "@/components/PricingCards";
import { BillingReturnNotice } from "@/components/BillingAction";

const BG   = "#F3F0E7";
const INK  = "#111111";
const PINK = "#FF4B8B";
const MONO = "var(--font-mono-var), monospace";

const NAV_LINKS = [
  { label: "Căutare",          href: "/#cautare" },
  { label: "Discovery",        href: "/discovery" },
  { label: "Premium",          href: "/pricing" },
];

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

export default function PricingPage() {
  return (
    <div
      className={`${styles.page} min-h-screen flex flex-col p-0 sm:p-2 md:p-4`}
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
          className="flex flex-wrap justify-between items-center gap-y-4 px-4 py-4 md:px-8 md:py-5 z-20 relative"
          style={{ borderBottom: `2px solid ${INK}`, background: BG }}
        >
          <Link href="/" className="flex items-center gap-3">
            <LogoIcon size={22} />
            <span className="text-[15px] font-bold tracking-tight uppercase sm:text-lg" style={{ color: INK }}>
              LiberGent<span style={{ color: PINK }}>.</span>
            </span>
          </Link>

          <nav className="order-3 flex w-full items-center justify-center gap-3 sm:gap-5 text-[11px] uppercase tracking-widest lg:order-none lg:w-auto">
            {NAV_LINKS.map((l, i) => (
              <div key={l.label} className="flex items-center gap-5">
                {i > 0 && <div className="hidden sm:block" style={{ width: 6, height: 6, background: PINK }} />}
                {l.href === "/pricing" ? <PremiumNavLink /> : <Link href={l.href} className="hover:opacity-60 transition-opacity" style={{ color: INK }}>
                  {l.label}
                </Link>}
              </div>
            ))}
          </nav>

          <AccountNavLink next="/pricing" />
        </header>

        {/* Main */}
        <main className="flex-grow flex flex-col items-center px-3 pb-12 pt-9 sm:px-4 md:pb-24 md:pt-20 z-10 relative">
          <BillingReturnNotice />

          {/* Premium identity */}
          <div className={`${styles.intro} mb-8 flex flex-col items-center text-center md:mb-14`}>
            <div className="mb-6 flex h-24 w-24 items-center justify-center border-2 border-[#111111] bg-white shadow-[6px_6px_0_#FF4B8B] md:h-28 md:w-28">
              <LogoIcon size={78} className="md:!h-24 md:!w-24" />
            </div>
            <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] md:text-xs" style={{ color: PINK }}>
              <span className="h-1.5 w-1.5 bg-[#FF4B8B]" />
              Planurile LiberGent
              <span className="h-1.5 w-1.5 bg-[#FF4B8B]" />
            </div>
            <h1
              className="mb-5 max-w-4xl text-[34px] font-bold tracking-tight leading-[1.04] sm:text-[46px] md:mb-6 md:text-[64px] lg:text-[76px]"
              style={{ color: INK, fontFamily: MONO }}
            >
              Tu alegi cât delegi.<br />
              <span style={{ color: PINK }}>Noi găsim oferta.</span>
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed md:text-base" style={{ color: `${INK}B3` }}>
              Caută gratuit, explorează mai multe oferte cu Premium sau lasă agentul
              LiberGent să contacteze vânzătorii și să negocieze pentru tine.
            </p>
          </div>

          <PricingCards checkout fit />
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
