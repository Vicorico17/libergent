import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prețuri",
  description:
    "LiberGent Beta este gratuit pentru căutări de produse pe mai multe platforme. Vezi ce include planul gratuit și ce funcții Premium urmează pentru monitorizare.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "Prețuri LiberGent",
    description:
      "Căutare de produse gratuită în beta, cu funcții Premium planificate pentru monitorizare.",
    url: "/pricing",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
