import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SellListing } from "@/components/SellListing";

export const metadata: Metadata = {
  title: "Vinde pe mai multe marketplace-uri",
  description: "Pregătește produsul o singură dată și refolosește anunțul pe marketplace-urile tale preferate.",
  alternates: { canonical: "/vinde" },
};

export default function SellPage() {
  return <><Navbar /><main className="flex-1 bg-[#F3F0E7] px-4 pb-20 pt-32 text-[#101010] sm:px-8"><SellListing /></main><Footer /></>;
}
