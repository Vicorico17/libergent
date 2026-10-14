import { PricingCards } from "@/components/PricingCards";

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-24 bg-[#F3F0E7] px-6 py-16 lg:py-24" style={{ fontFamily: "var(--font-mono-var), monospace" }}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center text-[#111]">
          <h2 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">Tu alegi cât delegi.</h2>
          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-[#111]/70">Caută gratuit, deblochează pachetul de căutări Premium sau lasă agentul LiberGent să negocieze oferta pentru tine.</p>
        </div>
        <PricingCards />
      </div>
    </section>
  );
}
