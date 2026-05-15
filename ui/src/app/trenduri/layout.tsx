import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trenduri second-hand în România",
  description:
    "Vezi ce produse second-hand caută oamenii pe LiberGent: top căutări, keywords, volum zilnic și marketplace-uri active din România.",
  alternates: {
    canonical: "/trenduri",
  },
  openGraph: {
    title: "Trenduri second-hand în România",
    description:
      "Top căutări și activitate recentă din istoricul LiberGent pentru produse second-hand.",
    url: "/trenduri",
  },
};

export default function TrenduriLayout({ children }: { children: React.ReactNode }) {
  return children;
}
