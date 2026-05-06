"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MascotSVG } from "./MascotSVG";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const isScrolled = window.scrollY > 20;
      setScrolled((prev) => (prev === isScrolled ? prev : isScrolled));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/90 backdrop-blur-md shadow-sm border-b border-[#D9D9D9]" : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <MascotSVG size={32} />
          <span
            className="font-pixel text-[#111111] tracking-tight"
            style={{ fontSize: "13px", lineHeight: 1 }}
          >
            LiberGent
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          <Link
            href="#cum-functioneaza"
            className="text-sm text-[#6B6B6B] hover:text-[#111111] transition-colors font-medium"
          >
            Cum funcționează
          </Link>
          <Link
            href="#despre-noi"
            className="text-sm text-[#6B6B6B] hover:text-[#111111] transition-colors font-medium"
          >
            Despre noi
          </Link>
          <Link
            href="#intrebari"
            className="text-sm text-[#6B6B6B] hover:text-[#111111] transition-colors font-medium"
          >
            Întrebări
          </Link>
          <Link
            href="/trends"
            className="text-sm text-[#6B6B6B] hover:text-[#111111] transition-colors font-medium"
          >
            Trenduri
          </Link>
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/auth"
            className="text-sm font-medium text-[#6B6B6B] hover:text-[#111111] transition-colors"
          >
            Intră în cont
          </Link>
          <Link
            href="/auth"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-[#4F7CFF] text-white text-sm font-semibold hover:bg-[#3d6aec] transition-colors"
          >
            Conectează-te
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-md text-[#111111]"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu — always mounted, animated via max-height */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-200 ${
          menuOpen ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="bg-white border-t border-[#D9D9D9] px-6 py-4 flex flex-col gap-4">
          <Link href="#cum-functioneaza" className="text-sm font-medium text-[#111111]" onClick={() => setMenuOpen(false)}>
            Cum funcționează
          </Link>
          <Link href="#despre-noi" className="text-sm font-medium text-[#111111]" onClick={() => setMenuOpen(false)}>
            Despre noi
          </Link>
          <Link href="#intrebari" className="text-sm font-medium text-[#111111]" onClick={() => setMenuOpen(false)}>
            Întrebări
          </Link>
          <Link href="/trends" className="text-sm font-medium text-[#111111]" onClick={() => setMenuOpen(false)}>
            Trenduri
          </Link>
          <Link
            href="/auth"
            className="inline-flex justify-center items-center px-4 py-2.5 rounded-lg bg-[#4F7CFF] text-white text-sm font-semibold"
            onClick={() => setMenuOpen(false)}
          >
            Conectează-te
          </Link>
        </div>
      </div>
    </nav>
  );
}
