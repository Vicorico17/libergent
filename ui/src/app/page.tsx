import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/sections/Hero";
import { FeatureCards } from "@/components/sections/FeatureCards";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { FeaturesGrid } from "@/components/sections/FeaturesGrid";
import { Pricing } from "@/components/sections/Pricing";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { SellCTA } from "@/components/sections/SellCTA";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://libergent.com";

export const metadata: Metadata = {
  title: "Cumpără mai informat. Vinde mai simplu.",
  description:
    "Caută produse noi, second-hand și recondiționate, compară ofertele și înțelege riscurile. Pregătește anunțul o singură dată și refolosește-l pe mai multe platforme.",
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
      "LiberGent ajută cumpărătorii și vânzătorii din România să compare oferte, să ia decizii informate și să pregătească anunțuri pentru mai multe platforme.",
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
      "Asistent pentru cumpărare și vânzare în România: caută produse noi, second-hand și recondiționate, analizează ofertele și ajută utilizatorii să pregătească anunțuri reutilizabile pe mai multe platforme.",
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
        <SellCTA />
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
