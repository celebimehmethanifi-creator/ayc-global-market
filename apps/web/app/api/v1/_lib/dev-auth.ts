import type { UserRecord } from "./auth";
import { generateId, hashPassword, verifyPassword } from "./auth";

const DEV_ONLY_SEEDS = [
  { email: "dev-elite@local.ayc", password: "DevOnlyElitePass!2026", name: "Dev Elite", plan: "elite" as const },
  { email: "dev-pro@local.ayc", password: "DevOnlyProPass!2026", name: "Dev Pro", plan: "pro" as const },
  { email: "dev-free@local.ayc", password: "DevOnlyFreePass!2026", name: "Dev Free", plan: "free" as const },
];

const devSeedUsers = new Map<string, UserRecord>();

function seedDevUsers(): void {
  if (devSeedUsers.size > 0) return;
  for (const entry of DEV_ONLY_SEEDS) {
    const email = entry.email.toLowerCase();
    devSeedUsers.set(email, {
      id: generateId(),
      email,
      name: entry.name,
      hashedPassword: hashPassword(entry.password),
      plan: entry.plan,
      createdAt: new Date().toISOString(),
    });
  }
}

export function getDevSeedUser(email: string, password: string): UserRecord | null {
  if (process.env.NODE_ENV === "production") return null;
  seedDevUsers();
  const user = devSeedUsers.get(email.toLowerCase());
  if (!user) return null;
  return verifyPassword(password, user.hashedPassword) ? user : null;
}
