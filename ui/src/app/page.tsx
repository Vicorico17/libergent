import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/sections/Hero";
import { FeatureCards } from "@/components/sections/FeatureCards";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { FeaturesGrid } from "@/components/sections/FeaturesGrid";
import { Pricing } from "@/components/sections/Pricing";
import { FinalCTA } from "@/components/sections/FinalCTA";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://libergent.com";

export const metadata: Metadata = {
  title: "Caută anunțuri clasificate din România",
  description:
    "LiberGent este un motor de căutare pentru anunțuri clasificate din România. Caută pe OLX, Vinted, LaJumate, Okazii, Publi24 și Autovit, compară prețuri și contactează sellerii mai repede.",
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
      "LiberGent ajută cumpărătorii din România să găsească anunțuri clasificate relevante pe marketplace-uri precum OLX, Vinted, LaJumate, Okazii, Publi24 și Autovit.",
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
      "Motor de căutare pentru anunțuri clasificate care scanează mai multe marketplace-uri din România, normalizează anunțurile și compară prețurile pentru produse noi sau folosite.",
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
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
