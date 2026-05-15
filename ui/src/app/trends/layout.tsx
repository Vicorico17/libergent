import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trenduri second-hand în România",
  description:
    "Trenduri LiberGent pentru căutări second-hand din România, cu top produse, keywords și activitate recentă.",
  alternates: {
    canonical: "/trenduri",
  },
};

export default function TrendsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
