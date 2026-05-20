/**
 * AYC Global Market - client auth helpers.
 * Tokens are stored in httpOnly cookies by API routes.
 * Client-side storage is limited to non-sensitive profile cache.
 */

export interface AYCUser {
  id: string;
  email: string;
  display_name: string;
  tier: "free" | "pro" | "elite";
  language: string;
  risk_level: string;
}

export interface AuthTokens {
  access_token?: string;
  refresh_token?: string;
}

const USER_KEY = "ayc_user";
const GUEST_KEY = "ayc_guest_demo";

export function saveAuth(_tokens: AuthTokens, user: AYCUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.removeItem(GUEST_KEY);
}

export function getAccessToken(): string | null {
  return null;
}

export function getRefreshToken(): string | null {
  return null;
}

export function getUser(): AYCUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AYCUser) : null;
  } catch {
    return null;
  }
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem("sb-access-token");
  localStorage.removeItem("ayc_token");
  localStorage.removeItem("ayc_access_token");
  localStorage.removeItem("ayc_refresh_token");
  localStorage.removeItem("ayc_credential_token");
  fetch("/api/v1/auth/logout", {
    method: "POST",
    credentials: "include",
    keepalive: true,
  }).catch(() => {});
}

export function isLoggedIn(): boolean {
  return !!getUser() && !isGuestDemo();
}

export function hasTier(required: "free" | "pro" | "elite"): boolean {
  const rank: Record<string, number> = { free: 0, pro: 1, elite: 2 };
  const user = getUser();
  return rank[user?.tier || "free"] >= rank[required];
}

export function startGuestDemo(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GUEST_KEY, "1");
  localStorage.removeItem(USER_KEY);
}

export function isGuestDemo(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(GUEST_KEY) === "1";
}

export function exitGuestDemo(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GUEST_KEY);
}

export function isAuthenticated(): boolean {
  return isLoggedIn() || isGuestDemo();
}
