"use client";

import Link from "next/link";
import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogoIcon } from "@/components/LogoIcon";

const CREAM = "#F3F0E7";
const INK   = "#000000";
const PINK  = "#ff2a4d";
const BLUE  = "#2563eb";
const MONO  = "var(--font-mono-var), monospace";

function MascotIcon({ size = 40 }: { size?: number }) {
  return <LogoIcon size={size} />;
}

function NavMascot() {
  return <LogoIcon size={20} />;
}

/* ── Background decor ── */
function BackgroundDecor() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden opacity-50">
      <svg width="100%" height="100%" className="absolute top-0 left-0">
        <path d="M -100 150 C 200 200, 300 500, 100 800" fill="none" stroke={INK} strokeWidth="1" strokeDasharray="2 8" opacity="0.4" />
        <path d="M 1540 -50 C 1200 200, 1350 600, 1600 900" fill="none" stroke={INK} strokeWidth="1" strokeDasharray="2 8" opacity="0.4" />

        <rect x="15%" y="15%" width="6" height="6" fill="none" stroke={PINK} strokeWidth="1.5" />
        <g transform="translate(180,400)" opacity="0.6">
          <circle cx="0" cy="0" r="15" fill="none" stroke={INK} strokeWidth="0.5" strokeDasharray="2 2" />
          <path d="M -20 0 L 20 0 M 0 -20 L 0 20" stroke={INK} strokeWidth="0.5" />
        </g>
        <rect x="25%" y="55%" width="6" height="6" fill="none" stroke={PINK} strokeWidth="1.5" />
        <rect x="18%" y="75%" width="6" height="6" fill="none" stroke={PINK} strokeWidth="1.5" />

        <rect x="88%" y="20%" width="6" height="6" fill="none" stroke={PINK} strokeWidth="1.5" />
        <rect x="88%" y="42%" width="6" height="6" fill="none" stroke={PINK} strokeWidth="1.5" />
        <rect x="92%" y="75%" width="6" height="6" fill="none" stroke={PINK} strokeWidth="1.5" />
        <g transform="translate(1240,700)" opacity="0.6">
          <circle cx="0" cy="0" r="15" fill="none" stroke={INK} strokeWidth="0.5" strokeDasharray="2 2" />
          <path d="M -20 0 L 20 0 M 0 -20 L 0 20" stroke={INK} strokeWidth="0.5" />
        </g>
      </svg>
    </div>
  );
}

/* ── Bottom marquee ── */
const TICKER_ITEMS = [
  { label: "VERIFY MODE", dot: PINK },
  { label: "EMAIL SENT", dot: PINK },
  { label: "STATUS", value: "ONLINE", valueColor: BLUE, dot: BLUE },
  { label: "SISTEM", value: "ACTIV", valueColor: BLUE, dot: BLUE },
  { label: "LINK VALID", dot: PINK },
  { label: "AGENT", value: "ACTIV", valueColor: BLUE, dot: BLUE },
  { label: "CONFIRMARE ÎN AȘTEPTARE", dot: PINK },
];

function TickerSegmentRow() {
  return (
    <div className="flex items-center h-full shrink-0">
      {TICKER_ITEMS.map((item, i) => (
        <div key={i} className="flex items-center h-full">
          <div className="flex items-center gap-2 px-6 text-[10px] font-bold tracking-widest uppercase" style={{ fontFamily: MONO }}>
            <span>{item.label}</span>
            {item.value && <span style={{ color: item.valueColor }}>{item.value}</span>}
            <div className="w-1.5 h-1.5 shrink-0" style={{ background: item.dot }} />
          </div>
          <div className="h-5 w-px" style={{ background: INK, opacity: 0.2 }} />
        </div>
      ))}
    </div>
  );
}

function BottomStrip() {
  const trackRef = useRef<HTMLDivElement>(null);
  const posRef   = useRef(0);
  const rafRef   = useRef<number>(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const half = track.scrollWidth / 2;
    const step = () => {
      posRef.current -= 0.5;
      if (posRef.current <= -half) posRef.current = 0;
      track.style.transform = `translateX(${posRef.current}px)`;
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div
      className="fixed bottom-0 left-0 w-full h-12 overflow-hidden z-20 flex items-center"
      style={{ borderTop: `1px solid ${INK}`, background: CREAM }}
    >
      <div ref={trackRef} className="flex whitespace-nowrap will-change-transform h-full items-center">
        <TickerSegmentRow />
        <TickerSegmentRow />
      </div>
    </div>
  );
}

/* ── Confirm content (reads searchParams) ── */
function ConfirmContent() {
  const router      = useRouter();
  const params      = useSearchParams();
  const email       = params.get("email") ?? "email@exemplu.ro";
  const [sent, setSent] = useState(false);

  function handleResend() {
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  }

  return (
    <>
      {/* ── Header ── */}
      <header
        className="relative z-10 w-full flex justify-between items-stretch shrink-0"
        style={{ borderBottom: `1px solid ${INK}`, background: CREAM, height: 56 }}
      >
        <div className="flex items-center px-4 md:px-6" style={{ borderRight: `1px solid ${INK}` }}>
          <NavMascot />
          <span className="font-bold text-base tracking-tight ml-4 uppercase" style={{ fontFamily: MONO }}>
            LiberGent<span style={{ color: PINK }}>.</span>
          </span>
        </div>
        <div className="hidden lg:flex items-center text-[11px] font-bold uppercase tracking-widest" style={{ fontFamily: MONO }}>
          {["Despre Libergent", "Cum Funcționează", "Ajutor"].map((label, i, arr) => (
            <div key={label} className="flex items-center">
              <Link
                href="#"
                className="px-8 transition-colors"
                style={{ color: INK }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#888")}
                onMouseLeave={(e) => (e.currentTarget.style.color = INK)}
              >
                {label}
              </Link>
              {i < arr.length - 1 && <div className="w-1.5 h-1.5" style={{ background: PINK }} />}
            </div>
          ))}
        </div>
      </header>

      {/* ── Main ── */}
      <main className="relative z-10 flex-grow flex items-center justify-center p-4 md:p-8 pb-32">
        {/* Gradient border wrapper */}
        <div
          className="w-full"
          style={{
            maxWidth: 540,
            background: "linear-gradient(135deg, #111, #000, #222)",
            padding: "1px",
            boxShadow: `10px 10px 0px 0px ${INK}`,
          }}
        >
          <div
            className="relative overflow-hidden p-6 md:p-10"
            style={{ background: CREAM, border: `1px solid ${INK}` }}
          >
            {/* Three dots */}
            <div className="absolute top-5 right-5 flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2.5 h-2.5" style={{ background: INK }} />
              ))}
            </div>

            {/* Mascot header */}
            <div className="flex justify-center mb-8 relative">
              <div className="absolute w-full top-1/2 -translate-y-1/2 flex justify-center pointer-events-none">
                <svg width="200" height="40" viewBox="0 0 200 40" fill="none" stroke={INK} strokeDasharray="2 4" strokeWidth="0.5" className="opacity-50">
                  <path d="M 0 30 Q 50 10 90 20" />
                  <path d="M 200 30 Q 150 10 110 20" />
                </svg>
              </div>
              <div className="relative z-10 px-1" style={{ background: CREAM }}>
                <MascotIcon size={40} />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-center uppercase mb-4" style={{ fontFamily: MONO }}>
              Confirmă Email-ul<span style={{ color: PINK }}>.</span>
            </h1>

            <p className="text-xs md:text-sm text-center leading-relaxed max-w-[320px] mx-auto mb-8 font-medium" style={{ fontFamily: MONO }}>
              Ți-am trimis un link de confirmare.<br />
              Verifică inbox-ul și{" "}
              <span style={{ color: BLUE }} className="font-bold">activează contul</span>.
            </p>

            {/* Email info box */}
            <div className="p-4 mb-3" style={{ border: `1px solid ${INK}`, background: CREAM }}>
              <p className="text-xs uppercase mb-1 tracking-wider" style={{ color: "rgba(0,0,0,0.7)", fontFamily: MONO }}>
                Email trimis către:
              </p>
              <p className="text-sm font-bold" style={{ fontFamily: MONO }}>{email}</p>
            </div>

            <p className="text-xs mb-6 font-medium" style={{ color: "rgba(0,0,0,0.6)", fontFamily: MONO }}>
              Dacă nu găsești email-ul, verifică și folderul spam.
            </p>

            {/* Status row */}
            <div className="p-3 mb-8 flex items-center" style={{ border: `1px dashed ${INK}`, background: CREAM }}>
              <div className="w-1.5 h-1.5 rounded-full mr-3" style={{ background: INK }} />
              <p className="text-xs uppercase font-bold tracking-wider" style={{ fontFamily: MONO }}>
                Status: Așteaptă confirmarea
              </p>
            </div>

            {/* Primary button */}
            <button
              onClick={() => router.push("/search")}
              className="w-full flex items-center justify-center gap-2 font-bold uppercase text-sm mb-4 transition-all duration-150 hover:-translate-y-0.5"
              style={{
                border: `1px solid ${INK}`,
                background: "white",
                padding: "16px",
                fontFamily: MONO,
                boxShadow: `4px 4px 0px 0px ${INK}`,
              }}
            >
              AM CONFIRMAT EMAIL-UL
              <span className="text-lg">→</span>
            </button>

            {/* Resend button */}
            <button
              onClick={handleResend}
              className="w-full font-bold uppercase text-xs tracking-wider mb-4 transition-colors duration-150"
              style={{
                border: `1px solid ${INK}`,
                background: sent ? "rgba(0,0,0,0.05)" : "transparent",
                padding: "14px",
                fontFamily: MONO,
                color: INK,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")}
              onMouseLeave={(e) => { if (!sent) e.currentTarget.style.background = "transparent"; }}
            >
              {sent ? "EMAIL RETRIMIS ✓" : "RETRIMITE EMAIL-UL"}
            </button>

            {/* Change email link */}
            <div className="text-center mb-8">
              <p className="text-xs font-medium" style={{ fontFamily: MONO }}>
                Email greșit?{" "}
                <Link href="/signup" className="hover:underline transition-all" style={{ color: PINK }}>
                  Schimbă adresa
                </Link>
              </p>
            </div>

            {/* Footer notes */}
            <div className="pt-5" style={{ borderTop: `1px dashed ${INK}` }}>
              <ul className="text-xs space-y-2 font-medium" style={{ color: "rgba(0,0,0,0.8)", fontFamily: MONO }}>
                {["Link-ul expiră în 15 minute.", "Poți cere un nou email dacă nu a ajuns."].map((note, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 mt-1.5 shrink-0" style={{ background: INK }} />
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

/* ── Page shell with Suspense (required for useSearchParams) ── */
export default function ConfirmPage() {
  return (
    <div
      className="min-h-screen flex flex-col relative overflow-x-hidden"
      style={{ background: CREAM, fontFamily: MONO, color: INK }}
    >
      <BackgroundDecor />
      <Suspense fallback={null}>
        <ConfirmContent />
      </Suspense>
      <BottomStrip />
    </div>
  );
}
