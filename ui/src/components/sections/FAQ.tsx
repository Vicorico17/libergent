"use client";

import { useState } from "react";

const faqs = [
  {
    q: "Cum funcționează LiberGent?",
    a: "LiberGent caută simultan pe marketplace-uri active din România și îți returnează rezultate într-un format unificat. Nu mai verifici fiecare platformă separat.",
  },
  {
    q: "Este gratuit?",
    a: "Da. Accesul actual este beta și este gratuit. Nu există încă planuri comerciale active în produs.",
  },
  {
    q: "Pe ce platforme căutați?",
    a: "Momentan căutăm pe OLX, Vinted, LaJumate, Okazii și Publi24. Pentru căutări auto includem și Autovit. Extindem acoperirea gradual.",
  },
  {
    q: "Cât de des sunt actualizate rezultatele?",
    a: "Rezultatele sunt generate la fiecare căutare pe baza surselor active din acel moment.",
  },
  {
    q: "Pot seta alerte pentru un produs?",
    a: "Nu încă. Alertele sunt planificate, dar nu sunt disponibile în versiunea actuală.",
  },
  {
    q: "Datele mele sunt în siguranță?",
    a: "Absolut. Nu stocăm date personale inutile și nu le vindem niciunui terț. Citește politica noastră de confidențialitate pentru detalii complete.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="intrebari" className="bg-white py-20 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-pixel text-[#6B6B6B] mb-4 tracking-widest uppercase">
            FAQ
          </p>
          <h2
            className="font-pixel text-[#111111]"
            style={{ fontSize: "clamp(16px, 3vw, 32px)", lineHeight: 1.2 }}
          >
            Întrebări frecvente.
          </h2>
        </div>

        <div className="flex flex-col gap-2">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="border border-[#D9D9D9] rounded-xl overflow-hidden"
            >
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left gap-4 hover:bg-[#F8F9FA] transition-colors"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
              >
                <span className="font-semibold text-[#111111] text-sm">{faq.q}</span>
                <span
                  className="shrink-0 w-6 h-6 rounded-full border border-[#D9D9D9] flex items-center justify-center transition-transform"
                  style={{ transform: open === i ? "rotate(45deg)" : "rotate(0deg)" }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 2v8M2 6h8" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
              </button>
              {open === i && (
                <div className="px-5 pb-4">
                  <p className="text-sm text-[#6B6B6B] leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
