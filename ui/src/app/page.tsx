import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/sections/Hero";
import { FeatureCards } from "@/components/sections/FeatureCards";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { FeaturesGrid } from "@/components/sections/FeaturesGrid";
import { Pricing } from "@/components/sections/Pricing";
import { FinalCTA } from "@/components/sections/FinalCTA";

export default function Home() {
  return (
    <>
      <Navbar />
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
