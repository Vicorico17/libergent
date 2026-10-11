import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LiberGent Premium | Agentul tău personal",
  description:
    "Cunoaște agentul tău personal LiberGent. Începe cu 3 zile gratuite la primul abonament, apoi alege plata săptămânală sau anuală. Apelurile sunt disponibile în pilot, cu aprobarea ta.",
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
