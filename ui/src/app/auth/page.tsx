"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogoIcon } from "@/components/LogoIcon";

const CREAM = "#F3F0E7";
const INK   = "#000000";
const PINK  = "#FF2E63";
const BLUE  = "#2B5BFF";
const MONO  = "var(--font-mono-var), monospace";

/* ── Inline SVG icons (no icon library) ── */
function IconEye({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function IconEnvelope() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="4" width="20" height="16" rx="0" />
      <polyline points="2,4 12,13 22,4" />
    </svg>
  );
}

function IconScan() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <line x1="14" y1="14" x2="21" y2="14" />
      <line x1="14" y1="18" x2="21" y2="18" />
      <line x1="14" y1="22" x2="21" y2="22" />
    </svg>
  );
}

function MascotIcon({ size = 48 }: { size?: number }) {
  return <LogoIcon size={size} />;
}

/* ── Decorative background ── */
function BackgroundDecor() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      <svg className="absolute inset-0 w-full h-full opacity-40" viewBox="0 0 1440 900" fill="none" preserveAspectRatio="xMidYMid slice">
        <path d="M-100,200 C200,100 300,500 200,1000" stroke={INK} strokeWidth="1" strokeDasharray="2 8" />
        <path d="M1200,-100 C1000,300 1300,700 1500,800" stroke={INK} strokeWidth="1" strokeDasharray="2 8" />
        <path d="M400,900 C500,700 800,600 900,1000" stroke={INK} strokeWidth="1" strokeDasharray="2 8" />
      </svg>

      {/* Scattered pixel nodes */}
      <div className="absolute top-[20%] left-[15%] w-1.5 h-1.5" style={{ border: `1px solid ${PINK}`, opacity: 0.7 }} />
      <div className="absolute top-[40%] left-[8%] text-[11px] font-bold" style={{ color: INK, opacity: 0.35 }}>+</div>
      <div className="absolute top-[60%] left-[18%] w-1.5 h-1.5" style={{ border: `1px solid ${PINK}`, opacity: 0.5 }} />
      <div className="absolute bottom-[20%] left-[10%] text-[11px] font-bold" style={{ color: INK, opacity: 0.35 }}>+</div>

      <div className="absolute top-[25%] right-[15%] w-1.5 h-1.5" style={{ border: `1px solid ${PINK}`, opacity: 0.6 }} />
      <div className="absolute top-[18%] right-[25%] text-[11px] font-bold" style={{ color: INK, opacity: 0.35 }}>+</div>
      <div className="absolute top-[50%] right-[10%] text-[11px] font-bold" style={{ color: INK, opacity: 0.35 }}>+</div>
      <div className="absolute bottom-[30%] right-[18%] text-[11px] font-bold" style={{ color: INK, opacity: 0.35 }}>+</div>
      <div className="absolute bottom-[25%] right-[8%] w-1.5 h-1.5" style={{ border: `1px solid ${PINK}`, opacity: 0.5 }} />
    </div>
  );
}

/* ── Bottom marquee ── */
const TICKER_SEGMENTS = [
  { label: "SISTEM", value: "ACTIV", valueColor: BLUE },
  { label: "AGENT ACTIV", value: null, valueColor: null },
  { label: "CĂUTĂRI SALVATE", value: "12", valueColor: "#FFC800" },
  { label: "ALERTE LIVE", value: "3", valueColor: PINK },
  { label: "STATUS", value: "ONLINE", valueColor: BLUE },
];

function TickerSegmentRow() {
  return (
    <div className="flex items-center h-full shrink-0">
      {TICKER_SEGMENTS.map((seg, i) => (
        <div key={i} className="flex items-center h-full">
          <div className="flex items-center gap-2 px-6 text-[10px] font-bold tracking-widest uppercase" style={{ fontFamily: MONO }}>
            {i === 0 && <div className="w-2 h-2" style={{ background: INK }} />}
            <span style={{ color: INK }}>{seg.label}</span>
            {seg.value && <span style={{ color: seg.valueColor ?? INK }}>{seg.value}</span>}
          </div>
          <div className="h-5 w-px" style={{ background: INK, opacity: 0.25 }} />
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
    <footer className="relative z-10 w-full h-12 overflow-hidden flex items-center shrink-0" style={{ borderTop: `1.5px solid ${INK}`, background: CREAM }}>
      <div ref={trackRef} className="flex whitespace-nowrap will-change-transform h-full items-center">
        <TickerSegmentRow />
        <TickerSegmentRow />
      </div>
    </footer>
  );
}

/* ── Main Login Page ── */
export default function LoginPage() {
  const router = useRouter();
  const [showPass, setShowPass]   = useState(false);
  const [remember, setRemember]   = useState(true);
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push("/search");
  }

  return (
    <div
      className="h-screen flex flex-col overflow-hidden relative"
      style={{ background: CREAM, fontFamily: MONO, color: INK }}
    >
      <BackgroundDecor />

      {/* ── Header ── */}
      <header
        className="relative z-10 w-full flex items-center justify-between px-6 shrink-0"
        style={{ borderBottom: `1.5px solid ${INK}`, background: CREAM, height: 60 }}
      >
        <Link href="/" className="flex items-center gap-3">
          <MascotIcon size={28} />
          <span className="text-[14px] font-bold tracking-widest mt-0.5" style={{ color: INK }}>
            LIBERGENT<span style={{ color: PINK }}>.</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {["DESPRE LIBERGENT", "CUM FUNCȚIONEAZĂ", "AJUTOR"].map((label, i, arr) => (
            <div key={label} className="flex items-center gap-6">
              <Link
                href="#"
                className="text-[11px] font-bold tracking-wider transition-colors mt-0.5"
                style={{ color: INK }}
                onMouseEnter={(e) => (e.currentTarget.style.color = PINK)}
                onMouseLeave={(e) => (e.currentTarget.style.color = INK)}
              >
                {label}
              </Link>
              {i < arr.length - 1 && <div className="w-1.5 h-1.5" style={{ background: PINK }} />}
            </div>
          ))}
        </nav>
      </header>

      {/* ── Main content ── */}
      <main className="relative z-10 flex-grow flex items-center justify-center px-4 overflow-y-auto py-10">
        <div
          className="w-full relative"
          style={{
            maxWidth: 500,
            background: CREAM,
            border: `2px solid ${INK}`,
            padding: "40px",
            boxShadow: `6px 6px 0px 0px ${INK}`,
          }}
        >
          {/* Three dots top-right */}
          <div className="absolute top-5 right-5 flex gap-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-1.5 h-1.5" style={{ background: INK }} />
            ))}
          </div>

          {/* Mascot header */}
          <div className="flex flex-col items-center mb-8 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full flex justify-between px-12 pointer-events-none opacity-40">
              <svg width="60" height="20" viewBox="0 0 60 20" fill="none">
                <path d="M0 10 Q30 0 60 10" stroke={INK} strokeWidth="1" strokeDasharray="2 4" />
              </svg>
              <svg width="60" height="20" viewBox="0 0 60 20" fill="none">
                <path d="M0 10 Q30 0 60 10" stroke={INK} strokeWidth="1" strokeDasharray="2 4" />
              </svg>
            </div>
            <div className="absolute left-8 top-1/2 -translate-y-1/2 w-1.5 h-1.5" style={{ border: `1px solid ${PINK}` }} />
            <div className="absolute right-8 top-1/2 -translate-y-1/2 w-1.5 h-1.5" style={{ border: `1px solid ${PINK}` }} />
            <div className="relative z-10">
              <MascotIcon size={48} />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-10">
            <h1 className="text-[26px] font-bold tracking-tight mb-3" style={{ color: INK }}>
              BINE AI REVENIT<span style={{ color: PINK }}>.</span>
            </h1>
            <p className="text-[13px]" style={{ color: "#333" }}>
              Intră în cont și continuă căutarea{" "}
              <span style={{ color: BLUE }}>inteligentă</span>.
            </p>
          </div>

          {/* Form */}
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            {/* Email */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold tracking-wider uppercase" style={{ color: INK }}>
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="email-ul tău"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent text-[13px] outline-none pr-12"
                  style={{
                    border: `1.5px solid ${INK}`,
                    padding: "12px",
                    fontFamily: MONO,
                    color: INK,
                  }}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50">
                  <IconScan />
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold tracking-wider uppercase" style={{ color: INK }}>
                Parolă
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent text-[13px] outline-none pr-20"
                  style={{
                    border: `1.5px solid ${INK}`,
                    padding: "12px",
                    fontFamily: MONO,
                    color: INK,
                    letterSpacing: showPass ? "normal" : "0.2em",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 transition-opacity hover:opacity-60"
                  style={{ color: INK }}
                >
                  <IconEye open={showPass} />
                  <span className="text-[10px] font-bold uppercase mt-0.5">VEZI</span>
                </button>
              </div>
            </div>

            {/* Options row */}
            <div className="flex items-center justify-between pt-1 pb-2">
              <label className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setRemember((v) => !v)}>
                <div
                  className="w-4 h-4 flex items-center justify-center shrink-0"
                  style={{ border: `1.5px solid ${INK}`, background: remember ? INK : "transparent" }}
                >
                  {remember && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <polyline points="1,4 3,6 7,2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span className="text-[11px] mt-0.5">Ține-mă minte</span>
              </label>
              <Link href="/reset" className="text-[11px] mt-0.5 hover:underline" style={{ color: PINK }}>
                Ai uitat parola?
              </Link>
            </div>

            {/* Primary submit button with offset shadow */}
            <button type="submit" className="relative block w-full group">
              <div
                className="absolute inset-0 bg-black"
                style={{
                  transform: "translate(4px, 4px)",
                  transition: "transform 0.15s ease",
                }}
              />
              <div
                className="relative w-full flex items-center justify-center gap-4 transition-transform duration-150 hover:-translate-y-0.5 hover:-translate-x-0.5"
                style={{
                  background: CREAM,
                  border: `2px solid ${INK}`,
                  padding: "12px",
                }}
              >
                <span className="text-[13px] font-bold tracking-wider uppercase mt-0.5">INTRĂ ÎN CONT</span>
                <span className="text-lg">→</span>
              </div>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 opacity-60">
              <div className="h-px flex-grow" style={{ backgroundImage: "linear-gradient(to right, #000 50%, transparent 50%)", backgroundSize: "6px 1px", backgroundRepeat: "repeat-x" }} />
              <span className="text-[10px] font-bold uppercase tracking-widest mt-0.5">SAU</span>
              <div className="h-px flex-grow" style={{ backgroundImage: "linear-gradient(to right, #000 50%, transparent 50%)", backgroundSize: "6px 1px", backgroundRepeat: "repeat-x" }} />
            </div>

            {/* Magic link button */}
            <button
              type="button"
              className="w-full flex items-center justify-center gap-3 text-[11px] font-bold tracking-wider uppercase transition-colors duration-150"
              style={{ border: `1.5px solid ${INK}`, padding: "12px", background: "transparent", color: INK, fontFamily: MONO }}
              onMouseEnter={(e) => { e.currentTarget.style.background = INK; e.currentTarget.style.color = CREAM; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = INK; }}
            >
              <IconEnvelope />
              <span className="mt-0.5">CONTINUĂ CU EMAIL MAGIC LINK</span>
            </button>
          </form>

          {/* Bottom link */}
          <div className="text-center mt-8 text-[11px] font-bold" style={{ color: INK }}>
            Nu ai cont?{" "}
            <Link href="/signup" className="ml-1 hover:underline" style={{ color: PINK }}>
              Creează unul
            </Link>
          </div>
        </div>
      </main>

      <BottomStrip />
    </div>
  );
}
