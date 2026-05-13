import { Sparkles } from "lucide-react";
import { CreativePricing, PricingTier } from "@/components/ui/creative-pricing";

const plans: PricingTier[] = [
  {
    name: "Beta",
    icon: <Sparkles className="w-6 h-6" />,
    price: "0",
    currency: " RON",
    period: "",
    description: "Acces gratuit la experiența curentă de căutare multi-platformă.",
    color: "blue",
    popular: true,
    cta: "Intră în beta",
    href: "/auth",
    features: [
      "Căutare unificată pe platforme active",
      "Rezultate normalizate și comparabile",
      "Istoric de căutări și trenduri",
      "Extindere graduală a acoperirii",
    ],
  },
];

export function Pricing() {
  return (
    <section id="planuri" className="bg-[#F8F9FA] py-24 px-6 overflow-hidden">
      <CreativePricing
        tag="Acces"
        title={
          <>
            Lansare beta.{" "}
            <span className="relative">
              Fără cost.
              <span className="absolute -bottom-1 left-0 w-full h-1 bg-[#4F7CFF]/30 rounded-full" />
            </span>
          </>
        }
        description="Nu există încă planuri comerciale active. Când apar opțiuni noi, le publicăm transparent aici."
        tiers={plans}
      />
    </section>
  );
}
