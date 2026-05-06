import type { Metadata } from "next";
import { Press_Start_2P, Inter, Caveat } from "next/font/google";
import "./globals.css";

const pixel = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel-var",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans-var",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-handwritten-var",
  display: "swap",
});

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
    <html lang="ro" className={`${pixel.variable} ${inter.variable} ${caveat.variable}`}>
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
