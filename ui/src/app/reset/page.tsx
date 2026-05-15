"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogoIcon } from "@/components/LogoIcon";

const CREAM = "#F3F0E7";
const INK   = "#0F0F0F";
const PINK  = "#FF2B5E";
const BLUE  = "#2B5EFE";
const MONO  = "var(--font-mono-var), monospace";

function MascotIcon({ size = 32 }: { size?: number }) {
  return <LogoIcon size={size} />;
}

/* ── Crosshair SVG ── */
function Crosshair({ size = 24, opacity = 0.5 }: { size?: number; opacity?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1" style={{ opacity }}>
      <circle cx="12" cy="12" r="5" strokeDasharray="2 3" />
      <path d="M12 2v6M12 16v6M2 12h6M16 12h6" />
    </svg>
  );
}

/* ── Animated background ── */
function BackgroundDecor() {
  const path1Ref  = useRef<SVGPathElement>(null);
  const path2Ref  = useRef<SVGPathElement>(null);
  const path3Ref  = useRef<SVGPathElement>(null);
  const dot1Ref   = useRef<HTMLDivElement>(null);
  const dot2Ref   = useRef<HTMLDivElement>(null);
  const rafRef    = useRef<number>(0);
  const tRef      = useRef(0);

  useEffect(() => {
    /* drift: slow sine offset on Y for all three paths */
    const step = () => {
      tRef.current += 0.002;
      const t = tRef.current;
      const y1 = Math.sin(t) * 15;
      const y2 = Math.sin(t + 7) * 15;
      const y3 = Math.sin(t + 14) * 12;
      if (path1Ref.current) path1Ref.current.style.transform = `translateY(${y1}px)`;
      if (path2Ref.current) path2Ref.current.style.transform = `translateY(${y2}px)`;
      if (path3Ref.current) path3Ref.current.style.transform = `translateY(${y3}px)`;

      /* traveling dots: loop along diagonal */
      const p1 = ((t * 12) % 1);
      const p2 = (((t * 9) + 0.5) % 1);
      if (dot1Ref.current) {
        dot1Ref.current.style.left = `${10 + p1 * 20}%`;
        dot1Ref.current.style.top  = `${110 - p1 * 120}%`;
        dot1Ref.current.style.opacity = p1 < 0.05 || p1 > 0.95 ? "0" : "0.6";
      }
      if (dot2Ref.current) {
        dot2Ref.current.style.left = `${90 - p2 * 20}%`;
        dot2Ref.current.style.top  = `${110 - p2 * 120}%`;
        dot2Ref.current.style.opacity = p2 < 0.05 || p2 > 0.95 ? "0" : "0.6";
      }

      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden" style={{ opacity: 0.4 }}>
      <svg className="absolute w-full h-full left-0 top-0" preserveAspectRatio="none">
        <path ref={path1Ref} d="M 10% 110% Q 15% 40% 30% -10%" fill="none" stroke={INK} strokeWidth="1" strokeDasharray="2 8" />
        <path ref={path2Ref} d="M 90% 110% Q 80% 60% 70% -10%" fill="none" stroke={INK} strokeWidth="1" strokeDasharray="2 8" />
        <path ref={path3Ref} d="M -10% 40% Q 50% 60% 110% 20%" fill="none" stroke={INK} strokeWidth="1" strokeDasharray="1 12" style={{ opacity: 0.5 }} />
      </svg>

      {/* Traveling dots */}
      <div ref={dot1Ref} className="absolute w-1.5 h-1.5 rounded-full" style={{ background: INK, transition: "opacity 0.3s" }} />
      <div ref={dot2Ref} className="absolute w-1 h-1 rounded-full" style={{ background: PINK, transition: "opacity 0.3s" }} />

      {/* Pulsing nodes */}
      <div className="absolute top-[20%] left-[25%] w-2.5 h-2.5" style={{ border: `1.5px solid ${PINK}`, animation: "soft-pulse 4s ease-in-out infinite" }} />
      <div className="absolute bottom-[35%] right-[20%] w-2.5 h-2.5" style={{ border: `1.5px solid ${PINK}`, animation: "soft-pulse 4s ease-in-out infinite 2s" }} />

      {/* Static marks */}
      <div className="absolute top-[45%] right-[15%] text-xs" style={{ color: "#888", opacity: 0.7 }}>+</div>
      <div className="absolute bottom-[20%] left-[20%] text-[10px] leading-tight" style={{ color: "#888", opacity: 0.7 }}>x<br />x</div>

      {/* Crosshairs */}
      <div className="absolute top-[35%] left-[18%]"><Crosshair /></div>
      <div className="absolute bottom-[15%] right-[15%]"><Crosshair /></div>
    </div>
  );
}

/* ── Bottom marquee ── */
const TICKER_ITEMS = [
  { label: "RESET MODE",       dot: PINK },
  { label: "MAGIC LINK READY", dot: PINK },
  { label: "STATUS",  value: "ONLINE", valueColor: BLUE, dot: BLUE, round: true },
  { label: "SISTEM",  value: "ACTIV",  valueColor: BLUE, dot: BLUE, round: true },
  { label: "EMAIL FLOW LIVE",  dot: PINK },
  { label: "SUPORT",  value: "ACTIV",  valueColor: BLUE, dot: BLUE, round: true },
];

function TickerSegmentRow() {
  return (
    <div className="flex items-center h-full shrink-0">
      {TICKER_ITEMS.map((item, i) => (
        <div key={i} className="flex items-center h-full">
          <div className="flex items-center gap-3 px-8 text-[10px] font-bold tracking-widest" style={{ fontFamily: MONO }}>
            <span>{item.label}</span>
            {item.value && <span style={{ color: item.valueColor }}>{item.value}</span>}
            <div
              className="w-1.5 h-1.5 shrink-0"
              style={{ background: item.dot, borderRadius: item.round ? "50%" : 0 }}
            />
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
    <footer
      className="w-full h-12 overflow-hidden flex items-center shrink-0 relative z-20"
      style={{ borderTop: `1.5px solid ${INK}`, background: CREAM }}
    >
      <div ref={trackRef} className="flex whitespace-nowrap will-change-transform h-full items-center">
        <TickerSegmentRow />
        <TickerSegmentRow />
      </div>
    </footer>
  );
}

/* ── Main Reset Page ── */
export default function ResetPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [focused, setFocused] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/confirm?email=${encodeURIComponent(email || "email@exemplu.ro")}`);
  }

  const inputStyle: React.CSSProperties = focused
    ? {
        outline: "none",
        border: "1.5px solid transparent",
        backgroundImage: `linear-gradient(${CREAM}, ${CREAM}), linear-gradient(135deg, ${INK} 0%, ${PINK} 50%, ${BLUE} 100%)`,
        backgroundOrigin: "border-box",
        backgroundClip: "padding-box, border-box",
        padding: "12px 48px 12px 16px",
        fontFamily: MONO,
        fontSize: 13,
        color: INK,
        width: "100%",
      }
    : {
        outline: "none",
        border: `1.5px solid ${INK}`,
        background: "transparent",
        padding: "12px 48px 12px 16px",
        fontFamily: MONO,
        fontSize: 13,
        color: INK,
        width: "100%",
        transition: "all 0.2s ease",
      };

  return (
    <div
      className="min-h-screen flex flex-col uppercase tracking-wide"
      style={{ background: CREAM, fontFamily: MONO, color: INK }}
    >
      {/* ── Nav ── */}
      <nav
        className="flex items-center justify-between px-6 shrink-0 relative z-20"
        style={{ borderBottom: `1.5px solid ${INK}`, background: CREAM, height: 64 }}
      >
        <Link href="/" className="flex items-center gap-3">
          <MascotIcon size={24} />
          <span className="font-bold text-[17px] tracking-tight mt-0.5">
            LIBERGENT<span style={{ color: PINK }}>.</span>
          </span>
        </Link>

        <div className="flex items-center">
          <div className="hidden lg:flex items-center gap-6 text-[11px] font-bold tracking-widest mr-8">
            {["DESPRE LIBERGENT", "CUM FUNCȚIONEAZĂ", "AJUTOR"].map((label, i, arr) => (
              <div key={label} className="flex items-center gap-6">
                <Link
                  href="#"
                  className="transition-colors duration-200"
                  style={{ color: INK }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#888")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = INK)}
                >
                  {label}
                </Link>
                {i < arr.length - 1 && <div className="w-1.5 h-1.5 shrink-0" style={{ background: PINK }} />}
              </div>
            ))}
          </div>
          <button
            className="w-8 h-8 flex items-center justify-center transition-colors duration-200"
            style={{ border: `1.5px solid ${INK}` }}
            onMouseEnter={(e) => { e.currentTarget.style.background = INK; e.currentTarget.style.color = CREAM; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = INK; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>
        </div>
      </nav>

      {/* ── Main ── */}
      <main className="flex-grow flex items-center justify-center relative overflow-hidden py-16 px-4 md:px-8">
        <BackgroundDecor />

        {/* Card */}
        <div
          className="relative z-10 flex flex-col items-center w-full p-10 md:p-12"
          style={{
            maxWidth: 460,
            background: CREAM,
            border: `2px solid ${INK}`,
            boxShadow: `8px 8px 0px 0px ${INK}`,
          }}
        >
          {/* Three dots */}
          <div className="absolute top-5 right-5 flex gap-1.5">
            {[0, 1, 2].map((i) => <div key={i} className="w-1.5 h-1.5" style={{ background: INK }} />)}
          </div>

          {/* Mascot */}
          <div className="mt-2 mb-8">
            <MascotIcon size={32} />
          </div>

          {/* Title */}
          <h1 className="text-[26px] md:text-[28px] font-bold tracking-tighter mb-4 text-center leading-none">
            RESETEAZĂ PAROLA<span style={{ color: PINK }}>.</span>
          </h1>

          <p className="text-[13px] mb-10 text-center normal-case font-medium" style={{ color: "#333" }}>
            Trimitem un{" "}
            <span style={{ color: BLUE }}>magic link</span>{" "}
            ca să revii în sistem.
          </p>

          {/* Form */}
          <form className="w-full text-left flex flex-col gap-6" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold tracking-widest" style={{ color: INK }}>
                EMAIL
              </label>
              <div className="relative flex items-center">
                <input
                  type="email"
                  placeholder="email@exemplu.ro"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  style={inputStyle}
                />
                <div className="absolute right-4 pointer-events-none" style={{ color: INK, opacity: 0.7 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="4" width="20" height="16" />
                    <polyline points="2,4 12,13 22,4" />
                  </svg>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex justify-center items-center gap-3 text-[13px] font-bold tracking-widest transition-all duration-150 hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
              style={{
                border: `1.5px solid ${INK}`,
                background: CREAM,
                padding: "14px",
                fontFamily: MONO,
                color: INK,
                boxShadow: `4px 4px 0px 0px ${INK}`,
              }}
              onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; (e.currentTarget as HTMLButtonElement).style.transform = "translate(4px,4px)"; }}
              onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = `4px 4px 0px 0px ${INK}`; (e.currentTarget as HTMLButtonElement).style.transform = ""; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = `4px 4px 0px 0px ${INK}`; (e.currentTarget as HTMLButtonElement).style.transform = ""; }}
            >
              TRIMITE LINK-UL
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12,5 19,12 12,19" />
              </svg>
            </button>
          </form>

          {/* Remember password */}
          <p className="mt-8 text-[12px] normal-case font-medium" style={{ color: INK }}>
            Ți-ai amintit parola?{" "}
            <Link href="/auth" className="decoration-1 underline-offset-4 hover:underline transition-opacity hover:opacity-70" style={{ color: PINK, textDecorationStyle: "dotted" }}>
              Intră în cont
            </Link>
          </p>

          {/* SAU divider */}
          <div className="w-full flex items-center gap-4 my-8" style={{ opacity: 0.6 }}>
            <div className="flex-grow h-px" style={{ backgroundImage: `linear-gradient(to right, ${INK} 33%, transparent 0%)`, backgroundSize: "6px 1px", backgroundRepeat: "repeat-x" }} />
            <span className="text-[10px] font-bold tracking-widest" style={{ color: "#666" }}>SAU</span>
            <div className="flex-grow h-px" style={{ backgroundImage: `linear-gradient(to right, ${INK} 33%, transparent 0%)`, backgroundSize: "6px 1px", backgroundRepeat: "repeat-x" }} />
          </div>

          {/* Back to signup */}
          <Link
            href="/signup"
            className="w-full text-center text-[12px] font-bold tracking-widest transition-colors duration-200 py-3.5"
            style={{ border: `1.5px solid ${INK}`, background: "transparent", color: INK, fontFamily: MONO }}
            onMouseEnter={(e) => { e.currentTarget.style.background = INK; e.currentTarget.style.color = CREAM; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = INK; }}
          >
            ÎNAPOI LA SIGN UP
          </Link>

          {/* Reassuring note */}
          <p className="mt-12 text-[11px] normal-case font-medium text-center leading-relaxed max-w-[280px]" style={{ color: "#666" }}>
            Dacă email-ul există în sistem,<br />
            vei primi instrucțiunile imediat.
          </p>
        </div>
      </main>

      <BottomStrip />
    </div>
  );
}
