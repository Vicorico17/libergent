const features = [
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="14" cy="14" r="10" stroke="#4F7CFF" strokeWidth="2.5" />
        <path d="M28 28l-6-6" stroke="#4F7CFF" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M10 14h8M14 10v8" stroke="#4F7CFF" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: "Căutare inteligentă",
    desc: "Scanăm simultan zeci de platforme second-hand și îți prezentăm cele mai bune rezultate, sortate după relevanță.",
    accent: "#4F7CFF",
    bg: "bg-[#EEF3FF]",
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="4" y="3" width="24" height="26" rx="3" stroke="#A259FF" strokeWidth="2.5" />
        <path d="M10 11h12M10 16h12M10 21h8" stroke="#A259FF" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: "Doar ce contează",
    desc: "Algoritmul nostru filtrează listingurile irelevante, duplicate și expirate. Îți arătăm doar ce merită atenția ta.",
    accent: "#A259FF",
    bg: "bg-[#F4EEFF]",
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M16 28.5l-2-1.8C7.2 20.4 3 16.8 3 12.2 3 8.1 6.1 5 10.2 5c2.2 0 4.4 1 5.8 2.6C17.4 6 19.6 5 21.8 5 25.9 5 29 8.1 29 12.2c0 4.6-4.2 8.2-11 14.5L16 28.5z" fill="#FF6B6B" />
      </svg>
    ),
    title: "Economisești timp",
    desc: "În loc de 3 ore de scrollat pe OLX, Vinted și Facebook, îți ia 30 de secunde. Caută o dată, găsești tot.",
    accent: "#FF6B6B",
    bg: "bg-[#FFF0F0]",
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M4 22l6-12 6 6 6-9 6 6" stroke="#FFC857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 26h24" stroke="#FFC857" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: "Urmezi cele mai bune oferte",
    desc: "Setezi alerte pentru produsele care te interesează și primești notificări imediat ce apare ceva nou.",
    accent: "#FFC857",
    bg: "bg-[#FFF9EE]",
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M16 3l2.5 8h8.5l-7 5 2.5 8-7-5-7 5 2.5-8-7-5h8.5L16 3z" stroke="#4F7CFF" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    ),
    title: "Alerte în timp real",
    desc: "Nu ratezi nicio ofertă. Trimitem notificări push sau email imediat ce apare un produs care corespunde criteriilor tale.",
    accent: "#4F7CFF",
    bg: "bg-[#EEF3FF]",
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="12" stroke="#A259FF" strokeWidth="2.5" />
        <path d="M10 16h12M16 10l6 6-6 6" stroke="#A259FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Multi-platformă",
    desc: "Un singur loc pentru tot second-hand-ul din România. OLX, Vinted, Facebook Marketplace și multe altele.",
    accent: "#A259FF",
    bg: "bg-[#F4EEFF]",
  },
];

export function FeaturesGrid() {
  return (
    <section className="bg-[#F8F9FA] py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-pixel text-[#A259FF] mb-4 tracking-widest uppercase">
            De ce LiberGent?
          </p>
          <h2
            className="font-pixel text-[#111111]"
            style={{ fontSize: "clamp(16px, 3vw, 32px)", lineHeight: 1.2 }}
          >
            Tot ce ai nevoie.
            <br />
            Într-un singur loc.
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-2xl p-6 flex flex-col gap-4 hover:shadow-md transition-shadow"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)" }}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${f.bg}`}>
                {f.icon}
              </div>
              <div>
                <h3 className="font-semibold text-[#111111] text-base mb-1.5">{f.title}</h3>
                <p className="text-sm text-[#6B6B6B] leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
