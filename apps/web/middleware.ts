import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PRODUCTION_DOMAIN = "aycmarket.com";

// Known bad bots / scrapers to block
const BAD_BOTS = [
  "scrapy", "python-requests", "go-http-client", "wget", "curl/",
  "libwww", "jakarta", "okhttp", "masscan", "zgrab", "nuclei",
  "sqlmap", "nikto", "nmap", "dirbuster", "gobuster", "wfuzz",
];

function isBadBot(ua: string): boolean {
  const lower = ua.toLowerCase();
  return BAD_BOTS.some(b => lower.includes(b));
}

// Security headers added to every response
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options":    "nosniff",
  "X-Frame-Options":           "DENY",
  "X-XSS-Protection":          "1; mode=block",
  "Referrer-Policy":           "strict-origin-when-cross-origin",
  "X-Permitted-Cross-Domain-Policies": "none",
};

export function middleware(req: NextRequest) {
  const host     = req.headers.get("host") || "";
  const pathname = req.nextUrl.pathname;
  const ua       = req.headers.get("user-agent") || "";

  // ── Block known malicious bots ─────────────────────────────
  if (isBadBot(ua)) {
    return new NextResponse(null, { status: 403 });
  }

  // ── Block empty User-Agent on API routes ───────────────────
  if (pathname.startsWith("/api/") && !ua) {
    return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  let response: NextResponse;

  // ── Production domain: show coming-soon ───────────────────
  if (host === PRODUCTION_DOMAIN || host === `www.${PRODUCTION_DOMAIN}`) {
    if (pathname === "/coming-soon" || pathname.startsWith("/api/")) {
      response = NextResponse.next();
    } else {
      const url = req.nextUrl.clone();
      url.pathname = "/coming-soon";
      response = NextResponse.rewrite(url);
    }
  } else {
    response = NextResponse.next();
  }

  // ── Add security headers to every response ────────────────
  Object.entries(SECURITY_HEADERS).forEach(([k, v]) => {
    response.headers.set(k, v);
  });

  // ── Request tracing ID ────────────────────────────────────
  const reqId = req.headers.get("x-request-id") || Math.random().toString(36).slice(2, 18);
  response.headers.set("X-Request-Id", reqId);

  // ── Remove identifying headers ────────────────────────────
  response.headers.delete("X-Powered-By");
  response.headers.delete("Server");

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|ayc-logo\\.png|manifest\\.json).*)",
  ],
};
