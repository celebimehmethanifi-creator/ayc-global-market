import crypto from "crypto";
import fs from "fs";
import path from "path";

const MIN_KEY_LENGTH = 32;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const VAULT_DIR = path.join(process.cwd(), ".secure");
const VAULT_PATH = path.join(VAULT_DIR, "exchange-vault.json");

interface EncryptedEntry {
  connectionId: string;
  userId: string;
  exchange: string;
  createdAt: string;
  updatedAt: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

interface VaultDocument {
  version: 1;
  entries: EncryptedEntry[];
}

interface ExchangeSecrets {
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
}

export interface ExchangeConnectionSummary {
  connectionId: string;
  exchange: string;
  createdAt: string;
}

function readMasterKey(): Buffer {
  const raw = (process.env.EXCHANGE_CREDENTIALS_KEY || "").trim();
  if (!raw) {
    if (IS_PRODUCTION) {
      throw new Error("EXCHANGE_CREDENTIALS_KEY is required in production.");
    }
    return crypto
      .createHash("sha256")
      .update("dev-insecure-exchange-key")
      .digest();
  }
  if (raw.length < MIN_KEY_LENGTH) {
    throw new Error(
      `EXCHANGE_CREDENTIALS_KEY must be at least ${MIN_KEY_LENGTH} characters.`,
    );
  }
  return crypto.createHash("sha256").update(raw).digest();
}

let _masterKey: Buffer | null = null;
function getMasterKey(): Buffer {
  if (!_masterKey) _masterKey = readMasterKey();
  return _masterKey;
}

function ensureVaultDir(): void {
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
  }
}

function readVault(): VaultDocument {
  ensureVaultDir();
  if (!fs.existsSync(VAULT_PATH)) {
    return { version: 1, entries: [] };
  }
  try {
    const raw = fs.readFileSync(VAULT_PATH, "utf8");
    const parsed = JSON.parse(raw) as VaultDocument;
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) {
      return { version: 1, entries: [] };
    }
    return parsed;
  } catch {
    return { version: 1, entries: [] };
  }
}

function writeVault(doc: VaultDocument): void {
  ensureVaultDir();
  fs.writeFileSync(VAULT_PATH, JSON.stringify(doc, null, 2), "utf8");
}

function encryptPayload(payload: ExchangeSecrets): Pick<EncryptedEntry, "iv" | "tag" | "ciphertext"> {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getMasterKey(), iv);
  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(plaintext, "utf8")),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: encrypted.toString("base64"),
  };
}

function decryptPayload(entry: EncryptedEntry): ExchangeSecrets {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getMasterKey(),
    Buffer.from(entry.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(entry.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(entry.ciphertext, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8")) as ExchangeSecrets;
}

function buildConnectionId(userId: string, exchange: string): string {
  const digest = crypto
    .createHash("sha256")
    .update(`${userId}:${exchange}`)
    .digest("hex")
    .slice(0, 24);
  return `ex_${digest}`;
}

export function upsertExchangeCredential(
  userId: string,
  exchange: string,
  secrets: ExchangeSecrets,
): ExchangeConnectionSummary {
  const connectionId = buildConnectionId(userId, exchange);
  const now = new Date().toISOString();
  const vault = readVault();
  const encrypted = encryptPayload(secrets);

  const existing = vault.entries.find((entry) => entry.connectionId === connectionId);
  const createdAt = existing?.createdAt || now;

  const nextEntry: EncryptedEntry = {
    connectionId,
    userId,
    exchange,
    createdAt,
    updatedAt: now,
    ...encrypted,
  };

  vault.entries = vault.entries.filter((entry) => entry.connectionId !== connectionId);
  vault.entries.push(nextEntry);
  writeVault(vault);

  return { connectionId, exchange, createdAt };
}

export function getExchangeCredential(
  userId: string,
  connectionId: string,
): (ExchangeSecrets & ExchangeConnectionSummary) | null {
  const vault = readVault();
  const entry = vault.entries.find((item) => item.connectionId === connectionId);
  if (!entry) return null;
  if (entry.userId !== userId) return null;
  const secrets = decryptPayload(entry);
  return {
    connectionId: entry.connectionId,
    exchange: entry.exchange,
    createdAt: entry.createdAt,
    ...secrets,
  };
}

export function deleteExchangeCredential(userId: string, connectionId: string): void {
  const vault = readVault();
  const nextEntries = vault.entries.filter(
    (entry) => !(entry.userId === userId && entry.connectionId === connectionId),
  );
  vault.entries = nextEntries;
  writeVault(vault);
}

export function listExchangeConnections(userId: string): ExchangeConnectionSummary[] {
  const vault = readVault();
  return vault.entries
    .filter((entry) => entry.userId === userId)
    .map((entry) => ({
      connectionId: entry.connectionId,
      exchange: entry.exchange,
      createdAt: entry.createdAt,
    }));
}

