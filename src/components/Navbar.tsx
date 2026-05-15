"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { LogoIcon } from "./LogoIcon";

const TICKER_TEXT =
  "AGENT ACTIV: ROMÂNIA +++ SCANARE MULTI-PLATFORMĂ +++ ACTUALIZARE LIVE +++ INTELIGENȚĂ ARTIFICIALĂ PENTRU SECOND-HAND";

function Marquee() {
  const trackRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const half = track.scrollWidth / 2;

    const step = () => {
      posRef.current -= 0.6;
      if (posRef.current <= -half) posRef.current = 0;
      track.style.transform = `translateX(${posRef.current}px)`;
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

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
      <div
        ref={trackRef}
        className="flex whitespace-nowrap will-change-transform"
        style={{ fontFamily: "var(--font-mono-var), monospace" }}
      >
        <span className="text-[10px] font-bold tracking-[0.14em] uppercase mr-8">
          {renderSegments()}
        </span>
        <span className="text-[10px] font-bold tracking-[0.14em] uppercase mr-8">
          {renderSegments()}
        </span>
      </div>
    </div>
  );
}

const navLinks = [
  { label: "CUM FUNCȚIONEAZĂ", href: "#cum-functioneaza" },
  { label: "PRICING",          href: "#pricing" },
  { label: "DESPRE NOI",       href: "#" },
];

export function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex flex-col">
      {/* Main nav */}
      <nav
        className="flex items-center justify-between px-8 h-[60px]"
        style={{
          background: "#F3F0E7",
          borderBottom: "2px solid #101010",
          fontFamily: "var(--font-mono-var), monospace",
        }}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <LogoIcon size={20} />
          <span
            className="font-bold text-[15px] tracking-tight text-[#101010]"
            style={{ fontFamily: "var(--font-mono-var), monospace" }}
          >
            LiberGent
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="text-[10px] font-bold tracking-[0.12em] text-[#101010] hover:text-[#FF4F8B] transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/auth"
          className="hidden md:inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.1em] text-white px-5 py-2.5 transition-colors hover:bg-[#FF4F8B]"
          style={{ background: "#090909", border: "2px solid #090909" }}
        >
          CONECTEAZĂ-TE →
        </Link>
      </nav>

      {/* Ticker */}
      <Marquee />
    </header>
  );
}
