"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./Navbar.module.css";
import { LogoIcon } from "./LogoIcon";
import { AccountNavLink } from "./AccountNavLink";
import { PremiumNavLink } from "./PremiumNavLink";

const TICKER_TEXT =
  "AGENT ACTIV: ROMÂNIA +++ SCANARE MULTI-PLATFORMĂ +++ COMPARARE OFERTE +++ INTELIGENȚĂ ARTIFICIALĂ PENTRU SECOND-HAND";

const navLinks = [
  { label: "CAUTĂ", href: "/#cautare" },
  { label: "VINDE", href: "/vinde" },
  { label: "DISCOVERY", href: "/discovery" },
  { label: "STATS", href: "/stats" },
  { label: "DEVELOPMENT", href: "/development" },
  { label: "PREMIUM", href: "/pricing" },
];

function Marquee() {
  const segments = `${TICKER_TEXT}      `.split("+++");

  const renderSegments = () =>
    segments.map((part, i, arr) => (
      <span key={i}>
        {part}
        {i < arr.length - 1 && <span style={{ color: "#FF4F8B" }}>+++</span>}
      </span>
    ));

  return (
    <div className="overflow-hidden bg-[#101010] text-white py-[7px] select-none">
      <span className="sr-only">{TICKER_TEXT}</span>
      <div
        aria-hidden="true"
        className={styles.tickerTrack}
        style={{ fontFamily: "var(--font-mono-var), monospace" }}
      >
        {[0, 1].map((group) => (
          <div key={group} className={styles.tickerGroup}>
            {[0, 1].map((copy) => (
              <span key={copy} className="shrink-0 text-[10px] font-bold tracking-[0.14em] uppercase">
                {renderSegments()}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex flex-col">
      <nav
        className="flex items-center justify-between px-4 sm:px-8 h-[60px]"
        style={{
          background: "#F3F0E7",
          borderBottom: "2px solid #101010",
          fontFamily: "var(--font-mono-var), monospace",
        }}
      >
        <Link href="/" className="flex items-center gap-2.5 shrink-0" onClick={() => setMenuOpen(false)}>
          <LogoIcon size={20} />
          <span
            className="font-bold text-[15px] tracking-tight text-[#101010]"
            style={{ fontFamily: "var(--font-mono-var), monospace" }}
          >
            LiberGent
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => link.href === "/pricing" ? <PremiumNavLink key={link.href} /> : (
            <Link
              key={link.label}
              href={link.href}
              className="text-[10px] font-bold tracking-[0.12em] text-[#101010] hover:text-[#FF4F8B] transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <AccountNavLink />
        </div>

        <button
          type="button"
          className="md:hidden flex items-center justify-center w-10 h-10 text-[#101010]"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          style={{ border: "1.5px solid #101010" }}
        >
          {menuOpen ? (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M3 5a1 1 0 011-1h14a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h14a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h14a1 1 0 110 2H4a1 1 0 01-1-1z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>
      </nav>

      <div
        className={`md:hidden overflow-hidden transition-all duration-200 ${
          menuOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
        }`}
        style={{
          background: "#F3F0E7",
          borderBottom: menuOpen ? "2px solid #101010" : "0 solid transparent",
          fontFamily: "var(--font-mono-var), monospace",
        }}
      >
        <div className="px-4 py-4 flex flex-col gap-4">
          {navLinks.map((link) => link.href === "/pricing" ? <PremiumNavLink key={link.href} onClick={() => setMenuOpen(false)} /> : (
            <Link
              key={link.label}
              href={link.href}
              className="text-[11px] font-bold tracking-[0.12em] text-[#101010]"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <AccountNavLink compact />
        </div>
      </div>

      <Marquee />
    </header>
  );
}
