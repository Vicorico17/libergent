import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const pixel = localFont({
  src: "./fonts/pressstart2p/PressStart2P-Regular.ttf",
  weight: "400",
  variable: "--font-pixel-var",
  display: "swap",
});

const inter = localFont({
  src: "./fonts/inter/Inter[opsz,wght].ttf",
  weight: "100 900",
  variable: "--font-sans-var",
  display: "swap",
});

const caveat = localFont({
  src: "./fonts/caveat/Caveat[wght].ttf",
  weight: "400 700",
  variable: "--font-handwritten-var",
  display: "swap",
});

const spaceMono = localFont({
  src: [
    { path: "./fonts/spacemono/SpaceMono-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/spacemono/SpaceMono-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-mono-var",
  display: "swap",
});

const dotGothic = localFont({
  src: "./fonts/dotgothic16/DotGothic16-Regular.ttf",
  weight: "400",
  variable: "--font-dotgothic-var",
  preload: false,
  display: "swap",
});

const vt323 = localFont({
  src: "./fonts/vt323/VT323-Regular.ttf",
  weight: "400",
  variable: "--font-vt323-var",
  display: "swap",
});

const jetbrains = localFont({
  src: "./fonts/JetBrainsMono-variable.ttf",
  weight: "100 800",
  style: "normal",
  variable: "--font-jetbrains-var",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/geistmono/GeistMono[wght].ttf",
  weight: "100 900",
  variable: "--font-geist-mono",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://libergent.com";
const defaultGoogleAnalyticsId = "G-R8P7G7PWR7";

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
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID ||
    defaultGoogleAnalyticsId;

  return (
    <html lang="ro" className={`${pixel.variable} ${inter.variable} ${caveat.variable} ${spaceMono.variable} ${dotGothic.variable} ${vt323.variable} ${jetbrains.variable} ${geistMono.variable}`}>
      <body className="min-h-screen flex flex-col">
        <GoogleAnalytics measurementId={googleAnalyticsId} />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
