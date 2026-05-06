import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PricingTier {
  name: string;
  icon: React.ReactNode;
  price: string;
  currency?: string;
  period?: string;
  description: string;
  features: string[];
  popular?: boolean;
  cta?: string;
  href?: string;
  color: string;
}

export function CreativePricing({
  tag = "Planuri",
  title,
  description,
  tiers,
}: {
  tag?: string;
  title?: React.ReactNode;
  description?: string;
  tiers: PricingTier[];
}) {
  const colClass =
    tiers.length === 2
      ? "grid-cols-1 md:grid-cols-2 max-w-2xl"
      : "grid-cols-1 md:grid-cols-3 max-w-4xl";

  return (
    <div className="w-full mx-auto px-4">
      <div className="text-center space-y-6 mb-16">
        <div className="font-handwritten text-xl text-[#4F7CFF] rotate-[-1deg]">{tag}</div>
        <div className="relative inline-block">
          <h2 className="text-4xl md:text-5xl font-bold font-handwritten text-zinc-900 rotate-[-1deg]">
            {title}
          </h2>
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-44 h-3 bg-blue-500/20 rotate-[-1deg] rounded-full blur-sm" />
        </div>
        {description && (
          <p className="font-handwritten text-xl text-zinc-600 rotate-[-1deg]">{description}</p>
        )}
      </div>

      <div className={cn("grid gap-8 mx-auto", colClass)}>
        {tiers.map((tier, index) => (
          <div
            key={tier.name}
            className={cn(
              "relative group transition-all duration-300",
              index === 0 && "rotate-[-1deg]",
              index === 1 && tiers.length === 3 && "rotate-[1deg]",
              index === 1 && tiers.length === 2 && "rotate-[1deg]",
              index === 2 && "rotate-[-2deg]"
            )}
          >
            <div
              className={cn(
                "absolute inset-0 bg-white border-2 border-zinc-900 rounded-lg",
                "shadow-[4px_4px_0px_0px] shadow-zinc-900",
                "transition-all duration-300",
                "group-hover:shadow-[8px_8px_0px_0px]",
                "group-hover:translate-x-[-4px] group-hover:translate-y-[-4px]"
              )}
            />

            <div className="relative p-6">
              {tier.popular && (
                <div className="absolute -top-2 -right-2 bg-amber-400 text-zinc-900 font-handwritten px-3 py-1 rounded-full rotate-12 text-sm border-2 border-zinc-900">
                  Recomandat!
                </div>
              )}

              <div className="mb-6">
                <div className="w-12 h-12 rounded-full mb-4 flex items-center justify-center border-2 border-zinc-900">
                  {tier.icon}
                </div>
                <h3 className="font-handwritten text-2xl text-zinc-900">{tier.name}</h3>
                <p className="font-handwritten text-zinc-600">{tier.description}</p>
              </div>

              <div className="mb-6 font-handwritten">
                <span className="text-4xl font-bold text-zinc-900">{tier.price}</span>
                <span className="text-zinc-600">
                  {tier.currency ?? "RON"}
                  {tier.period ?? "/lună"}
                </span>
              </div>

              <div className="space-y-3 mb-6">
                {tier.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border-2 border-zinc-900 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3" />
                    </div>
                    <span className="font-handwritten text-lg text-zinc-900">{feature}</span>
                  </div>
                ))}
              </div>

              <Button
                asChild
                className={cn(
                  "w-full h-12 font-handwritten text-lg",
                  "border-2 border-zinc-900",
                  "shadow-[4px_4px_0px_0px] shadow-zinc-900",
                  "hover:shadow-[6px_6px_0px_0px]",
                  "hover:translate-x-[-2px] hover:translate-y-[-2px]",
                  "transition-all duration-300",
                  tier.popular
                    ? "bg-amber-400 text-zinc-900 hover:bg-amber-300"
                    : "bg-zinc-50 text-zinc-900 hover:bg-white"
                )}
              >
                <a href={tier.href ?? "/auth"}>{tier.cta ?? "Începe acum"}</a>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
