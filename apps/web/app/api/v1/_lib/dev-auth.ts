import type { UserRecord } from "./auth";
import { generateId, hashPassword, verifyPassword } from "./auth";

type DevSeedConfig = {
  email: string;
  name: string;
  plan: "free" | "pro" | "elite";
  passwordEnv: string;
  passwordHashEnv: string;
};

const DEV_SEED_CONFIG: DevSeedConfig[] = [
  {
    email: "dev-elite@local.ayc",
    name: "Dev Elite",
    plan: "elite",
    passwordEnv: "DEMO_SEED_ELITE_PASSWORD",
    passwordHashEnv: "DEMO_SEED_ELITE_PASSWORD_HASH",
  },
  {
    email: "dev-pro@local.ayc",
    name: "Dev Pro",
    plan: "pro",
    passwordEnv: "DEMO_SEED_PRO_PASSWORD",
    passwordHashEnv: "DEMO_SEED_PRO_PASSWORD_HASH",
  },
  {
    email: "dev-free@local.ayc",
    name: "Dev Free",
    plan: "free",
    passwordEnv: "DEMO_SEED_FREE_PASSWORD",
    passwordHashEnv: "DEMO_SEED_FREE_PASSWORD_HASH",
  },
];

const devSeedUsers = new Map<string, UserRecord>();

function isDevSeedEnabled(): boolean {
  if (process.env.DEMO_SEED_ENABLED === "true") return true;
  return process.env.NODE_ENV !== "production";
}

function resolveHashedPassword(entry: DevSeedConfig): string | null {
  const fromHashEnv = (process.env[entry.passwordHashEnv] || "").trim();
  if (fromHashEnv) return fromHashEnv;

  const fromPlainEnv = (process.env[entry.passwordEnv] || "").trim();
  if (!fromPlainEnv) return null;
  return hashPassword(fromPlainEnv);
}

function seedDevUsers(): void {
  if (devSeedUsers.size > 0) return;
  for (const entry of DEV_SEED_CONFIG) {
    const hashedPassword = resolveHashedPassword(entry);
    if (!hashedPassword) continue;
    const email = entry.email.toLowerCase();
    devSeedUsers.set(email, {
      id: generateId(),
      email,
      name: entry.name,
      hashedPassword,
      plan: entry.plan,
      createdAt: new Date().toISOString(),
    });
  }
}

export function getDevSeedUser(email: string, password: string): UserRecord | null {
  if (!isDevSeedEnabled()) return null;
  seedDevUsers();
  const user = devSeedUsers.get(email.toLowerCase());
  if (!user) return null;
  return verifyPassword(password, user.hashedPassword) ? user : null;
}
