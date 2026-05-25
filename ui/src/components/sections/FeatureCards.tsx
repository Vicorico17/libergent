"use client";

import { useEffect, useRef } from "react";

const MONO = "var(--font-mono-var), monospace";

const PINK  = "#FF1F5A";
const BLACK = "#0A0A0A";
const BG    = "#F2F0EA";

function Squares() {
  return (
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => <div key={i} style={{ width: 12, height: 12, background: BLACK }} />)}
    </div>
  );
}

function DotSep() {
  return <div className="dot-sep" />;
}

/* ── Card 01: Scanare ── */
function ScanCard() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-10">
          <span className="font-bold text-[18px]" style={{ color: PINK, fontFamily: MONO }}>01</span>
          <Squares />
        </div>

        <h2 className="font-bold uppercase text-[14px] leading-snug mb-6" style={{ fontFamily: MONO }}>
          SCANARE<br />MULTI-PLATFORMĂ
        </h2>
        <DotSep />

        <ul className="flex flex-col gap-4 flex-grow">
          {[
            { code: "OLX", label: "OLX" },
            { code: "V",   label: "VINTED" },
            { code: "O",   label: "OKAZII" },
            { code: "P",   label: "PUBLI24" },
            { code: "A",   label: "AUTOVIT" },
          ].map((s) => (
            <li key={s.label} className="flex items-center gap-4 text-[12px] font-bold uppercase" style={{ fontFamily: MONO }}>
              <div
                className="flex items-center justify-center text-white shrink-0"
                style={{ width: 24, height: 24, background: BLACK, fontSize: 9, fontWeight: 700 }}
              >
                {s.code}
              </div>
              {s.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="p-6 flex items-center justify-between" style={{ borderTop: `1px solid ${BLACK}`, opacity: 1 }}>
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase" style={{ fontFamily: MONO }}>
          <div className="soft-pulse rounded-full" style={{ width: 10, height: 10, background: PINK }} />
          LIVE
        </div>
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bar-loading"
              style={{
                width: 6, height: 6, background: PINK,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Card 02: Detectare Duplicate ── */
function DuplicateCard() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-10">
          <span className="font-bold text-[18px]" style={{ color: PINK, fontFamily: MONO }}>02</span>
          <Squares />
        </div>

        <h2 className="font-bold uppercase text-[14px] leading-snug mb-6" style={{ fontFamily: MONO }}>
          DETECTARE<br />DUPLICATE
        </h2>
        <DotSep />

        <div className="flex flex-col gap-5 flex-grow">
          <div className="flex items-baseline gap-3">
            <span className="font-bold leading-none" style={{ fontSize: 42, color: PINK, fontFamily: MONO }}>18</span>
            <span className="text-[10px] font-bold uppercase" style={{ fontFamily: MONO }}>duplicate eliminate</span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="font-bold leading-none" style={{ fontSize: 42, color: PINK, fontFamily: MONO }}>4</span>
            <span className="text-[10px] font-bold uppercase" style={{ fontFamily: MONO }}>listings suspecte filtrate</span>
          </div>
        </div>
      </div>

      <div className="p-6" style={{ borderTop: `1px solid ${BLACK}` }}>
        <div className="text-[10px] font-bold uppercase mb-1.5" style={{ fontFamily: MONO }}>CONFIDENCE:</div>
        <div className="font-bold mb-3" style={{ fontSize: 22, color: PINK, fontFamily: MONO }}>92%</div>

        <div className="flex gap-1">
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="flex-1 h-4"
              style={{
                border: `1px solid ${i < 14 ? PINK : BLACK}`,
                background: i < 14 ? PINK : "transparent",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Card 03: Analiză Preț ── */
function PriceCard() {
  const graphRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = graphRef.current;
    if (!c) return;
    c.innerHTML = "";
    const n = 44;
    for (let i = 0; i < n; i++) {
      const wrap = document.createElement("div");
      wrap.className = "flex-1 flex items-end h-full";

      const bar = document.createElement("div");
      let h = Math.random() * 22 + 8;
      if (i > n * 0.38 && i < n * 0.82) h += Math.random() * 48 + 20;
      h = Math.min(h, 100);

      bar.style.cssText = `width:100%;height:${h}%;transform-origin:bottom;`;
      bar.className =
        h > 52 || (i > n * 0.55 && i < n * 0.82 && Math.random() > 0.35)
          ? "bg-[#FF1F5A]"
          : "bg-[#0A0A0A]";

      const dur = (Math.random() * 1.4 + 0.9).toFixed(2);
      const del = (Math.random() * -2).toFixed(2);
      bar.style.animation = `graph-bounce ${dur}s ease-in-out infinite alternate ${del}s`;

      wrap.appendChild(bar);
      c.appendChild(wrap);
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-10">
          <span className="font-bold text-[18px]" style={{ color: PINK, fontFamily: MONO }}>03</span>
          <Squares />
        </div>

        <h2 className="font-bold uppercase text-[14px] leading-snug mb-6" style={{ fontFamily: MONO }}>
          ANALIZĂ<br />PREȚ
        </h2>
        <DotSep />

        <div className="mb-5">
          <div className="text-[10px] font-bold uppercase mb-1" style={{ fontFamily: MONO }}>MEDIAN PRICE</div>
          <div className="text-[20px] font-bold" style={{ fontFamily: MONO }}>1.420 RON</div>
        </div>
        <DotSep />
        <div>
          <div className="text-[10px] font-bold uppercase mb-1" style={{ fontFamily: MONO }}>BEST DEAL</div>
          <div className="text-[20px] font-bold mb-1.5" style={{ color: PINK, fontFamily: MONO }}>1.190 RON</div>
          <div className="text-[16px] font-bold" style={{ color: PINK, fontFamily: MONO }}>↓-16%</div>
        </div>
      </div>

      <div
        ref={graphRef}
        className="flex items-end justify-between gap-[2px] px-4 pb-3 pt-2"
        style={{ height: 112, borderTop: `1px solid ${BLACK}` }}
      />
    </div>
  );
}

/* ── Card 04: Filtrare ── */
function FilterCard() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-10">
          <span className="font-bold text-[18px]" style={{ color: PINK, fontFamily: MONO }}>04</span>
          <Squares />
        </div>

        <h2 className="font-bold uppercase text-[14px] leading-snug mb-6" style={{ fontFamily: MONO }}>
          FILTRARE &<br />SORTARE
        </h2>
        <DotSep />

        <div className="text-[11px] font-bold uppercase mb-5" style={{ fontFamily: MONO }}>AJUSTEZI:</div>

        <ul className="flex flex-col gap-4 flex-grow">
          {["surse active", "preț minim/maxim", "stare produs"].map((item) => (
            <li key={item} className="flex items-center gap-3 text-[13px] font-bold" style={{ fontFamily: MONO }}>
              <span style={{ color: PINK }}>{">"}</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="p-6 flex items-center gap-3" style={{ borderTop: `1px solid ${BLACK}` }}>
        <div className="soft-pulse rounded-full shrink-0" style={{ width: 10, height: 10, background: PINK }} />
        <div className="text-[11px] font-bold uppercase flex items-center" style={{ fontFamily: MONO }}>
          FILTRARE ACTIVĂ
          <span className="blink inline-block ml-1" style={{ width: 7, height: 15, background: BLACK }} />
        </div>
      </div>
    </div>
  );
}

const featureCards = [ScanCard, DuplicateCard, PriceCard, FilterCard];

export function FeatureCards() {
  return (
    <section style={{ background: BG }} className="px-6 py-16 lg:py-24">
      <div className="max-w-[1400px] mx-auto">

        {/* Section headline */}
        <div className="mb-12">
          <div
            className="font-bold text-[11px] tracking-widest uppercase mb-5 flex items-center gap-2"
            style={{ color: PINK, fontFamily: MONO }}
          >
            02 / CUM FUNCȚIONEAZĂ
          </div>

          <h2
            className="font-bold leading-[0.95] mb-5"
            style={{ fontFamily: MONO, fontSize: "clamp(40px, 5.5vw, 80px)", color: BLACK }}
          >
            Căutare<br />
            second-hand completă<span style={{ color: PINK }}>.</span>
          </h2>

          <p className="text-[16px] font-medium max-w-2xl" style={{ color: `${BLACK}99`, fontFamily: MONO }}>
            Scrii produsul o singură dată. LiberGent verifică marketplace-urile active,
            elimină duplicatele și compară prețurile pentru anunțuri second-hand din România.
          </p>
        </div>

        {/* 4-card grid with shared borders */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4" style={{ border: `1px solid ${BLACK}` }}>
          {featureCards.map((Card, i) => (
            <div key={i} style={{ borderLeft: i > 0 ? `1px solid ${BLACK}` : undefined }}>
              <Card />
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
