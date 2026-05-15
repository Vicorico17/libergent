"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogoIcon } from "@/components/LogoIcon";

const CREAM = "#F3F0E7";
const INK   = "#111111";
const PINK  = "#FF4B55";
const BLUE  = "#3B82F6";
const MONO  = "var(--font-mono-var), monospace";

/* ── Inline SVG icons ── */
function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function IconEnvelope() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="4" width="20" height="16" />
      <polyline points="2,4 12,13 22,4" />
    </svg>
  );
}

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

function MascotIcon({ size = 48 }: { size?: number }) {
  return <LogoIcon size={size} />;
}

/* ── Drifting background arcs ── */
function BackgroundDecor() {
  const arc1Ref = useRef<SVGSVGElement>(null);
  const arc2Ref = useRef<SVGSVGElement>(null);
  const rafRef  = useRef<number>(0);
  const tRef    = useRef(0);

  useEffect(() => {
    const step = () => {
      tRef.current += 0.004;
      const t = tRef.current;
      if (arc1Ref.current) {
        arc1Ref.current.style.transform = `translate(${Math.sin(t) * 10}px, ${Math.cos(t) * 14}px)`;
      }
      if (arc2Ref.current) {
        arc2Ref.current.style.transform = `translate(${Math.cos(t * 0.8) * -11}px, ${Math.sin(t * 0.8) * -9}px)`;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <svg ref={arc1Ref} className="absolute top-[-10%] left-[-10%] w-[50%] h-[120%] opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ strokeDasharray: "4 8" }}>
        <path d="M 0,0 Q 100,50 0,100" fill="none" stroke={INK} strokeWidth="0.2" />
      </svg>
      <svg ref={arc2Ref} className="absolute top-[-20%] right-[-5%] w-[40%] h-[140%] opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ strokeDasharray: "2 10" }}>
        <path d="M 100,0 Q 0,50 100,100" fill="none" stroke={INK} strokeWidth="0.2" />
      </svg>

      <div className="absolute top-[15%] left-[20%] w-1.5 h-1.5 opacity-60" style={{ border: `1px solid ${PINK}` }} />
      <div className="absolute top-[40%] right-[15%] w-1.5 h-1.5 opacity-60" style={{ border: `1px solid ${PINK}` }} />
      <div className="absolute bottom-[25%] right-[25%] w-1 h-1 opacity-70" style={{ background: PINK }} />

      <div className="absolute top-[30%] left-[10%] text-[8px] opacity-40" style={{ color: INK }}>+</div>
      <div className="absolute top-[10%] right-[30%] text-[8px] opacity-40" style={{ color: INK }}>+</div>
      <div className="absolute bottom-[40%] right-[10%] text-[8px] opacity-40" style={{ color: INK }}>+</div>
      <div className="absolute bottom-[20%] left-[15%] text-[8px] opacity-40" style={{ color: INK }}>+</div>
    </div>
  );
}

/* ── Bottom marquee ── */
const TICKER_SEGMENTS = [
  { label: "SISTEM", value: "ACTIV", valueColor: BLUE },
  { label: "AGENT", value: "ACTIV", valueColor: INK },
  { label: "CĂUTĂRI SALVATE", value: "12", valueColor: PINK },
  { label: "ALERTE LIVE", value: "3", valueColor: PINK },
  { label: "STATUS", value: "ONLINE", valueColor: BLUE },
];

function BottomStrip() {
  const trackRef = useRef<HTMLDivElement>(null);
  const posRef   = useRef(0);
  const rafRef   = useRef<number>(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const half = track.scrollWidth / 2;
    const step = () => {
      posRef.current -= 0.55;
      if (posRef.current <= -half) posRef.current = 0;
      track.style.transform = `translateX(${posRef.current}px)`;
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const SegmentRow = () => (
    <div className="flex items-center h-full shrink-0">
      {TICKER_SEGMENTS.map((seg, i) => (
        <div key={i} className="flex items-center h-full">
          <div className="flex items-center gap-2 px-6 text-[10px] font-bold tracking-widest uppercase" style={{ fontFamily: MONO }}>
            <span style={{ color: INK }}>{seg.label}</span>
            <span style={{ color: seg.valueColor }}>{seg.value}</span>
          </div>
          <div className="h-5 w-px" style={{ background: INK, opacity: 0.2 }} />
        </div>
      ))}
    </div>
  );

  return (
    <footer
      className="fixed bottom-0 w-full h-10 overflow-hidden flex items-center z-30"
      style={{ borderTop: `1.5px solid ${INK}`, background: CREAM }}
    >
      <div ref={trackRef} className="flex whitespace-nowrap will-change-transform h-full items-center">
        <SegmentRow />
        <SegmentRow />
      </div>
    </footer>
  );
}

/* ── Checkbox component ── */
function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer" onClick={onChange}>
      <div
        className="w-4 h-4 shrink-0 mt-[2px] flex items-center justify-center transition-colors"
        style={{ border: `1.5px solid ${INK}`, background: "white" }}
      >
        {checked && <div className="w-2 h-2" style={{ background: INK }} />}
      </div>
      <span className="text-[11px] leading-relaxed select-none">{children}</span>
    </label>
  );
}

/* ── Main Signup Page ── */
export default function SignupPage() {
  const router = useRouter();

  const [name, setName]             = useState("");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [showPass, setShowPass]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeAlerts, setAgreeAlerts] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/confirm?email=${encodeURIComponent(email)}`);
  }

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-x-hidden"
      style={{ background: CREAM, fontFamily: MONO, color: INK }}
    >
      <BackgroundDecor />

      {/* ── Header ── */}
      <nav
        className="relative z-20 flex justify-between items-center px-6 shrink-0"
        style={{ borderBottom: `1.5px solid ${INK}`, background: CREAM, height: 60 }}
      >
        <Link href="/" className="flex items-center gap-3">
          <MascotIcon size={28} />
          <span className="text-[14px] font-bold tracking-widest mt-0.5 flex items-baseline gap-1" style={{ color: INK }}>
            LIBERGENT<span className="w-1.5 h-1.5 inline-block mb-0.5" style={{ background: PINK }} />
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
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
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6 pb-24 pt-10">
        <div
          className="w-full relative"
          style={{
            maxWidth: 440,
            background: CREAM,
            border: `2px solid ${INK}`,
            padding: "40px",
            boxShadow: `6px 6px 0px 0px ${INK}`,
          }}
        >
          {/* Three dots */}
          <div className="absolute top-4 right-4 flex gap-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-1.5 h-1.5" style={{ background: INK }} />
            ))}
          </div>

          {/* Card header */}
          <div className="flex flex-col items-center mb-8 relative">
            <div className="absolute top-4 left-4 w-[60px] h-px opacity-30" style={{ borderTop: `1px dashed ${INK}`, transform: "rotate(15deg)", transformOrigin: "right" }} />
            <div className="absolute top-4 right-4 w-[60px] h-px opacity-30" style={{ borderTop: `1px dashed ${INK}`, transform: "rotate(-15deg)", transformOrigin: "left" }} />
            <div className="absolute top-2 left-0 w-1.5 h-1.5" style={{ border: `1px solid ${PINK}` }} />
            <div className="absolute top-2 right-0 w-1.5 h-1.5" style={{ border: `1px solid ${PINK}` }} />

            <div className="mb-6 opacity-80">
              <MascotIcon size={44} />
            </div>

            <h1 className="text-2xl font-bold tracking-tight mb-3 flex items-end justify-center gap-1.5">
              CREEAZĂ CONT<span className="w-1.5 h-1.5 inline-block mb-1.5" style={{ background: PINK }} />
            </h1>
            <p className="text-xs text-center leading-relaxed">
              Intră în ecosistemul LiberGent și pornește<br />
              căutarea <span style={{ color: BLUE }}>inteligentă</span>.
            </p>
          </div>

          {/* Form */}
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>

            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest">Nume</label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="Numele tău"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs outline-none pr-10 transition-colors"
                  style={{ background: "white", border: `1.5px solid ${INK}`, padding: "12px 40px 12px 16px", fontFamily: MONO, color: INK }}
                  onFocus={(e) => (e.currentTarget.style.background = CREAM)}
                  onBlur={(e) => (e.currentTarget.style.background = "white")}
                />
                <div className="absolute right-3 opacity-50" style={{ color: INK }}><IconUser /></div>
              </div>
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest">Email</label>
              <div className="relative flex items-center">
                <input
                  type="email"
                  placeholder="email@exemplu.ro"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs outline-none pr-10 transition-colors"
                  style={{ background: "white", border: `1.5px solid ${INK}`, padding: "12px 40px 12px 16px", fontFamily: MONO, color: INK }}
                  onFocus={(e) => (e.currentTarget.style.background = CREAM)}
                  onBlur={(e) => (e.currentTarget.style.background = "white")}
                />
                <div className="absolute right-3 opacity-50" style={{ color: INK }}><IconEnvelope /></div>
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest">Parolă</label>
              <div className="relative flex items-center">
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs outline-none pr-10 transition-colors"
                  style={{ background: "#E5E5E5", border: `1.5px solid ${INK}`, padding: "12px 40px 12px 16px", fontFamily: MONO, color: INK, letterSpacing: showPass ? "normal" : "0.2em" }}
                  onFocus={(e) => (e.currentTarget.style.background = CREAM)}
                  onBlur={(e) => (e.currentTarget.style.background = "#E5E5E5")}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 transition-opacity hover:opacity-100 opacity-50"
                  style={{ color: INK }}
                >
                  <IconEye open={showPass} />
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest">Confirmă Parola</label>
              <div className="relative flex items-center">
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full text-xs outline-none pr-10 transition-colors"
                  style={{ background: "#E5E5E5", border: `1.5px solid ${INK}`, padding: "12px 40px 12px 16px", fontFamily: MONO, color: INK, letterSpacing: showConfirm ? "normal" : "0.2em" }}
                  onFocus={(e) => (e.currentTarget.style.background = CREAM)}
                  onBlur={(e) => (e.currentTarget.style.background = "#E5E5E5")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 transition-opacity hover:opacity-100 opacity-50"
                  style={{ color: INK }}
                >
                  <IconEye open={showConfirm} />
                </button>
              </div>
            </div>

            {/* Checkboxes */}
            <div className="flex flex-col gap-3 pt-1">
              <Checkbox checked={agreeTerms} onChange={() => setAgreeTerms((v) => !v)}>
                Sunt de acord cu{" "}
                <span style={{ color: PINK }}>termenii</span> și{" "}
                <span style={{ color: PINK }}>politica</span> de confidențialitate
              </Checkbox>
              <Checkbox checked={agreeAlerts} onChange={() => setAgreeAlerts((v) => !v)}>
                Primește alerte și update-uri
              </Checkbox>
            </div>

            {/* Primary button with shadow */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 text-xs font-bold tracking-widest transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
                style={{
                  background: "white",
                  border: `2px solid ${INK}`,
                  padding: "14px 16px",
                  fontFamily: MONO,
                  color: INK,
                  boxShadow: `4px 4px 0px 0px ${INK}`,
                }}
              >
                CREEAZĂ CONT
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-hover:translate-x-1">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12,5 19,12 12,19" />
                </svg>
              </button>
            </div>

            {/* Divider */}
            <div className="relative flex items-center justify-center py-2">
              <div className="absolute inset-x-0 top-1/2 h-px opacity-30" style={{ borderTop: `1px dashed ${INK}` }} />
              <span className="relative px-3 text-[10px] font-bold" style={{ background: CREAM }}>SAU</span>
            </div>

            {/* Magic link button */}
            <button
              type="button"
              className="w-full flex items-center justify-center gap-3 text-[11px] font-bold tracking-wide transition-colors duration-150"
              style={{ background: "#E5E5E5", border: `1.5px solid ${INK}`, padding: "14px 16px", fontFamily: MONO, color: INK }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#D4D4D4"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#E5E5E5"; }}
            >
              <IconEnvelope />
              <span>CONTINUĂ CU EMAIL MAGIC LINK</span>
            </button>
          </form>

          {/* Bottom link */}
          <div className="mt-8 text-center text-[11px]" style={{ color: INK }}>
            Ai deja cont?{" "}
            <Link href="/auth" className="hover:underline underline-offset-4" style={{ color: PINK }}>
              Intră în cont
            </Link>
          </div>
        </div>
      </main>

      <BottomStrip />
    </div>
  );
}
