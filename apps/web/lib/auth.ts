/**
 * AYC Global Market — Auth utilities
 * JWT token management, user session, credential token for stateless auth
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
  access_token: string;
  refresh_token: string;
  credential_token?: string;
}

const ACCESS_KEY     = "ayc_access_token";
const REFRESH_KEY    = "ayc_refresh_token";
const CREDENTIAL_KEY = "ayc_credential_token";
const USER_KEY       = "ayc_user";

export function saveAuth(tokens: AuthTokens, user: AYCUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_KEY,  tokens.access_token);
  localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
  if (tokens.credential_token) {
    localStorage.setItem(CREDENTIAL_KEY, tokens.credential_token);
  }
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  // Legacy key for backward compat
  localStorage.setItem("ayc_token", tokens.access_token);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY) || localStorage.getItem("ayc_token");
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function getCredentialToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CREDENTIAL_KEY);
}

export function getUser(): AYCUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  [ACCESS_KEY, REFRESH_KEY, CREDENTIAL_KEY, USER_KEY, "ayc_token", "sb-access-token"].forEach(k =>
    localStorage.removeItem(k)
  );
}

export function isLoggedIn(): boolean {
  return !!getAccessToken();
}

export function hasTier(required: "free" | "pro" | "elite"): boolean {
  const RANK: Record<string, number> = { free: 0, pro: 1, elite: 2 };
  const user = getUser();
  return RANK[user?.tier || "free"] >= RANK[required];
}

/* ── Guest Demo (no login required) ─────────────────────── */
const GUEST_KEY = "ayc_guest_demo";

export function startGuestDemo(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GUEST_KEY, "1");
  // Clear any auth so we're in pure guest mode
  [ACCESS_KEY, REFRESH_KEY, CREDENTIAL_KEY, USER_KEY, "ayc_token"].forEach(k =>
    localStorage.removeItem(k)
  );
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
