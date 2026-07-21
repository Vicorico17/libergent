import Link from "next/link";
import { LogoIcon } from "../LogoIcon";

const BG   = "#F3F0E7";
const INK  = "#101010";
const PINK = "#FF2A6D";
const MONO = "var(--font-mono-var), monospace";

const CORNERS = ["top-3 left-3", "top-3 right-3", "bottom-3 left-3", "bottom-3 right-3"];

function ConstellationSVG() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 1280 560"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <pattern id="cta-bg-grid" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
          <rect x="15" y="15" width="2" height="2" fill={INK} opacity="0.06" />
        </pattern>
      </defs>

      {/* Grid dots */}
      <rect width="1280" height="560" fill="url(#cta-bg-grid)" />

      {/* Stepped concentric rings */}
      <rect x="490" y="130" width="300" height="300" stroke={INK} strokeWidth="1" opacity="0.07" strokeDasharray="6 4" />
      <rect x="430" y="90"  width="420" height="380" stroke={INK} strokeWidth="1" opacity="0.05" strokeDasharray="4 8" />
      <rect x="355" y="48"  width="570" height="464" stroke={INK} strokeWidth="1" opacity="0.04" />
      <rect x="270" y="8"   width="740" height="544" stroke={INK} strokeWidth="1" opacity="0.03" strokeDasharray="2 10" />

      {/* Connection routes */}
      <path id="cta-r1" d="M 80,60 L 640,280"   stroke={PINK} strokeWidth="1" opacity="0.22" strokeDasharray="4 4" />
      <path id="cta-r2" d="M 1200,80 L 640,280"  stroke={PINK} strokeWidth="1" opacity="0.22" strokeDasharray="4 4" />
      <path id="cta-r3" d="M 60,500 L 640,280"   stroke={PINK} strokeWidth="1" opacity="0.22" strokeDasharray="4 4" />
      <path id="cta-r4" d="M 1220,480 L 640,280" stroke={PINK} strokeWidth="1" opacity="0.22" strokeDasharray="4 4" />
      <path id="cta-r5" d="M 640,18 L 640,280"   stroke={PINK} strokeWidth="1" opacity="0.14" strokeDasharray="3 5" />

      {/* Animated packet dots */}
      <circle r="3" fill={PINK} opacity="0.9">
        <animateMotion dur="5s" repeatCount="indefinite"><mpath href="#cta-r1" /></animateMotion>
      </circle>
      <circle r="3" fill={PINK} opacity="0.9">
        <animateMotion dur="4s" repeatCount="indefinite" begin="1.5s"><mpath href="#cta-r2" /></animateMotion>
      </circle>
      <circle r="3" fill={PINK} opacity="0.9">
        <animateMotion dur="6s" repeatCount="indefinite" begin="0.8s"><mpath href="#cta-r3" /></animateMotion>
      </circle>
      <circle r="3" fill={PINK} opacity="0.9">
        <animateMotion dur="4.5s" repeatCount="indefinite" begin="2.2s"><mpath href="#cta-r4" /></animateMotion>
      </circle>
      <circle r="2" fill={PINK} opacity="0.7">
        <animateMotion dur="3s" repeatCount="indefinite" begin="1s"><mpath href="#cta-r5" /></animateMotion>
      </circle>

      {/* Node crosshairs */}
      <line x1="73"  y1="60"  x2="87"  y2="60"  stroke={INK} strokeWidth="1" opacity="0.25" />
      <line x1="80"  y1="53"  x2="80"  y2="67"  stroke={INK} strokeWidth="1" opacity="0.25" />
      <rect  x="76"  y="56"  width="8" height="8" stroke={INK} strokeWidth="0.75" opacity="0.15" />

      <line x1="1193" y1="80"  x2="1207" y2="80"  stroke={INK} strokeWidth="1" opacity="0.25" />
      <line x1="1200" y1="73"  x2="1200" y2="87"  stroke={INK} strokeWidth="1" opacity="0.25" />
      <rect  x="1196" y="76" width="8" height="8" stroke={INK} strokeWidth="0.75" opacity="0.15" />

      <line x1="53"  y1="500" x2="67"  y2="500" stroke={INK} strokeWidth="1" opacity="0.25" />
      <line x1="60"  y1="493" x2="60"  y2="507" stroke={INK} strokeWidth="1" opacity="0.25" />

      <line x1="1213" y1="480" x2="1227" y2="480" stroke={INK} strokeWidth="1" opacity="0.25" />
      <line x1="1220" y1="473" x2="1220" y2="487" stroke={INK} strokeWidth="1" opacity="0.25" />

      {/* Center crosshair */}
      <line x1="626" y1="280" x2="654" y2="280" stroke={PINK} strokeWidth="1" opacity="0.5" />
      <line x1="640" y1="266" x2="640" y2="294" stroke={PINK} strokeWidth="1" opacity="0.5" />
      <circle cx="640" cy="280" r="3" fill={PINK} opacity="0.4" />

      {/* Node labels */}
      <text x="92"  y="56"  fill={INK} fontSize="8" opacity="0.2" fontFamily="monospace">[OLX]</text>
      <text x="1142" y="76" fill={INK} fontSize="8" opacity="0.2" fontFamily="monospace">[VINTED]</text>
      <text x="26"  y="498" fill={INK} fontSize="8" opacity="0.2" fontFamily="monospace">[AUTOVIT]</text>
      <text x="1168" y="476" fill={INK} fontSize="8" opacity="0.2" fontFamily="monospace">[OKAZII]</text>

      {/* Flickering pixels */}
      <rect x="300"  y="148" width="3" height="3" fill={INK}>
        <animate attributeName="opacity" values="0;0.3;0" dur="2.8s" repeatCount="indefinite" />
      </rect>
      <rect x="900"  y="198" width="3" height="3" fill={INK}>
        <animate attributeName="opacity" values="0;0.25;0" dur="3.4s" repeatCount="indefinite" begin="1s" />
      </rect>
      <rect x="400"  y="418" width="3" height="3" fill={INK}>
        <animate attributeName="opacity" values="0;0.35;0" dur="2.1s" repeatCount="indefinite" begin="0.5s" />
      </rect>
      <rect x="1050" y="348" width="3" height="3" fill={INK}>
        <animate attributeName="opacity" values="0;0.2;0" dur="4s" repeatCount="indefinite" begin="1.8s" />
      </rect>
      <rect x="180"  y="348" width="3" height="3" fill={PINK}>
        <animate attributeName="opacity" values="0;0.5;0" dur="3.1s" repeatCount="indefinite" begin="0.3s" />
      </rect>
      <rect x="1100" y="138" width="3" height="3" fill={PINK}>
        <animate attributeName="opacity" values="0;0.45;0" dur="2.7s" repeatCount="indefinite" begin="1.4s" />
      </rect>

      {/* Scan sweep */}
      <line x1="0" y1="0" x2="1280" y2="0" stroke={PINK} strokeWidth="1" opacity="0.08">
        <animateTransform attributeName="transform" type="translate" from="0,0" to="0,560" dur="8s" repeatCount="indefinite" />
      </line>
    </svg>
  );
}


export function FinalCTA() {
  return (
    <section
      className="relative overflow-hidden px-6 py-20 lg:py-28"
      style={{ background: BG, fontFamily: MONO }}
    >
      <ConstellationSVG />

      {/* Corner + marks */}
      {CORNERS.map((pos) => (
        <div key={pos} className={`absolute ${pos} w-5 h-5 pointer-events-none`}>
          <div className="absolute top-1/2 left-0 w-full" style={{ height: 1, background: INK, opacity: 0.2 }} />
          <div className="absolute left-1/2 top-0 h-full" style={{ width: 1, background: INK, opacity: 0.2 }} />
        </div>
      ))}

      <div className="relative z-10 max-w-[1280px] mx-auto flex flex-col items-center text-center gap-8 lg:gap-10">

        {/* Logo mascot */}
        <LogoIcon size={64} />

        {/* Headline */}
        <h2
          className="font-bold leading-none tracking-tight"
          style={{ fontFamily: MONO, fontSize: "clamp(44px, 7vw, 96px)", color: INK }}
        >
          Găsește oferta potrivită.
        </h2>

        {/* Subtitle */}
        <p className="text-[13px] tracking-wide normal-case" style={{ color: `${INK}99` }}>
          Caută gratuit pe marketplace-uri din România. Fără card. Fără cont obligatoriu.
        </p>

        {/* Tagline */}
        <div className="flex items-center gap-4 text-[12px] tracking-widest uppercase">
          <span style={{ color: "#2B5EFE" }}>Observă.</span>
          <div style={{ width: 5, height: 5, background: PINK, flexShrink: 0 }} />
          <span style={{ color: PINK }}>Analizează.</span>
          <div style={{ width: 5, height: 5, background: PINK, flexShrink: 0 }} />
          <span style={{ color: INK }}>Livrează.</span>
        </div>

        {/* CTA button */}
        <Link
          href="/#cautare"
          className="hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-150 text-[12px] tracking-widest uppercase px-8 py-3.5"
          style={{
            background: INK,
            color: BG,
            border: `2px solid ${INK}`,
            boxShadow: `4px 4px 0 0 ${INK}`,
            fontFamily: MONO,
          }}
        >
          Caută acum →
        </Link>

      </div>
    </section>
  );
}
