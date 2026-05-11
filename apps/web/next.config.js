/** @type {import('next').NextConfig} */

// AYC Global Market — Platform Config
// © 2026 AYC Grup. Tüm hakları saklıdır.

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://s.tradingview.com https://www.tradingview.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com data:;
  img-src 'self' data: blob: https:;
  media-src 'none';
  connect-src 'self' wss: ws: https:;
  frame-src 'self' https://s.tradingview.com https://www.tradingview.com https://charting-library.tradingview.com https://widget.tradingview.com;
  frame-ancestors 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
`.replace(/\s{2,}/g, " ").trim();

const securityHeaders = [
  { key: "Content-Security-Policy",           value: ContentSecurityPolicy },
  { key: "Strict-Transport-Security",         value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options",                   value: "DENY" },
  { key: "X-Content-Type-Options",            value: "nosniff" },
  { key: "X-XSS-Protection",                  value: "1; mode=block" },
  { key: "Referrer-Policy",                   value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",                value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control",            value: "on" },
  { key: "X-Download-Options",                value: "noopen" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Cross-Origin-Opener-Policy",        value: "same-origin-allow-popups" },
  // COEP require-corp is intentionally omitted — it blocks TradingView and all external embeds
];

const nextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  compress: true,
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/(ayc-logo\\.png|manifest\\.json|favicon\\.ico)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, immutable" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
      {
        source: "/api/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "Pragma",        value: "no-cache" },
        ],
      },
    ];
  },

  env: {
    NEXT_PUBLIC_API_URL:           process.env.NEXT_PUBLIC_API_URL || "",
    NEXT_PUBLIC_SUPABASE_URL:      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    NEXT_PUBLIC_APP_VERSION:       "2.5.0",
    NEXT_PUBLIC_BUILD_DATE:        new Date().toISOString().split("T")[0],
  },

  webpack(config, { dev, isServer }) {
    if (!dev && !isServer) {
      config.optimization.minimize = true;
    }
    return config;
  },
};

module.exports = nextConfig;
