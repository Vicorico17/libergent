import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LiberGent — Second-hand inteligent",
  description:
    "Găsește rapid produse second-hand, fără stres. LiberGent scanează zeci de platforme și îți livrează ce cauți.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro">
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
