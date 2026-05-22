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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://libergent.ro";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "LiberGent | Căutare second-hand în România",
    template: "%s | LiberGent",
  },
  description:
    "LiberGent caută produse second-hand în România pe OLX, Vinted, LaJumate, Okazii, Publi24 și Autovit, compară prețuri și îți arată ofertele relevante într-un singur loc.",
  keywords: [
    "LiberGent",
    "produse second-hand",
    "cautare OLX",
    "cautare Vinted",
    "comparare preturi second-hand",
    "anunturi second-hand Romania",
    "marketplace Romania",
    "oferte second-hand",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ro_RO",
    url: "/",
    siteName: "LiberGent",
    title: "LiberGent | Caută produse second-hand pe mai multe marketplace-uri",
    description:
      "Caută o singură dată și verifică rapid oferte second-hand din România pe OLX, Vinted, LaJumate, Okazii, Publi24 și Autovit.",
  },
  twitter: {
    card: "summary_large_image",
    title: "LiberGent | Căutare second-hand multi-platformă",
    description:
      "Găsește și compară oferte second-hand din România într-un singur loc.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
