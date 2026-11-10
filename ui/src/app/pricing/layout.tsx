import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LiberGent Premium | Agentul tău personal",
  description:
    "Caută cu Premium: 49 RON pe săptămână, cu 40 de credite incluse. Adaugă credite oricând sau cumpără un pachet fără abonament.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "Get your personal LIBERGENT AGENT",
    description:
      "Agentul tău personal caută, compară și urmărește ofertele. Contactul cu vânzătorii se face cu aprobarea ta.",
    url: "/pricing",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
