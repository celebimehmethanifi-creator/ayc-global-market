import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const SITE_URL = "https://aycmarket.com";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  title: "AYC Global Market - Piyasa Analiz Platformu",
  description:
    "Kripto, hisse, BIST, forex ve emtia piyasalarinda gercek zamanli analiz, sinyal ve risk yonetimi.",
  keywords:
    "borsa analiz, kripto sinyal, BIST, forex, bitcoin, hisse, yatirim, risk yonetimi, piyasa analizi, AYC",
  authors: [{ name: "AYC Grup" }],
  creator: "AYC Grup",
  publisher: "AYC Global Market",
  robots: "index, follow",
  openGraph: {
    title: "AYC Global Market",
    description: "Gerçek zamanlı piyasa analizi ve akıllı sinyal platformu",
    type: "website",
    locale: "tr_TR",
    siteName: "AYC Global Market",
  },
  twitter: {
    card: "summary_large_image",
    title: "AYC Global Market",
    description: "Gerçek zamanlı piyasa analizi ve akıllı sinyal platformu",
  },
  icons: { icon: "/favicon.ico", apple: "/ayc-logo.png" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AYC Market",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080A10",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning className={inter.variable}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="AYC Market" />
        <meta name="theme-color" content="#0C0E16" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="msapplication-tap-highlight" content="no" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/ayc-logo.png" />
        <meta name="copyright" content="AYC Grup 2026" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
