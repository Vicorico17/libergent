import { Tag, Sparkles } from "lucide-react";
import { CreativePricing, PricingTier } from "@/components/ui/creative-pricing";

const plans: PricingTier[] = [
  {
    name: "Gratuit",
    icon: <Tag className="w-6 h-6" />,
    price: "0",
    currency: " RON",
    period: "/lună",
    description: "Perfect pentru a testa LiberGent.",
    color: "zinc",
    cta: "Începe gratuit",
    href: "/auth",
    features: [
      "5 căutări pe zi",
      "3 platforme",
      "Rezultate de bază",
    ],
  },
  {
    name: "PRO",
    icon: <Sparkles className="w-6 h-6" />,
    price: "29",
    currency: " RON",
    period: "/lună",
    description: "Pentru cine vrea tot ce e mai bun.",
    color: "blue",
    popular: true,
    cta: "Alege PRO",
    href: "/auth",
    features: [
      "Căutări nelimitate",
      "Toate platformele",
      "Alerte în timp real",
      "Filtre avansate",
      "Suport prioritar",
    ],
  },
];

export function Pricing() {
  return (
    <section className="bg-[#F8F9FA] py-24 px-6 overflow-hidden">
      <CreativePricing
        tag="Planuri"
        title={
          <>
            Simplu.{" "}
            <span className="relative">
              Transparent.
              <span className="absolute -bottom-1 left-0 w-full h-1 bg-[#4F7CFF]/30 rounded-full" />
            </span>
          </>
        }
        description="Fără comisioane ascunse. Plătești doar dacă vrei mai mult."
        tiers={plans}
      />
    </section>
  );
}
