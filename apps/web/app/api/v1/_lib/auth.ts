import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "ayc-market-secret-2026-xk9m2p"
);

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
  iat?: number;
  exp?: number;
}

// Persistent cache via globalThis (shared within a process)
declare global {
  var __AYC_USERS_CACHE: Map<string, UserRecord>;
}
if (!globalThis.__AYC_USERS_CACHE) {
  globalThis.__AYC_USERS_CACHE = new Map<string, UserRecord>();
}

export const USERS = globalThis.__AYC_USERS_CACHE;
export const USERS_BY_ID = {
  get: (id: string): UserRecord | undefined => {
    for (const u of Array.from(globalThis.__AYC_USERS_CACHE.values())) {
      if (u.id === id) return u;
    }
    return undefined;
  },
  set: (_id: string, u: UserRecord) => {
    globalThis.__AYC_USERS_CACHE.set(u.email, u);
  },
};

// Sanitize email for Edge Config key (only alphanumeric + underscore allowed)
function sanitizeKey(email: string): string {
  return email.replace(/@/g, "_at_").replace(/\./g, "_dot_").replace(/[^a-zA-Z0-9_-]/g, "_");
}

// Edge Config read
async function ecGet(key: string): Promise<UserRecord | null> {
  try {
    const edgeConfigId = process.env.AYC_EDGE_CONFIG_ID;
    const connStr = process.env.AYC_EDGE_CONFIG || "";
    const token = connStr.includes("token=") ? connStr.split("token=")[1] : "";
    if (!edgeConfigId || !token) return null;
    const safeKey = sanitizeKey(key);
    const r = await fetch(
      `https://edge-config.vercel.com/${edgeConfigId}/item/${safeKey}?token=${token}`,
      { cache: "no-store" }
    );
    if (!r.ok) return null;
    return (await r.json()) as UserRecord;
  } catch {
    return null;
  }
}

// Edge Config write
async function ecSet(key: string, value: UserRecord): Promise<void> {
  try {
    const edgeConfigId = process.env.AYC_EDGE_CONFIG_ID;
    const apiToken = process.env.AYC_VERCEL_API_TOKEN;
    const teamId = process.env.AYC_TEAM_ID;
    if (!edgeConfigId || !apiToken) return;
    const qs = teamId ? `?teamId=${teamId}` : "";
    await fetch(`https://api.vercel.com/v1/edge-config/${edgeConfigId}/items${qs}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ operation: "upsert", key: sanitizeKey(key), value }] }),
    });
  } catch {
    // silent — in-memory is already updated
  }
}

// Public store API
export async function saveUser(user: UserRecord): Promise<void> {
  globalThis.__AYC_USERS_CACHE.set(user.email, user);
  await ecSet(user.email, user);
}

export async function lookupUser(email: string): Promise<UserRecord | null> {
  const cached = globalThis.__AYC_USERS_CACHE.get(email);
  if (cached) return cached;
  const fromEc = await ecGet(email);
  if (fromEc) {
    globalThis.__AYC_USERS_CACHE.set(fromEc.email, fromEc);
    return fromEc;
  }
  return null;
}

export async function signAccess(user: UserRecord): Promise<string> {
  return new SignJWT({ sub: user.id, email: user.email, name: user.name, plan: user.plan, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET);
}

export async function signRefresh(user: UserRecord): Promise<string> {
  return new SignJWT({ sub: user.id, email: user.email, name: user.name, plan: user.plan, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("90d")
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
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

// Credential token: contains hashed password for stateless re-login
export async function signCredential(user: UserRecord): Promise<string> {
  return new SignJWT({ sub: user.id, email: user.email, name: user.name, plan: user.plan, hp: user.hashedPassword, type: "credential" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(SECRET);
}

export async function verifyCredential(token: string): Promise<(JWTPayload & { hp?: string }) | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as (JWTPayload & { hp?: string });
  } catch {
    return null;
  }
}
export function getUserFromAuthHeader(req: Request): Promise<JWTPayload | null> {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) return Promise.resolve(null);
  return verifyToken(token);
}




