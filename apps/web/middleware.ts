import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PRODUCTION_DOMAIN = "aycmarket.com";
const WP_ORIGIN = "http://176.62.166.130";

const BAD_BOTS = [
  "scrapy", "python-requests", "go-http-client", "wget", "curl/",
  "libwww", "jakarta", "okhttp", "masscan", "zgrab", "nuclei",
  "sqlmap", "nikto", "nmap", "dirbuster", "gobuster", "wfuzz",
];

function isBadBot(ua: string): boolean {
  const lower = ua.toLowerCase();
  return BAD_BOTS.some(b => lower.includes(b));
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Permitted-Cross-Domain-Policies": "none",
};

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const pathname = req.nextUrl.pathname;
  const ua = req.headers.get("user-agent") || "";

  if (isBadBot(ua)) {
    return new NextResponse(null, { status: 403 });
  }

  if (pathname.startsWith("/api/") && !ua) {
    return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { "Content-Type": "application/json" },
    });
  }

  let response: NextResponse;

  // WordPress admin proxy: aycmarket.com/wp-admin, /wp-login, /wp-content, /wp-includes, /wp-json
  if ((host === PRODUCTION_DOMAIN || host === `www.${PRODUCTION_DOMAIN}`) &&
      (pathname.startsWith("/wp-admin") || pathname.startsWith("/wp-login") ||
       pathname.startsWith("/wp-content") || pathname.startsWith("/wp-includes") ||
       pathname.startsWith("/wp-json") || pathname.startsWith("/wp-cron"))) {
    const wpUrl = new URL(pathname + req.nextUrl.search, WP_ORIGIN);
    return NextResponse.rewrite(wpUrl, {
      headers: { "Host": "aycmarket.com", "X-Forwarded-Proto": "https" },
    });
  }

  // aycmarket.com/www.aycmarket.com -> coming-soon (wp-admin haric)
  if (host === PRODUCTION_DOMAIN || host === `www.${PRODUCTION_DOMAIN}`) {
    if (!pathname.startsWith("/api/")) {
      const url = req.nextUrl.clone();
      url.pathname = "/coming-soon";
      response = NextResponse.rewrite(url);
    } else {
      response = NextResponse.next();
    }
  } else {
    response = NextResponse.next();
  }

  Object.entries(SECURITY_HEADERS).forEach(([k, v]) => {
    response.headers.set(k, v);
  });

  const reqId = req.headers.get("x-request-id") || Math.random().toString(36).slice(2, 18);
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

