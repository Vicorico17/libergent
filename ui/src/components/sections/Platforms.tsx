const platforms = [
  { name: "OLX", color: "#0047AB" },
  { name: "Vinted", color: "#09B1BA" },
  { name: "LaJumate", color: "#F97316" },
  { name: "Okazii", color: "#2563EB" },
  { name: "Publi24", color: "#E84C0C" },
  { name: "Anunțul", color: "#D97706" },
  { name: "Autovit\nauto", color: "#111111" },
];

export function Platforms() {
  return (
    <section className="bg-white py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-pixel text-[#6B6B6B] mb-4 tracking-widest uppercase">
            Platforme
          </p>
          <h2
            className="font-pixel text-[#111111] mb-4"
            style={{ fontSize: "clamp(16px, 3vw, 32px)", lineHeight: 1.2 }}
          >
            Căutăm pe sursele active.
          </h2>
          <p className="text-[#6B6B6B] text-base max-w-md mx-auto">
            Verificăm marketplace-urile conectate acum și adăugăm surse noi doar când returnează rezultate fiabile.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          {platforms.map((p) => (
            <div
              key={p.name}
              className="flex items-center justify-center rounded-xl px-6 py-3 bg-[#F8F9FA] border border-[#D9D9D9] hover:border-[#6B6B6B] transition-colors min-w-[120px]"
            >
              <span
                className="font-bold text-sm text-center"
                style={{ color: p.color, whiteSpace: "pre-line" }}
              >
                {p.name}
              </span>
            </div>
          ))}

          <div className="flex items-center justify-center rounded-xl px-6 py-3 bg-[#F8F9FA] border border-dashed border-[#D9D9D9] min-w-[120px]">
            <span className="text-sm text-[#6B6B6B] font-medium">+ surse verificate în curând</span>
          </div>
        </div>
      </div>
    </section>
  );
}
