import Link from "next/link";
import { MascotSVG } from "./MascotSVG";

const links = {
  Produs: [
    { label: "Cum funcționează", href: "#cum-functioneaza" },
    { label: "Prețuri", href: "#planuri" },
    { label: "Platforme", href: "#platforme" },
  ],
  Companie: [
    { label: "Despre noi", href: "#despre-noi" },
    { label: "Blog", href: "#" },
    { label: "Contact", href: "#" },
  ],
  Legal: [
    { label: "Politică de confidențialitate", href: "#" },
    { label: "Termeni și condiții", href: "#" },
    { label: "Cookie-uri", href: "#" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-[#111111] border-t border-[#333333] pt-16 pb-8 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-4 gap-10 mb-14">
          {/* Brand */}
          <div className="flex flex-col gap-4">
            <Link href="/" className="flex items-center gap-2.5">
              <MascotSVG size={28} color="#ffffff" />
              <span className="font-pixel text-white" style={{ fontSize: "11px" }}>
                LiberGent
              </span>
            </Link>
            <p className="text-sm text-[#6B6B6B] leading-relaxed max-w-[200px]">
              Găsește rapid produse second-hand, fără stres.
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-[#4F7CFF] font-semibold">Observă.</span>
              <span className="text-xs text-[#A259FF] font-semibold">Analizează.</span>
              <span className="text-xs text-[#FFC857] font-semibold">Livrează.</span>
            </div>
          </div>

          {/* Links */}
          {Object.entries(links).map(([section, items]) => (
            <div key={section}>
              <p className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-widest mb-4">
                {section}
              </p>
              <ul className="flex flex-col gap-2.5">
                {items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-sm text-[#6B6B6B] hover:text-white transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-[#333333] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#6B6B6B]">
            © 2026 LiberGent · Toate drepturile rezervate.
          </p>
          <div className="flex items-center gap-4">
            {/* Instagram */}
            <a href="#" className="text-[#6B6B6B] hover:text-white transition-colors" aria-label="Instagram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </a>
            {/* TikTok */}
            <a href="#" className="text-[#6B6B6B] hover:text-white transition-colors" aria-label="TikTok">
              <svg width="16" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.13 8.13 0 004.77 1.52V6.76a4.85 4.85 0 01-1-.07z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
