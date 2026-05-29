import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trenduri produse în România",
  description:
    "Vezi ce produse caută oamenii pe LiberGent: top căutări, keywords, volum zilnic și marketplace-uri active din România.",
  alternates: {
    canonical: "/trenduri",
  },
  openGraph: {
    title: "Trenduri produse în România",
    description:
      "Top căutări și activitate recentă din istoricul LiberGent pentru produse noi sau folosite.",
    url: "/trenduri",
  },
};

export default function TrenduriLayout({ children }: { children: React.ReactNode }) {
  return children;
}
