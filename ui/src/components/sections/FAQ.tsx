export const FAQ_ITEMS = [
  {
    q: "Cum funcționează LiberGent?",
    a: "LiberGent caută produsul tău pe mai multe marketplace-uri din România, normalizează anunțurile și îți arată rezultate comparabile într-un singur flux. Nu trebuie să verifici manual fiecare platformă.",
  },
  {
    q: "Pe ce marketplace-uri caută LiberGent?",
    a: "Căutarea activă acoperă OLX, Vinted, LaJumate, Okazii și Publi24. Pentru căutări auto, LiberGent include și Autovit, astfel încât anunțurile auto să fie comparate cu sursele potrivite.",
  },
  {
    q: "Ce pot căuta cu LiberGent?",
    a: "Poți căuta telefoane, laptopuri, electronice, mobilă, electrocasnice, haine, accesorii și mașini. Exemple utile sunt iPhone 15, MacBook Air, canapea extensibilă, frigider Samsung sau BMW seria 1.",
  },
  {
    q: "LiberGent compară prețurile?",
    a: "Da. Rezultatele sunt normalizate pentru a putea compara rapid prețurile, starea produsului, locația și sursa anunțului. Agentul evidențiază ofertele care par relevante pentru căutarea ta.",
  },
  {
    q: "Este gratuit?",
    a: "Da. Beta actuală este gratuită și permite căutări multi-platformă fără card. Funcțiile Premium vor fi lansate separat.",
  },
  {
    q: "În ce orașe din România funcționează?",
    a: "LiberGent caută anunțuri disponibile în toată România, inclusiv București, Cluj-Napoca, Iași, Timișoara, Brașov, Constanța, Craiova și alte orașe afișate de marketplace-uri.",
  },
];

export function FAQ() {
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
          <p className="mt-4 text-sm text-[#6B6B6B] leading-relaxed">
            Răspunsuri scurte despre căutarea de produse pe mai multe platforme,
            compararea prețurilor și marketplace-urile acoperite în România.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {FAQ_ITEMS.map((faq) => (
            <details
              key={faq.q}
              className="group border border-[#D9D9D9] rounded-lg overflow-hidden"
            >
              <summary className="w-full flex items-center justify-between px-5 py-4 text-left gap-4 hover:bg-[#F8F9FA] transition-colors cursor-pointer list-none">
                <span className="font-semibold text-[#111111] text-sm">{faq.q}</span>
                <span
                  className="shrink-0 w-6 h-6 rounded-full border border-[#D9D9D9] flex items-center justify-center transition-transform group-open:rotate-45"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 2v8M2 6h8" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
              </summary>
              <div className="px-5 pb-4">
                <p className="text-sm text-[#6B6B6B] leading-relaxed">{faq.a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
