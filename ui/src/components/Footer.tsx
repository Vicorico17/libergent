import Link from "next/link";
import { LogoIcon } from "./LogoIcon";

const BG    = "#0A0A0A";
const CREAM = "#F3F0E7";
const PINK  = "#FF2A6D";
const MONO  = "var(--font-mono-var), monospace";

const NAV_LINKS = {
  Produs: [
    { label: "Cum funcționează", href: "/#cum-functioneaza" },
    { label: "Căutare", href: "/#cautare" },
    { label: "Prețuri", href: "/#pricing" },
    { label: "Trenduri", href: "/trenduri" },
  ],
  Companie: [
    { label: "Despre LiberGent", href: "/#cum-functioneaza" },
    { label: "Întrebări frecvente", href: "/#intrebari" },
    { label: "Platforme active", href: "/#platforme" },
    { label: "Trenduri produse", href: "/trenduri" },
  ],
  Legal: [
    { label: "Politică de confidențialitate", href: "/confidentialitate" },
    { label: "Termeni", href: "/termeni" },
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

        {/* 4-column grid */}
        <div
          className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-0"
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
              Motor de căutare pentru produse noi sau folosite din România: OLX, Vinted,
              LaJumate, Okazii, Publi24 și Autovit.
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
              Caută produse. Compară oferte. Alege mai bine.
            </span>
            <div style={{ width: 4, height: 4, background: PINK, opacity: 0.5, flexShrink: 0 }} />
          </div>

        </div>
      </div>
    </footer>
  );
}
