import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { NextResponse } from "next/server";

const MIN_SECRET_LENGTH = 32;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 24; // 24h
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30d
const REFRESH_SESSION_STORE = "memory";
const HAS_PERSISTENT_REFRESH_STORE = false;

export const ACCESS_COOKIE_NAME = "ayc_access";
export const REFRESH_COOKIE_NAME = "ayc_refresh";

function readJwtSecret(): string {
  const raw = process.env.JWT_SECRET?.trim() || "";
  if (!raw) {
    throw new Error("JWT_SECRET environment variable is required.");
  }
  if (raw.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters long.`,
    );
  }
  if (IS_PRODUCTION && /change[-_ ]?me|example|test|demo/i.test(raw)) {
    throw new Error("JWT_SECRET is not production-safe.");
  }
  return raw;
}

const SECRET = new TextEncoder().encode(readJwtSecret());

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  hashedPassword: string;
  plan: "free" | "pro" | "elite";
  createdAt: string;
}

export interface JWTPayload {
  sub: string;
  email: string;
  name: string;
  plan: string;
  type: "access" | "refresh";
  jti?: string;
  iat?: number;
  exp?: number;
}

interface RefreshSessionState {
  userId: string;
  exp: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __AYC_USERS_CACHE: Map<string, UserRecord> | undefined;
  // eslint-disable-next-line no-var
  var __AYC_REFRESH_SESSIONS: Map<string, RefreshSessionState> | undefined;
}

if (!globalThis.__AYC_USERS_CACHE) {
  globalThis.__AYC_USERS_CACHE = new Map<string, UserRecord>();
}
if (!globalThis.__AYC_REFRESH_SESSIONS) {
  globalThis.__AYC_REFRESH_SESSIONS = new Map<string, RefreshSessionState>();
}

export const USERS = globalThis.__AYC_USERS_CACHE;
const REFRESH_SESSIONS = globalThis.__AYC_REFRESH_SESSIONS;

if (IS_PRODUCTION && !HAS_PERSISTENT_REFRESH_STORE) {
  console.warn(
    "[auth] Refresh session store is in-memory. Session rotation state may be lost after cold start/redeploy.",
  );
}

export const USERS_BY_ID = {
  get: (id: string): UserRecord | undefined => {
    for (const u of Array.from(USERS.values())) {
      if (u.id === id) return u;
    }
    return undefined;
  },
  set: (_id: string, u: UserRecord) => {
    USERS.set(u.email, u);
  },
};

function sanitizeKey(email: string): string {
  return email
    .replace(/@/g, "_at_")
    .replace(/\./g, "_dot_")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function ecGet(key: string): Promise<UserRecord | null> {
  try {
    const edgeConfigId = process.env.AYC_EDGE_CONFIG_ID;
    const connStr = process.env.AYC_EDGE_CONFIG || "";
    const token = connStr.includes("token=") ? connStr.split("token=")[1] : "";
    if (!edgeConfigId || !token) return null;
    const safeKey = sanitizeKey(key);
    const r = await fetch(
      `https://edge-config.vercel.com/${edgeConfigId}/item/${safeKey}?token=${token}`,
      { cache: "no-store" },
    );
    if (!r.ok) return null;
    return (await r.json()) as UserRecord;
  } catch {
    return null;
  }
}

async function ecSet(key: string, value: UserRecord): Promise<void> {
  try {
    const edgeConfigId = process.env.AYC_EDGE_CONFIG_ID;
    const apiToken = process.env.AYC_VERCEL_API_TOKEN;
    const teamId = process.env.AYC_TEAM_ID;
    if (!edgeConfigId || !apiToken) return;
    const qs = teamId ? `?teamId=${teamId}` : "";
    await fetch(`https://api.vercel.com/v1/edge-config/${edgeConfigId}/items${qs}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ operation: "upsert", key: sanitizeKey(key), value }],
      }),
    });
  } catch {
    // no-op: in-memory cache is still updated
  }
}

export async function saveUser(user: UserRecord): Promise<void> {
  USERS.set(user.email, user);
  await ecSet(user.email, user);
}

export async function lookupUser(email: string): Promise<UserRecord | null> {
  const normalized = email.toLowerCase();
  const cached = USERS.get(normalized);
  if (cached) return cached;
  const fromEc = await ecGet(normalized);
  if (fromEc) {
    USERS.set(fromEc.email, fromEc);
    return fromEc;
  }
  return null;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function generateId(): string {
  return "u_" + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

export async function signAccess(user: UserRecord): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS;
  return new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    type: "access",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(SECRET);
}

export async function signRefresh(user: UserRecord): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL_SECONDS;
  const jti = crypto.randomUUID();
  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    type: "refresh",
    jti,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(SECRET);
  REFRESH_SESSIONS.set(jti, { userId: user.id, exp });
  return token;
}

export function revokeRefreshSession(jti?: string): void {
  if (!jti) return;
  REFRESH_SESSIONS.delete(jti);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<JWTPayload | null> {
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "refresh" || !payload.jti) return null;
  const state = REFRESH_SESSIONS.get(payload.jti);
  const now = Math.floor(Date.now() / 1000);
  if (!state) return null;
  if (state.userId !== payload.sub) return null;
  if (state.exp <= now) {
    REFRESH_SESSIONS.delete(payload.jti);
    return null;
  }
  return payload;
}

function parseCookieHeader(header: string | null): Record<string, string> {
  if (!header) return {};
  return header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, item) => {
      const idx = item.indexOf("=");
      if (idx <= 0) return acc;
      const key = item.slice(0, idx).trim();
      const value = decodeURIComponent(item.slice(idx + 1).trim());
      acc[key] = value;
      return acc;
    }, {});
}

export function getAccessTokenFromRequest(req: Request): string | null {
  const cookies = parseCookieHeader(req.headers.get("cookie"));
  if (cookies[ACCESS_COOKIE_NAME]) return cookies[ACCESS_COOKIE_NAME];
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "").trim();
  return token || null;
}

export function getRefreshTokenFromRequest(req: Request): string | null {
  const cookies = parseCookieHeader(req.headers.get("cookie"));
  return cookies[REFRESH_COOKIE_NAME] || null;
}

export async function getUserFromAuthHeader(
  req: Request,
): Promise<JWTPayload | null> {
  const token = getAccessTokenFromRequest(req);
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "access") return null;
  return payload;
}

function authCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function setAuthCookies(
  res: NextResponse,
  accessToken: string,
  refreshToken: string,
): void {
  res.cookies.set(ACCESS_COOKIE_NAME, accessToken, authCookieOptions(ACCESS_TOKEN_TTL_SECONDS));
  res.cookies.set(
    REFRESH_COOKIE_NAME,
    refreshToken,
    authCookieOptions(REFRESH_TOKEN_TTL_SECONDS),
  );
}

export function clearAuthCookies(res: NextResponse): void {
  res.cookies.set(ACCESS_COOKIE_NAME, "", { ...authCookieOptions(0), maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE_NAME, "", { ...authCookieOptions(0), maxAge: 0 });
}

export function getAuthRuntimeWarnings(): string[] {
  const warnings: string[] = [];
  if (IS_PRODUCTION && !HAS_PERSISTENT_REFRESH_STORE) {
    warnings.push(
      "Refresh sessions are stored in-memory; rotation state can be lost after cold start or redeploy.",
    );
  }
  return warnings;
}

export function getAuthRuntimeMetadata(): { refreshSessionStore: string; persistent: boolean } {
  return {
    refreshSessionStore: REFRESH_SESSION_STORE,
    persistent: HAS_PERSISTENT_REFRESH_STORE,
  };
}
