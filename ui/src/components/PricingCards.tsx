import Link from "next/link";
import { BillingPlanPicker } from "@/components/BillingAction";
import { AGENT_PRICE_RON, PREMIUM_ANNUAL_PRICE_RON, PREMIUM_WEEKLY_PRICE_RON } from "@/lib/pricing";

const plans = [
  {
    id: "free", name: "Free", label: "Începe gratuit", price: 0, period: "",
    description: "Caută singur și compară rapid ofertele de pe platformele active.",
    features: ["Căutare pe mai multe marketplace-uri", "Rezultate normalizate și comparabile", "Filtre și sortare rapidă", "Scor agent și recomandări de bază"],
  },
  {
    id: "premium", name: "Premium", label: "Pachet de căutări", price: PREMIUM_WEEKLY_PRICE_RON, period: "/ săptămână",
    description: "Mai multe surse, comparații extinse și alerte pentru produsele pe care le cauți.",
    features: ["Tot ce include Free", "Căutări în magazine și marketplace-uri verificate", "Comparație între produse noi și second-hand", "Monitorizare de preț și alerte de oferte", "Recomandări în funcție de bugetul tău"],
  },
  {
    id: "agent", name: "Libergent Agent", label: "Negociază pentru tine", price: AGENT_PRICE_RON, period: "",
    description: "Spune-ne ce cauți și bugetul tău. Agentul găsește oferta și se ocupă de negociere pentru tine.",
    features: ["Căutare și selecție de oferte pentru cererea ta", "Contactează vânzătorii pentru tine", "Verifică detaliile și disponibilitatea", "Negociază prețul în bugetul stabilit", "Pregătește încheierea tranzacției, cu acordul tău"],
  },
];

export function PricingCards({ checkout = false }: { checkout?: boolean }) {
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-3 lg:gap-8">
      {plans.map((plan) => (
        <article key={plan.id} className={`flex min-w-0 flex-col border-2 border-[#111] p-6 text-[#111] sm:p-8 ${plan.id === "agent" ? "bg-[#FCE7F3] shadow-[6px_6px_0_#FF4B8B]" : "bg-[#F3F0E7] shadow-[6px_6px_0_#111]"}`}>
          <p className="mb-6 text-[10px] font-bold uppercase tracking-widest text-[#111]/70">{plan.label}</p>
          <h3 className="mb-4 text-3xl font-bold tracking-tight">{plan.name}</h3>
          <div className="mb-2 flex flex-wrap items-baseline gap-2">
            <span className="text-5xl font-bold tracking-tight">{plan.price}</span>
            <span className="text-sm">RON {plan.period}</span>
          </div>
          <p className="mb-6 min-h-8 text-xs text-[#111]/65">
            {plan.id === "premium" ? `sau ${PREMIUM_ANNUAL_PRICE_RON} RON / an` : plan.id === "agent" ? "Serviciu de negociere · în curând" : "Acces gratuit în beta"}
          </p>
          <p className="mb-6 min-h-24 text-sm leading-relaxed text-[#111]/75">{plan.description}</p>
          <ul className="mb-8 flex flex-1 flex-col gap-4 border-t border-dashed border-[#111]/40 pt-6 text-sm leading-relaxed">
            {plan.features.map((feature) => <li key={feature} className="flex items-start gap-3"><span aria-hidden="true" className="font-bold text-[#C51C59]">✓</span><span>{feature}</span></li>)}
          </ul>
          {plan.id === "premium" && checkout ? <BillingPlanPicker /> : plan.id === "agent" ? (
            <p className="flex min-h-12 items-center justify-center border-2 border-[#111]/30 px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-[#111]/60">Disponibil în curând</p>
          ) : (
            <Link href={plan.id === "free" ? "/#cautare" : "/pricing"} className={`flex min-h-12 items-center justify-center border-2 border-[#111] px-4 py-3 text-center text-xs font-bold uppercase tracking-widest shadow-[4px_4px_0_#111] transition-transform hover:-translate-y-0.5 ${plan.id === "premium" ? "bg-[#FF4B8B]" : "bg-white"}`}>
              {plan.id === "free" ? "Caută gratuit →" : "Alege Premium →"}
            </Link>
          )}
        </article>
      ))}
    </div>
  );
}
