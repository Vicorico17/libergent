import type { Metadata, Viewport } from "next";
import { Press_Start_2P, Inter, Caveat, Space_Mono, DotGothic16, VT323, JetBrains_Mono, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
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
    default: "LiberGent | Caută produse oriunde în România",
    template: "%s | LiberGent",
  },
  description:
    "LiberGent caută produse noi sau folosite în România pe OLX, Vinted, LaJumate, Okazii, Publi24 și Autovit, compară prețuri și îți arată ofertele relevante într-un singur loc.",
  keywords: [
    "LiberGent",
    "produse noi sau folosite",
    "cautare OLX",
    "cautare Vinted",
    "comparare preturi produse",
    "anunturi Romania",
    "marketplace Romania",
    "oferte produse",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ro_RO",
    url: "/",
    siteName: "LiberGent",
    title: "LiberGent | Caută produse pe mai multe marketplace-uri",
    description:
      "Caută o singură dată și verifică rapid oferte pentru produse noi sau folosite din România pe OLX, Vinted, LaJumate, Okazii, Publi24 și Autovit.",
    images: [
      {
        url: "/og-logo.png",
        width: 1200,
        height: 630,
        alt: "LiberGent logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LiberGent | Căutare multi-platformă în România",
    description:
      "Găsește și compară oferte pentru produse noi sau folosite din România într-un singur loc.",
    images: ["/og-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png", sizes: "256x256" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
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
  const googleAnalyticsId =
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;

  return (
    <html lang="ro" className={`${pixel.variable} ${inter.variable} ${caveat.variable} ${spaceMono.variable} ${dotGothic.variable} ${vt323.variable} ${jetbrains.variable} ${geistMono.variable}`}>
      <body className="min-h-screen flex flex-col">
        <GoogleAnalytics measurementId={googleAnalyticsId} />
        {children}
      </body>
    </html>
  );
}
