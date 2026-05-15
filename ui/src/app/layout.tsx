import type { Metadata, Viewport } from "next";
import { Press_Start_2P, Inter, Caveat, Space_Mono, DotGothic16, VT323, JetBrains_Mono, Geist_Mono } from "next/font/google";
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

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-mono-var",
  display: "swap",
});

const dotGothic = DotGothic16({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dotgothic-var",
  display: "swap",
});

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-vt323-var",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-jetbrains-var",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LiberGent — Second-hand inteligent",
  description:
    "Găsește rapid produse second-hand, fără stres. LiberGent scanează zeci de platforme și îți livrează ce cauți.",
  icons: { icon: "/favicon.ico" },
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
    <html lang="ro" className={`${pixel.variable} ${inter.variable} ${caveat.variable} ${spaceMono.variable} ${dotGothic.variable} ${vt323.variable} ${jetbrains.variable} ${geistMono.variable}`}>
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
