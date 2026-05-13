import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LiberGent — Second-hand inteligent",
  description:
    "Găsește rapid produse second-hand, fără stres. LiberGent scanează zeci de platforme și îți livrează ce cauți.",
  icons: { icon: "/favicon.ico" },
  openGraph: {
    title: "LiberGent — Second-hand inteligent",
    description:
      "Găsește rapid produse second-hand, fără stres. LiberGent scanează zeci de platforme și îți livrează ce cauți.",
    type: "website",
    locale: "ro_RO",
    siteName: "LiberGent",
    images: [
      {
        url: "/logo.svg",
        alt: "LiberGent logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LiberGent — Second-hand inteligent",
    description:
      "Găsește rapid produse second-hand, fără stres. LiberGent scanează zeci de platforme și îți livrează ce cauți.",
    images: ["/logo.svg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
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
