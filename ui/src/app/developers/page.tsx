import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DeveloperPortal } from "@/components/DeveloperPortal";

export const metadata: Metadata = {
  title: "Developer API",
  description: "Developer API status and available Libergent integrations.",
  alternates: { canonical: "/developers/" },
};
export default function DevelopersPage() {
  return <><Navbar /><DeveloperPortal /><Footer /></>;
}
