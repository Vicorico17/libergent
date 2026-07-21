"use client";

import { useState, useEffect } from "react";

const BG    = "#F8F6F0";
const INK   = "#1A1A1A";
const PINK  = "#FF2A6D";
const GREEN = "#50C878";
const MONO  = "var(--font-jetbrains-var), var(--font-mono-var), monospace";

const CHAMFER    = "polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)";
const CHAMFER_SM = "polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)";

function formatLiveTime() {
  return new Date().toLocaleTimeString("ro-RO", { hour12: false });
}

function useLiveTime() {
  const [t, setT] = useState(() => formatLiveTime());
  useEffect(() => {
    const id = setInterval(() => setT(formatLiveTime()), 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

const LINES: { angle: number; delay: string; w: string }[] = [
  { angle: -160, delay: "0.1s", w: "38%" },
  { angle: -180, delay: "1.5s", w: "42%" },
  { angle:  160, delay: "0.8s", w: "38%" },
  { angle:  -20, delay: "0.4s", w: "38%" },
  { angle:    0, delay: "2.1s", w: "42%" },
  { angle:   20, delay: "1.2s", w: "38%" },
];

const NODES: { label: string; pos: React.CSSProperties; side: "L" | "R" }[] = [
  { label: "OLX",      pos: { top: "20%",   left: "8%"  }, side: "L" },
  { label: "VINTED",   pos: { top: "50%",   left: "5%", transform: "translateY(-50%)" }, side: "L" },
  { label: "LAJUMATE", pos: { bottom: "20%",left: "8%"  }, side: "L" },
  { label: "PUBLI24",  pos: { top: "20%",   right: "8%" }, side: "R" },
  { label: "OKAZII",   pos: { top: "50%",   right: "5%", transform: "translateY(-50%)" }, side: "R" },
  { label: "AUTOVIT",  pos: { bottom: "20%",right: "8%" }, side: "R" },
];

const PLATFORMS = [
  { name: "OLX",      latency: "42ms", pct: 82, anim: [0, 2, 6] },
  { name: "VINTED",   latency: "31ms", pct: 91, anim: [1, 4, 8] },
  { name: "LAJUMATE", latency: "58ms", pct: 67, anim: [0, 4]    },
  { name: "PUBLI24",  latency: "45ms", pct: 76, anim: [1, 5]    },
  { name: "OKAZII",   latency: "39ms", pct: 88, anim: [0, 3, 9] },
  { name: "AUTOVIT",  latency: "53ms", pct: 73, anim: [1, 5]    },
];

const ANIM_CLS = ["anim-bar-1", "anim-bar-2", "anim-bar-3"];
const SPARKLINE = [40, 70, 30, 50, 90, 60, 40, 80, 100, 70, 50, 30];

const CORNERS = [
  { pos: "top-2 left-2" },
  { pos: "top-2 right-2" },
  { pos: "bottom-2 left-2" },
  { pos: "bottom-2 right-2" },
];

export function HowItWorks() {
  const liveTime = useLiveTime();

  return (
    <section id="cum-functioneaza" style={{ background: BG, fontFamily: MONO }} className="px-6 py-16 lg:py-24">
      <div className="max-w-[1200px] mx-auto">

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-8 mb-12">
          <div className="max-w-xl">
            <h2 className="font-semibold tracking-tighter leading-[1.15]"
              style={{ fontSize: "clamp(28px, 3.5vw, 42px)", color: INK }}>
              Conectat la marketplace-urile<br />
              folosite în România
              <span className="inline-block ml-1.5 -mb-0.5" style={{ width: 12, height: 12, background: PINK }} />
            </h2>
          </div>
          <p className="lg:max-w-[320px] lg:pl-6 text-[13px] leading-[1.7] pt-2"
            style={{ borderLeft: `1px solid ${INK}4D`, color: `${INK}CC` }}>
            Agentul pornește căutarea pe OLX, Vinted, LaJumate, Okazii, Publi24
            și Autovit pentru căutările auto, apoi mută anunțurile într-un singur flux comparabil.
          </p>
        </div>

        {/* Dashboard card */}
        <div className="clip-chamfer-lg relative" style={{ border: `1px solid ${INK}`, background: BG, boxShadow: "4px 4px 0px 0px rgba(26,26,26,0.05)" }}>

          {/* Corner marks */}
          {CORNERS.map(({ pos }) => (
            <div key={pos} className={`absolute ${pos} text-xs leading-none z-20`} style={{ color: `${INK}4D` }}>+</div>
          ))}

          {/* Top bar */}
          <div className="flex justify-between items-center px-5 py-3 relative z-10"
            style={{ borderBottom: `1px solid ${INK}`, background: BG }}>
            <div className="flex items-center gap-3">
              <div className="px-2 py-0.5 text-[11px]" style={{ background: `${INK}0D`, border: `1px solid ${INK}33` }}>
                {">_"}
              </div>
              <span className="text-[13px] tracking-wide font-medium">LIVE MARKET NETWORK</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] tracking-widest uppercase" style={{ color: `${INK}B3` }}>UPDATED LIVE</span>
              <div className="w-2 h-2 rounded-full soft-pulse"
                style={{ background: PINK, boxShadow: `0 0 8px rgba(255,42,109,0.4)` }} />
            </div>
          </div>

          {/* Main: diagram + table */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr]"
            style={{ borderBottom: `1px solid ${INK}` }}>

            {/* Network diagram */}
            <div className="relative min-h-[450px] flex items-center justify-center overflow-hidden p-8 z-0"
              style={{ borderRight: `1px solid ${INK}` }}>

              {/* Grid bg */}
              <div className="absolute inset-0 z-0 opacity-[0.04]" style={{
                backgroundImage: `linear-gradient(${INK} 1px, transparent 1px), linear-gradient(90deg, ${INK} 1px, transparent 1px)`,
                backgroundSize: "20px 20px",
              }} />

              {/* Static rings */}
              <div className="absolute rounded-full border z-0" style={{ top: "50%", left: "50%", width: 200, height: 200, transform: "translate(-50%,-50%)", borderColor: `${INK}1A` }} />
              <div className="absolute rounded-full border border-dashed z-0" style={{ top: "50%", left: "50%", width: 350, height: 350, transform: "translate(-50%,-50%)", borderColor: `${INK}1A` }} />

              {/* Animated radar rings */}
              <div className="absolute rounded-full border radar-ring z-0" style={{ top: "50%", left: "50%", width: 150, height: 150, borderColor: GREEN }} />
              <div className="absolute rounded-full border radar-ring-delayed z-0" style={{ top: "50%", left: "50%", width: 150, height: 150, borderColor: GREEN }} />

              {/* Connection lines + packets */}
              {LINES.map(({ angle, delay, w }, i) => (
                <div key={i} className="absolute h-[1px] origin-left z-10" style={{
                  top: "50%", left: "50%", width: w,
                  transform: `translateY(-50%) rotate(${angle}deg)`,
                  background: `linear-gradient(to right, ${INK}4D, transparent)`,
                }}>
                  <div className="absolute w-1.5 h-1.5 rounded-full packet-anim" style={{
                    top: "50%",
                    background: PINK,
                    boxShadow: `0 0 6px ${PINK}`,
                    animationDelay: delay,
                  }} />
                </div>
              ))}

              {/* Platform nodes */}
              {NODES.map(({ label, pos, side }) => (
                <div key={label} className="absolute z-20 flex items-center" style={{
                  ...pos,
                  background: BG,
                  border: `1px solid ${INK}`,
                  padding: "8px 20px",
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  clipPath: CHAMFER_SM,
                  boxShadow: "2px 2px 0px rgba(26,26,26,0.05)",
                }}>
                  [{label}]
                  <div className="absolute top-1/2 w-1.5 h-1.5 rounded-full" style={{
                    [side === "L" ? "right" : "left"]: -6,
                    transform: "translateY(-50%)",
                    background: GREEN,
                    boxShadow: `0 0 5px ${GREEN}`,
                  }} />
                </div>
              ))}

              {/* Center node */}
              <div className="relative z-30 p-1" style={{
                background: BG, border: `1px solid ${INK}33`,
                clipPath: CHAMFER, boxShadow: "0 0 30px rgba(255,255,255,0.5)",
              }}>
                <div className="relative overflow-hidden px-8 py-6 flex flex-col items-center" style={{ background: BG, border: `1px solid ${INK}`, clipPath: CHAMFER }}>
                  <div className="absolute top-0 left-0 w-2 h-2" style={{ borderTop: `2px solid ${INK}`, borderLeft: `2px solid ${INK}` }} />
                  <div className="absolute top-0 right-0 w-2 h-2" style={{ borderTop: `2px solid ${INK}`, borderRight: `2px solid ${INK}` }} />
                  <div className="absolute bottom-0 left-0 w-2 h-2" style={{ borderBottom: `2px solid ${INK}`, borderLeft: `2px solid ${INK}` }} />
                  <div className="absolute bottom-0 right-0 w-2 h-2" style={{ borderBottom: `2px solid ${INK}`, borderRight: `2px solid ${INK}` }} />
                  <span className="text-[13px] tracking-widest font-medium leading-tight text-center" style={{ color: INK }}>
                    LIBERGENT<br />CORE
                  </span>
                  <div className="w-8 mt-3" style={{ height: 2, background: PINK }} />
                </div>
              </div>

              {/* SYNC status */}
              <div className="absolute bottom-5 left-5 flex items-center gap-2 z-20 text-[10px] tracking-widest"
                style={{ color: `${INK}CC` }}>
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: GREEN }} />
                SYNC ACTIVE
              </div>
            </div>

            {/* Data table */}
            <div className="flex flex-col z-10" style={{ background: BG }}>

              {/* Table header */}
              <div className="grid gap-4 px-6 py-4 text-[10px] tracking-widest uppercase"
                style={{ gridTemplateColumns: "1fr 80px 60px auto", borderBottom: `1px solid ${INK}1A`, color: `${INK}80` }}>
                <div>SURSA</div>
                <div>STATUS</div>
                <div>LATENCY</div>
                <div className="text-right">LOAD</div>
              </div>

              {/* Rows */}
              {PLATFORMS.map((p, idx) => {
                const total = 14;
                const filled = Math.round(total * p.pct / 100);
                return (
                  <div key={p.name}
                    className="grid gap-4 px-6 py-[14px] items-center transition-colors hover:bg-black/[0.02]"
                    style={{
                      gridTemplateColumns: "1fr 80px 60px auto",
                      borderBottom: idx < PLATFORMS.length - 1 ? `1px solid ${INK}0D` : undefined,
                    }}>
                    <div className="text-[12px] tracking-wide" style={{ color: INK }}>
                      {">"} [{p.name}]
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] tracking-wider">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: GREEN }} />
                      ONLINE
                    </div>
                    <div className="text-[11px]" style={{ color: `${INK}B3` }}>{p.latency}</div>
                    <div className="flex items-center justify-end gap-3">
                      <div className="flex gap-[1px]">
                        {[...Array(filled)].map((_, i) => {
                          const ai = p.anim.indexOf(i);
                          return <div key={i} className={ai >= 0 ? ANIM_CLS[ai % 3] : ""} style={{ width: 6, height: 8, background: `${INK}66` }} />;
                        })}
                        {[...Array(total - filled)].map((_, i) => (
                          <div key={i} style={{ width: 6, height: 8, border: `1px solid ${INK}33` }} />
                        ))}
                      </div>
                      <span className="text-[11px] w-7 text-right">{p.pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom strip */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr]">

            {/* Live scan load */}
            <div className="p-6 lg:p-8 flex flex-col justify-center gap-4"
              style={{ borderRight: `1px solid ${INK}` }}>
              <div className="text-[11px] tracking-widest" style={{ color: `${INK}99` }}>LIVE SCAN LOAD</div>
              <div className="flex items-center gap-6">
                <div className="flex-1 flex gap-[2px] h-6">
                  {[...Array(30)].map((_, i) => (
                    <div key={i}
                      className={`flex-1 h-full ${i === 21 ? "anim-bar-2" : ""}`}
                      style={{
                        background: i < 22 ? `${INK}66` : "transparent",
                        border: i < 22 ? "none" : `1px solid ${INK}1A`,
                      }}
                    />
                  ))}
                </div>
                <div className="text-[28px] leading-none tracking-tighter shrink-0" style={{ color: INK }}>_74%</div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3">
              <div className="p-4 lg:p-6 flex flex-col justify-between" style={{ borderRight: `1px solid ${INK}33` }}>
                <div className="text-[9px] tracking-widest mb-2" style={{ color: `${INK}99` }}>PACKETS / MIN</div>
                <div className="text-xl tracking-tight mb-3" style={{ color: INK }}>12.4K</div>
                <div className="flex items-end gap-[2px] h-3">
                  {SPARKLINE.map((h, i) => (
                    <div key={i} className={ANIM_CLS[i % 3]} style={{
                      width: 3, height: `${h}%`, background: PINK, opacity: 0.8,
                      animationDelay: `${(i * 0.1).toFixed(1)}s`,
                    }} />
                  ))}
                </div>
              </div>
              <div className="p-4 lg:p-6 flex flex-col justify-between" style={{ borderRight: `1px solid ${INK}33` }}>
                <div className="text-[9px] tracking-widest mb-2" style={{ color: `${INK}99` }}>LAST UPDATE</div>
                <div className="text-xl tracking-tight mb-3" style={{ color: INK }}>{liveTime}</div>
                <div className="text-[11px] tracking-wider font-medium" style={{ color: PINK }}>LIVE</div>
              </div>
              <div className="p-4 lg:p-6 flex flex-col justify-between">
                <div className="text-[9px] tracking-widest mb-2" style={{ color: `${INK}99` }}>UPTIME</div>
                <div className="text-xl tracking-tight mb-3" style={{ color: INK }}>99.98%</div>
                <div className="text-[11px] tracking-wider font-medium" style={{ color: PINK }}>STABLE</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
