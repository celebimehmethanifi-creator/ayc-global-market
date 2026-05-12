import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CANONICAL_DOMAIN = "aycmarket.com";
const APP_ALIAS_DOMAIN = "app.aycmarket.com";
const WWW_DOMAIN = "www.aycmarket.com";
const BLOG_DOMAIN = "blog.aycmarket.com";
const APP_ALIAS_REDIRECT =
  process.env.APP_ALIAS_REDIRECT === "1" ||
  process.env.APP_ALIAS_REDIRECT === "true";
const WP_ORIGIN = "http://176.62.166.130";

const BAD_BOTS = [
  "scrapy", "python-requests", "go-http-client", "wget",
  "libwww", "jakarta", "okhttp", "masscan", "zgrab", "nuclei",
  "sqlmap", "nikto", "nmap", "dirbuster", "gobuster", "wfuzz",
];

function isBadBot(ua: string): boolean {
  const lower = ua.toLowerCase();
  return BAD_BOTS.some((b) => lower.includes(b));
}

function normalizeHost(hostHeader: string): string {
  return hostHeader.split(":")[0].toLowerCase().trim();
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Permitted-Cross-Domain-Policies": "none",
};

export function middleware(req: NextRequest) {
  const host = normalizeHost(req.headers.get("host") || "");
  const pathname = req.nextUrl.pathname;
  const ua = req.headers.get("user-agent") || "";

  if (isBadBot(ua)) {
    return new NextResponse(null, { status: 403 });
  }

  if (pathname.startsWith("/api/") && !ua) {
    return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  let response: NextResponse;

  // Canonicalization: www -> apex
  if (host === WWW_DOMAIN) {
    const url = req.nextUrl.clone();
    url.protocol = "https";
    url.host = CANONICAL_DOMAIN;
    response = NextResponse.redirect(url, { status: 308 });
  } else if (host === APP_ALIAS_DOMAIN && APP_ALIAS_REDIRECT) {
    // Optional mode: app subdomain can redirect to canonical apex.
    const url = req.nextUrl.clone();
    url.protocol = "https";
    url.host = CANONICAL_DOMAIN;
    response = NextResponse.redirect(url, { status: 308 });
  } else if (host === BLOG_DOMAIN) {
    // Blog traffic is isolated to WordPress and does not affect app routes.
    const wpUrl = new URL(pathname + req.nextUrl.search, WP_ORIGIN);
    response = NextResponse.rewrite(wpUrl, {
      headers: { "Host": BLOG_DOMAIN, "X-Forwarded-Proto": "https" },
    });
  } else {
    // Canonical apex and app alias (alias mode) serve the live app and /api/v1.
    response = NextResponse.next();
  }

  Object.entries(SECURITY_HEADERS).forEach(([k, v]) => {
    response.headers.set(k, v);
  });

  const reqId =
    req.headers.get("x-request-id") || Math.random().toString(36).slice(2, 18);
  response.headers.set("X-Request-Id", reqId);
  response.headers.delete("X-Powered-By");
  response.headers.delete("Server");

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|ayc-logo\\.png|manifest\\.json).*)",
  ],
};
