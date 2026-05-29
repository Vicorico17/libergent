import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Caută produse",
  description:
    "Caută produse noi sau folosite pe OLX, Vinted, LaJumate, Okazii, Publi24 și Autovit. LiberGent compară anunțuri, prețuri și oferte din România într-un singur flux.",
  alternates: {
    canonical: "/search",
  },
  openGraph: {
    title: "Caută produse cu LiberGent",
    description:
      "Găsește rapid oferte pentru produse noi sau folosite din România pe mai multe marketplace-uri active.",
    url: "/search",
  },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
