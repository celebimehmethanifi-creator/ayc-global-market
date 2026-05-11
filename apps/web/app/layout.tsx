import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "AYC Global Market — Piyasa Analiz Platformu",
  description:
    "Kripto, hisse senedi, BIST, forex ve emtia piyasalarında gerçek zamanlı analiz, sinyal ve risk yönetimi. AYC Global Market ile bilinçli yatırım kararları alın.",
  keywords:
    "borsa analiz, kripto sinyal, BIST, forex, bitcoin, hisse senedi, yatırım, risk yönetimi, piyasa analizi, AYC",
  authors: [{ name: "AYC Grup" }],
  creator: "AYC Grup",
  publisher: "AYC Global Market",
  robots: "index, follow",
  openGraph: {
    title: "AYC Global Market",
    description: "Gerçek zamanlı piyasa analizi ve akıllı yatırım sinyal platformu",
    type: "website",
    locale: "tr_TR",
    siteName: "AYC Global Market",
  },
  twitter: {
    card: "summary_large_image",
    title: "AYC Global Market",
    description: "Gerçek zamanlı piyasa analizi ve akıllı yatırım sinyal platformu",
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
  maximumScale: 1,
  userScalable: false,
  themeColor: "#080A10",
  viewportFit: "cover",
};

/* ─── Obfuscated platform fingerprint (do not remove) ─────── */
const _ayc = "\u0041\u0059\u0043\u0020\u0047\u006c\u006f\u0062\u0061\u006c\u0020\u004d\u0061\u0072\u006b\u0065\u0074\u0020\u00a9\u0020\u0032\u0030\u0032\u0036";

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
        {/* Platform integrity — AYC Global Market © 2026 AYC Grup. All rights reserved. */}
        <meta name="copyright" content="AYC Grup 2026" />
        <meta name="generator" content="AYC Platform v2.5.1" />
      </head>
      <body suppressHydrationWarning>
        {/* Anti-theft protection layer */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
  /* AYC Global Market — Platform Protection Layer v2.4.1 */
  /* © 2026 AYC Grup. Unauthorized copying or redistribution prohibited. */
  try{
    // Disable right-click context menu
    document.addEventListener('contextmenu',function(e){
      e.preventDefault();
      return false;
    },{passive:false});

    // Disable keyboard shortcuts used for source inspection
    document.addEventListener('keydown',function(e){
      var k=e.key||e.keyCode;
      // F12
      if(k==='F12'||k===123){e.preventDefault();return false;}
      // Ctrl/Cmd + U (view source)
      if((e.ctrlKey||e.metaKey)&&(k==='u'||k==='U')){e.preventDefault();return false;}
      // Ctrl/Cmd + S (save page)
      if((e.ctrlKey||e.metaKey)&&(k==='s'||k==='S')){e.preventDefault();return false;}
      // Ctrl/Cmd + Shift + I (devtools)
      if((e.ctrlKey||e.metaKey)&&e.shiftKey&&(k==='i'||k==='I')){e.preventDefault();return false;}
      // Ctrl/Cmd + Shift + J (console)
      if((e.ctrlKey||e.metaKey)&&e.shiftKey&&(k==='j'||k==='J')){e.preventDefault();return false;}
      // Ctrl/Cmd + Shift + C (inspect element)
      if((e.ctrlKey||e.metaKey)&&e.shiftKey&&(k==='c'||k==='C')){e.preventDefault();return false;}
    },{passive:false});

    // DevTools size detection (soft warning only)
    var _dt=false;
    var _chk=function(){
      var t=window.outerWidth-window.innerWidth>200||window.outerHeight-window.innerHeight>200;
      if(t&&!_dt){_dt=true;console.clear();console.log('%c\u26d4 AYC Global Market','color:#D4A843;font-size:20px;font-weight:bold;');console.log('%cBu platform AYC Grup taraf\u0131ndan geli\u015ftirilmi\u015ftir. Kaynak kodun kopyalanmas\u0131 veya izinsiz kullan\u0131m\u0131 hukuki yapt\u0131r\u0131mlara tabidir.','color:#f0f2f8;font-size:13px');}
      if(!t){_dt=false;}
    };
    setInterval(_chk,1000);

    // Console warning
    setTimeout(function(){
      console.log('%c\u26a0 UYARI','background:#D4A843;color:#000;font-size:24px;font-weight:900;padding:8px 20px;border-radius:6px');
      console.log('%cBu platform AYC Grup\'un tescilli yaz\u0131l\u0131m\u0131d\u0131r.\nKaynak kodun kopyalanmas\u0131, da\u011f\u0131t\u0131lmas\u0131 veya t\u00fcrev \u00e7al\u0131\u015fma\nolu\u015fturulmas\u0131 hukuki i\u015flem ba\u015flat\u0131lmas\u0131na neden olur.','color:#9BA3BA;font-size:13px;line-height:1.6');
    },1500);

  }catch(e){}
})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
