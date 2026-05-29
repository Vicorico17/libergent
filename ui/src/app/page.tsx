import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/sections/Hero";
import { FeatureCards } from "@/components/sections/FeatureCards";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { FeaturesGrid } from "@/components/sections/FeaturesGrid";
import { Pricing } from "@/components/sections/Pricing";
import { FAQ, FAQ_ITEMS } from "@/components/sections/FAQ";
import { FinalCTA } from "@/components/sections/FinalCTA";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://libergent.ro";

export const metadata: Metadata = {
  title: "Caută produse oriunde în România",
  description:
    "LiberGent este un motor de căutare pentru produse din România. Caută pe OLX, Vinted, LaJumate, Okazii, Publi24 și Autovit, compară prețuri și găsește oferte relevante mai repede.",
  alternates: {
    canonical: "/",
  },
};

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "LiberGent",
    url: siteUrl,
    description:
      "LiberGent ajută cumpărătorii din România să găsească produse relevante pe marketplace-uri precum OLX, Vinted, LaJumate, Okazii, Publi24 și Autovit.",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "LiberGent",
    applicationCategory: "ShoppingApplication",
    operatingSystem: "Web",
    url: siteUrl,
    areaServed: {
      "@type": "Country",
      name: "Romania",
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "RON",
    },
    description:
      "Motor de căutare care scanează mai multe marketplace-uri din România, normalizează anunțurile și compară prețurile pentru produse noi sau folosite.",
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  },
];

export default function Home() {
  return (
    <>
      <Navbar />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <main>
        <Hero />
        <FeatureCards />
        <HowItWorks />
        <FeaturesGrid />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
