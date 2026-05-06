import { MascotSVG, MascotNewspaper, MascotTallHat } from "../MascotSVG";

const steps = [
  {
    mascot: <MascotSVG size={80} />,
    accent: "#4F7CFF",
    accentClass: "pixel-border-blue",
    label: "Observă.",
    desc: "Scanăm zeci de platforme second-hand în timp real, în locul tău.",
    sub: "Găsește ce contează.",
  },
  {
    mascot: <MascotNewspaper size={80} />,
    accent: "#A259FF",
    accentClass: "pixel-border-purple",
    label: "Analizează.",
    desc: "Filtrăm zgomotul. Îți arătăm doar ce e relevant și la prețul corect.",
    sub: "Filtrăm zgomotul.",
  },
  {
    mascot: <MascotTallHat size={80} />,
    accent: "#FFC857",
    accentClass: "pixel-border-yellow",
    label: "Livrează.",
    desc: "Primești rezultatele rapid, fără să pierzi timp pe listinguri inutile.",
    sub: "Primești ce ai nevoie.",
  },
];

export function HowItWorks() {
  return (
    <section id="cum-functioneaza" className="bg-[#F8F9FA] py-20 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-14">
          <p className="text-xs font-pixel text-[#4F7CFF] mb-4 tracking-widest uppercase">
            Cum funcționează
          </p>
          <h2
            className="font-pixel text-[#111111]"
            style={{ fontSize: "clamp(18px, 3.5vw, 36px)", lineHeight: 1.2 }}
          >
            Trei pași.
            <br />
            Zero bătăi de cap.
          </h2>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step) => (
            <div
              key={step.label}
              className={`bg-white rounded-2xl p-8 flex flex-col items-start gap-5 ${step.accentClass}`}
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)" }}
            >
              <div className="mb-2">{step.mascot}</div>
              <div>
                <p
                  className="font-semibold text-xl mb-2"
                  style={{ color: step.accent }}
                >
                  {step.label}
                </p>
                <p className="text-[#111111] font-medium text-base leading-relaxed">{step.desc}</p>
                <p className="text-[#6B6B6B] text-sm mt-2">{step.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
