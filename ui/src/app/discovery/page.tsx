import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DiscoveryStatus } from "@/components/DiscoveryStatus";
import { ShopSubmission } from "@/components/ShopSubmission";

export const metadata: Metadata = {
  title: "Discovery status · Marketplace-uri și surse",
  description: "Explorează sursele Free și Premium LiberGent și rezultatele celor mai recente verificări publicate.",
  alternates: { canonical: "/discovery" },
};

export default function DiscoveryPage() {
  return <div className="min-h-screen bg-[#F3F0E7] text-[#111111]" style={{ fontFamily: "var(--font-mono-var), monospace" }}>
    <Navbar />
    <main className="mx-auto max-w-7xl px-4 pb-20 pt-36 sm:px-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a51d50]">LiberGent / Discovery status</p>
      <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">Toate sursele.<br />Status la vedere<span className="text-[#FF4B8B]">.</span></h1>
      <p className="mt-6 max-w-2xl text-sm leading-relaxed sm:text-base">Descoperă marketplace-urile, magazinele și agregatoarele din căutarea LiberGent. Vezi ce surse au returnat oferte, ce nu a funcționat și ce urmează să verificăm.</p>
      <ShopSubmission />
      <DiscoveryStatus />
    </main>
    <Footer />
  </div>;
}
