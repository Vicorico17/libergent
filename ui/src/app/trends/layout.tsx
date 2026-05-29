import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trenduri produse în România",
  description:
    "Trenduri LiberGent pentru căutări de produse din România, cu top produse, keywords și activitate recentă.",
  alternates: {
    canonical: "/trenduri",
  },
};

export default function TrendsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
