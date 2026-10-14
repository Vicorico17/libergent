"use client";

import { useRef, useState } from "react";
import styles from "./PricingCards.module.css";
import Link from "next/link";
import { LogoIcon } from "@/components/LogoIcon";
import { BillingPlanPicker } from "@/components/BillingAction";
import { AGENT_PRICE_RON, PREMIUM_ANNUAL_PRICE_RON, PREMIUM_TRIAL_DAYS, PREMIUM_WEEKLY_PRICE_RON } from "@/lib/pricing";

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

export function PricingCards({ checkout = false, fit = false }: { checkout?: boolean; fit?: boolean }) {
  const [activePlan, setActivePlan] = useState("premium");
  const [detailPlan, setDetailPlan] = useState(plans[1]);
  const dialogRef = useRef<HTMLDialogElement>(null);

  function openPlan(plan: typeof plans[number]) {
    setDetailPlan(plan);
    dialogRef.current?.showModal();
  }
  return (
    <div className={fit ? styles.fitted : undefined}>
      {fit && <div className={styles.tabs} role="group" aria-label="Alege planul">
        {plans.map((plan) => <button key={plan.id} type="button" aria-pressed={activePlan === plan.id} onClick={() => setActivePlan(plan.id)}>{plan.name}</button>)}
      </div>}
    <div className={`${fit ? styles.grid : ""} mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-3 lg:gap-8`}>
      {plans.map((plan) => (
        <article key={plan.id} data-active={activePlan === plan.id} className={`${fit ? styles.card : ""} relative flex min-w-0 flex-col border-2 border-[#111] p-6 text-[#111] sm:p-8 ${plan.id === "agent" ? "bg-[#FCE7F3] shadow-[6px_6px_0_#FF4B8B]" : "bg-[#F3F0E7] shadow-[6px_6px_0_#111]"}`}>
          <div className="mb-6 flex min-h-16 items-start justify-between gap-3">
            <p className="pt-2 text-[10px] font-bold uppercase tracking-widest text-[#111]/70">{plan.label}</p>
            {plan.id === "premium" && <span className={styles.trialBadge}>{PREMIUM_TRIAL_DAYS} zile gratis</span>}
            {plan.id === "agent" && <span className={styles.mascot}><LogoIcon size={64} /></span>}
          </div>
          <h3 className="mb-4 text-3xl font-bold tracking-tight">{plan.name}</h3>
          <div className="mb-2 flex flex-wrap items-baseline gap-2">
            <span className="text-5xl font-bold tracking-tight">{plan.price}</span>
            <span className="text-sm">RON {plan.period}</span>
          </div>
          <p className="mb-6 min-h-8 text-xs text-[#111]/65">
            {plan.id === "premium" ? <>
              <span className="block font-bold text-[#111]">sau {PREMIUM_ANNUAL_PRICE_RON} RON / an</span>
              <span className={styles.trialNote}>Primele {PREMIUM_TRIAL_DAYS} zile gratuite la primul abonament.</span>
            </> : plan.id === "agent" ? "Serviciu de negociere · în curând" : "Acces gratuit în beta"}
          </p>
          <p className="mb-6 min-h-24 text-sm leading-relaxed text-[#111]/75">{plan.description}</p>
          <ul className={`${fit ? styles.features : ""} mb-8 flex flex-1 flex-col gap-4 border-t border-dashed border-[#111]/40 pt-6 text-sm leading-relaxed`}>
            {plan.features.map((feature) => <li key={feature} className="flex items-start gap-3"><span aria-hidden="true" className="font-bold text-[#C51C59]">✓</span><span>{feature}</span></li>)}
          </ul>
          {fit ? <div className={styles.actions}>
            <button type="button" onClick={() => openPlan(plan)} className={styles.details}>Vezi toate beneficiile</button>
            {plan.id === "free" ? <Link href="/#cautare" className={styles.cta}>Caută gratuit →</Link>
              : plan.id === "premium" ? <button type="button" className={styles.cta} onClick={() => openPlan(plan)}>Alege Premium →</button>
              : <p className={styles.soon}>Disponibil în curând</p>}
          </div> : plan.id === "premium" && checkout ? <BillingPlanPicker /> : plan.id === "agent" ? (
            <p className="flex min-h-12 items-center justify-center border-2 border-[#111]/30 px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-[#111]/60">Disponibil în curând</p>
          ) : (
            <Link href={plan.id === "free" ? "/#cautare" : "/pricing"} className={`flex min-h-12 items-center justify-center border-2 border-[#111] px-4 py-3 text-center text-xs font-bold uppercase tracking-widest shadow-[4px_4px_0_#111] transition-transform hover:-translate-y-0.5 ${plan.id === "premium" ? "bg-[#FF4B8B]" : "bg-white"}`}>
              {plan.id === "free" ? "Caută gratuit →" : "Alege Premium →"}
            </Link>
          )}
        </article>
      ))}
    </div>
      {fit && <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="pricing-plan-title" onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}>
        <div className={styles.dialogHeader}>
          <h2 id="pricing-plan-title">{detailPlan.name}</h2>
          <button type="button" aria-label="Închide detaliile" onClick={() => dialogRef.current?.close()}>✕</button>
        </div>
        <p className="mb-3 text-2xl font-bold">{detailPlan.price} RON <span className="text-sm">{detailPlan.period}</span></p>
        <p className="mb-4 text-sm leading-relaxed">{detailPlan.description}</p>
        <ul className="mb-5 space-y-3 text-sm">{detailPlan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
        {detailPlan.id === "premium" ? <BillingPlanPicker /> : detailPlan.id === "free" ? <Link href="/#cautare" className={styles.cta}>Caută gratuit →</Link> : <p className={styles.soon}>Disponibil în curând</p>}
      </dialog>}
    </div>
  );
}
