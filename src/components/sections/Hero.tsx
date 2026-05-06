import { MascotSVG } from "../MascotSVG";
import { SearchBar } from "../SearchBar";

type PlusSign = {
  color: string;
  size: number;
  delay: string;
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
};

const plusSigns: PlusSign[] = [
  { color: "#4F7CFF", size: 24, top: "12%", left: "8%", delay: "0s" },
  { color: "#A259FF", size: 18, top: "20%", left: "18%", delay: "0.6s" },
  { color: "#FFC857", size: 28, top: "10%", right: "10%", delay: "1s" },
  { color: "#FF6B6B", size: 16, top: "35%", right: "6%", delay: "1.4s" },
  { color: "#4F7CFF", size: 20, bottom: "30%", right: "18%", delay: "0.3s" },
  { color: "#D9D9D9", size: 32, top: "8%", left: "55%", delay: "0.8s" },
  { color: "#A259FF", size: 14, bottom: "35%", left: "10%", delay: "1.2s" },
  { color: "#FFC857", size: 20, top: "55%", left: "24%", delay: "0.2s" },
];

const featureItems = [
  {
    label: "Căutare inteligentă",
    desc: "Scanăm zeci de platforme pentru tine.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="8" stroke="#4F7CFF" strokeWidth="2" />
        <path d="M21 21l-4-4" stroke="#4F7CFF" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Doar ce contează",
    desc: "Îți arătăm doar produsele relevante.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="3" width="16" height="18" rx="2" stroke="#A259FF" strokeWidth="2" />
        <path d="M8 8h8M8 12h8M8 16h5" stroke="#A259FF" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Economisești timp",
    desc: "Găsești mai rapid, plătești mai puțin.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          fill="#FF6B6B"
        />
      </svg>
    ),
  },
  {
    label: "Urmezi cele mai bune oferte",
    desc: "Oportunitățile bune nu mai scapă.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M3 17l4-8 4 4 4-6 4 4" stroke="#FFC857" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 20h18" stroke="#FFC857" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function Hero() {
  return (
    <section className="hero-gradient relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-16">
      {/* Scattered plus signs */}
      {plusSigns.map((p, i) => (
        <span
          key={i}
          className="plus-float absolute select-none font-pixel pointer-events-none hidden sm:block"
          style={{
            color: p.color,
            fontSize: p.size,
            top: p.top,
            left: p.left,
            right: p.right,
            bottom: p.bottom,
            animationDelay: p.delay,
            lineHeight: 1,
          }}
        >
          +
        </span>
      ))}

      {/* Main hero content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-2xl mx-auto">
        <MascotSVG size={120} className="mb-6 drop-shadow-sm" />

        <h1
          className="font-pixel text-[#111111] mb-5"
          style={{ fontSize: "clamp(32px, 7vw, 72px)", lineHeight: 1.1 }}
        >
          LiberGent
        </h1>

        <p className="text-[#6B6B6B] text-lg md:text-xl font-medium mb-4 leading-relaxed">
          Găsește rapid produse second-hand,
          <br />
          fără stres.
        </p>

        <div className="flex items-center gap-3 mb-8 text-base md:text-lg font-semibold">
          <span className="text-[#4F7CFF]">Observă.</span>
          <span className="text-[#A259FF]">Analizează.</span>
          <span className="text-[#FFC857]">Livrează.</span>
        </div>

        <SearchBar size="hero" className="w-full max-w-xl mb-4" />

        <div className="flex items-center gap-2 text-sm text-[#6B6B6B] font-medium">
          <span className="text-[#FF6B6B]">❤</span>
          <span>Începe aici. Găsim noi restul.</span>
        </div>
      </div>

      {/* Bottom feature bar */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-6 mt-16 mb-8">
        <div
          className="bg-white rounded-2xl px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-5"
          style={{ boxShadow: "0 2px 20px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)" }}
        >
          {featureItems.map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">{item.icon}</div>
              <div>
                <p className="text-sm font-semibold text-[#111111] leading-snug">{item.label}</p>
                <p className="text-xs text-[#6B6B6B] mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
