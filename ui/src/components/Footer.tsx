import Link from "next/link";
import { LogoIcon } from "./LogoIcon";

const BG    = "#0A0A0A";
const CREAM = "#F3F0E7";
const PINK  = "#FF2A6D";
const MONO  = "var(--font-mono-var), monospace";

const NAV_LINKS = {
  Produs: [
    { label: "Cum funcționează", href: "#cum-functioneaza" },
    { label: "Căutare", href: "/search" },
    { label: "Alerte", href: "#" },
    { label: "Trenduri", href: "/trenduri" },
  ],
  Companie: [
    { label: "Despre noi", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Cariere", href: "#" },
    { label: "Contact", href: "#" },
  ],
  Legal: [
    { label: "Politică de confidențialitate", href: "#" },
    { label: "Termeni", href: "#" },
    { label: "Cookie-uri", href: "#" },
  ],
};


export function Footer() {
  return (
    <footer
      className="px-6 py-14"
      style={{ background: BG, fontFamily: MONO, borderTop: "2px solid #1A1A1A" }}
    >
      <div className="max-w-[1280px] mx-auto">

        {/* 5-column grid */}
        <div
          className="grid grid-cols-1 md:grid-cols-5 gap-10 md:gap-0"
          style={{ borderBottom: `1px solid ${CREAM}12` }}
        >
          {/* Col 1: Brand */}
          <div
            className="flex flex-col gap-5 pb-10 md:pb-14 md:pr-8"
            style={{ borderRight: `1px solid ${CREAM}12` }}
          >
            <Link href="/" className="flex items-center gap-3">
              <LogoIcon size={24} color={CREAM} eyeColor={BG} />
              <span className="text-[13px] tracking-widest uppercase" style={{ color: CREAM }}>
                LiberGent
              </span>
            </Link>
            <p className="text-[12px] leading-relaxed" style={{ color: `${CREAM}55` }}>
              Agentul tău pentru oferte second-hand din România.
            </p>
            <div className="flex items-center gap-2 text-[10px] tracking-widest uppercase" style={{ color: `${CREAM}33` }}>
              <div style={{ width: 4, height: 4, background: PINK, flexShrink: 0 }} />
              <span>Observă · Analizează · Livrează</span>
            </div>
          </div>

          {/* Cols 2-4: Link groups */}
          {Object.entries(NAV_LINKS).map(([section, items]) => (
            <div
              key={section}
              className="flex flex-col gap-5 pb-10 md:pb-14 md:px-8"
              style={{ borderRight: `1px solid ${CREAM}12` }}
            >
              <div className="text-[10px] tracking-widest uppercase" style={{ color: `${CREAM}44` }}>
                {section}
              </div>
              <ul className="flex flex-col gap-3">
                {items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-[12px] opacity-40 hover:opacity-100 transition-opacity duration-150"
                      style={{ color: CREAM }}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Col 5: Newsletter */}
          <div className="flex flex-col gap-5 pb-10 md:pb-14 md:pl-8">
            <div className="text-[10px] tracking-widest uppercase" style={{ color: `${CREAM}44` }}>
              Newsletter
            </div>
            <p className="text-[12px] leading-relaxed" style={{ color: `${CREAM}55` }}>
              Actualizări lunare. Fără spam.
            </p>
            <div className="flex" style={{ border: `1px solid ${CREAM}22` }}>
              <input
                type="email"
                placeholder="email@exemplu.ro"
                className="flex-1 bg-transparent text-[12px] px-3 py-2.5 outline-none placeholder:opacity-25"
                style={{ color: CREAM, fontFamily: MONO }}
              />
              <button
                type="button"
                className="px-3.5 py-2.5 text-[14px] hover:-translate-y-px hover:-translate-x-px transition-transform duration-150"
                style={{
                  background: PINK,
                  color: CREAM,
                  boxShadow: `2px 2px 0 0 ${CREAM}33`,
                }}
              >
                →
              </button>
            </div>
          </div>
        </div>

        {/* Bottom strip */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6">

          {/* Left: pink dot + copyright */}
          <div className="flex items-center gap-2.5">
            <div style={{ width: 6, height: 6, background: PINK, flexShrink: 0 }} />
            <span className="text-[11px]" style={{ color: `${CREAM}33` }}>
              © 2026 LiberGent — Toate drepturile rezervate.
            </span>
          </div>

          {/* Center: crosshair icon */}
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="shrink-0">
            <circle cx="9" cy="9" r="7" stroke={CREAM} strokeWidth="0.75" opacity="0.18" />
            <line x1="0" y1="9" x2="5.5" y2="9" stroke={CREAM} strokeWidth="0.75" opacity="0.25" />
            <line x1="12.5" y1="9" x2="18" y2="9" stroke={CREAM} strokeWidth="0.75" opacity="0.25" />
            <line x1="9" y1="0" x2="9" y2="5.5" stroke={CREAM} strokeWidth="0.75" opacity="0.25" />
            <line x1="9" y1="12.5" x2="9" y2="18" stroke={CREAM} strokeWidth="0.75" opacity="0.25" />
            <circle cx="9" cy="9" r="1.5" fill={CREAM} opacity="0.18" />
          </svg>

          {/* Right: tagline + dot */}
          <div className="flex items-center gap-2.5">
            <span className="text-[11px]" style={{ color: `${CREAM}2A` }}>
              Cauți mai puțin. Găsești mai bine.
            </span>
            <div style={{ width: 4, height: 4, background: PINK, opacity: 0.5, flexShrink: 0 }} />
          </div>

        </div>
      </div>
    </footer>
  );
}
