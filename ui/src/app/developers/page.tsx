import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DeveloperPortal } from "@/components/DeveloperPortal";

export const metadata: Metadata = {
  title: "Developer API",
  description: "Add marketplace product search to your app. Try a demo, create test and live API keys, and start with a copy-and-paste request.",
  alternates: { canonical: "/developers/" },
};
export default function DevelopersPage() {
  return <><Navbar /><DeveloperPortal /><Footer /></>;
}
