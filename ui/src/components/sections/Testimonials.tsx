const examples = [
  {
    title: "Electronice",
    detail: "Cauți un model de telefon și compari rapid prețurile listate pe platforme diferite.",
    accent: "#4F7CFF",
  },
  {
    title: "Casă și grădină",
    detail: "Filtrezi rezultate după buget și vezi într-un singur flux ofertele cele mai relevante.",
    accent: "#A259FF",
  },
  {
    title: "Auto",
    detail: "Pentru căutări auto, rezultatele includ și sursa dedicată categoriei auto.",
    accent: "#FFC857",
  },
];

export function Testimonials() {
  return (
    <section className="bg-white py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-pixel text-[#FFC857] mb-4 tracking-widest uppercase">
            Exemple
          </p>
          <h2
            className="font-pixel text-[#111111]"
            style={{ fontSize: "clamp(16px, 3vw, 32px)", lineHeight: 1.2 }}
          >
            Cum folosești LiberGent.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {examples.map((e) => (
            <div
              key={e.title}
              className="bg-[#F8F9FA] rounded-2xl p-6 flex flex-col gap-4"
              style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.06)" }}
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: e.accent }} />
              <p className="text-[#111111] text-sm leading-relaxed flex-1">{e.detail}</p>
              <div className="pt-2 border-t border-[#D9D9D9]">
                <p className="text-sm font-semibold text-[#111111]">{e.title}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
