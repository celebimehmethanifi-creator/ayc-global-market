"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle, ExternalLink, Shield, Unlink } from "lucide-react";
import { useRouter } from "next/navigation";

type BrokerId = "binance" | "bybit" | "okx";

interface BrokerDef {
  id: BrokerId;
  name: string;
  logo: string;
  color: string;
  docs: string;
  requiresPassphrase: boolean;
}

interface StoredConnection {
  brokerId: BrokerId;
  connected: boolean;
  connectionId: string;
  connectedAt: string;
  balance?: number;
  currency?: string;
}

const BROKERS: BrokerDef[] = [
  {
    id: "binance",
    name: "Binance",
    logo: "B",
    color: "#F0B90B",
    docs: "https://www.binance.com/en/support/faq/360002502072",
    requiresPassphrase: false,
  },
  {
    id: "bybit",
    name: "Bybit",
    logo: "Y",
    color: "#FF6B35",
    docs: "https://www.bybit.com/en/help-center/article/How-to-create-your-API-key",
    requiresPassphrase: false,
  },
  {
    id: "okx",
    name: "OKX",
    logo: "O",
    color: "#D4D4D8",
    docs: "https://www.okx.com/learn/complete-guide-to-okx-api",
    requiresPassphrase: true,
  },
];

const STORAGE_KEY = "ayc_broker_connections_secure_v1";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

export default function ExchangesPage() {
  const router = useRouter();
  const [connections, setConnections] = useState<Record<string, StoredConnection>>({});
  const [activeBroker, setActiveBroker] = useState<BrokerId | null>(null);
  const [loading, setLoading] = useState<BrokerId | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [form, setForm] = useState({ apiKey: "", secret: "", passphrase: "" });

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Record<string, StoredConnection>;
      setConnections(parsed || {});
    } catch {
      setConnections({});
    }
  }, []);

  const saveConnections = (next: Record<string, StoredConnection>) => {
    setConnections(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const connectedCount = useMemo(
    () => Object.values(connections).filter((c) => c.connected).length,
    [connections],
  );

  async function handleConnect(brokerId: BrokerId) {
    if (IS_PRODUCTION) {
      setMessage({
        type: "err",
        text: "Gercek borsa baglantisi guvenlik sertlestirmesi tamamlanana kadar kapalidir.",
      });
      return;
    }
    setLoading(brokerId);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/broker/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          brokerId,
          credentials: {
            apiKey: form.apiKey.trim(),
            secret: form.secret.trim(),
            passphrase: form.passphrase.trim(),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setMessage({ type: "err", text: data.error || "Baglanti kurulamadi." });
        return;
      }
      const next: Record<string, StoredConnection> = {
        ...connections,
        [brokerId]: {
          brokerId,
          connected: true,
          connectionId: data.connectionId,
          connectedAt: data.connectedAt || new Date().toISOString(),
          balance: data.balance ?? 0,
          currency: data.currency ?? "USDT",
        },
      };
      saveConnections(next);
      setActiveBroker(null);
      setForm({ apiKey: "", secret: "", passphrase: "" });
      setMessage({ type: "ok", text: `${brokerId.toUpperCase()} baglantisi dogrulandi.` });
    } catch {
      setMessage({ type: "err", text: "Sunucuya ulasilamadi." });
    } finally {
      setLoading(null);
    }
  }

  function handleDisconnect(brokerId: BrokerId) {
    const next = { ...connections };
    delete next[brokerId];
    saveConnections(next);
    setMessage({ type: "ok", text: `${brokerId.toUpperCase()} baglantisi kaldirildi.` });
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px 48px" }}>
      <button
        onClick={() => router.back()}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 14,
          background: "var(--bg-card)",
          border: "1px solid var(--b1)",
          borderRadius: "var(--r-md)",
          padding: "6px 14px",
          cursor: "pointer",
          color: "var(--t3)",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        <ArrowLeft size={13} /> Geri
      </button>

      <h1 style={{ margin: 0, fontSize: 24, color: "var(--t1)" }}>Borsa Baglantilari</h1>
      <p style={{ marginTop: 8, color: "var(--t3)", fontSize: 13 }}>
        API credential verisi backend tarafinda sifreli olarak tutulur. Client tarafinda
        sadece baglanti metadatasi saklanir.
      </p>

      {IS_PRODUCTION && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: "var(--r-md)",
            border: "1px solid rgba(245,158,11,0.35)",
            background: "rgba(245,158,11,0.12)",
            color: "#fbbf24",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          Gercek borsa baglantisi guvenlik sertlestirmesi tamamlanana kadar kapalıdır.
          Paper trading/demo kullanılabilir.
        </div>
      )}

      {connectedCount > 0 && (
        <div
          style={{
            marginTop: 14,
            marginBottom: 18,
            padding: "10px 14px",
            borderRadius: "var(--r-md)",
            background: "rgba(59,130,246,0.10)",
            border: "1px solid rgba(59,130,246,0.3)",
            color: "#93c5fd",
            fontSize: 12,
          }}
        >
          {connectedCount} borsa bagli.
        </div>
      )}

      {message && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: "var(--r-md)",
            border: message.type === "ok" ? "1px solid rgba(16,185,129,0.35)" : "1px solid rgba(239,68,68,0.35)",
            background: message.type === "ok" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
            color: message.type === "ok" ? "#34d399" : "#fca5a5",
            fontSize: 12,
          }}
        >
          {message.text}
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {BROKERS.map((broker) => {
          const conn = connections[broker.id];
          const isOpen = activeBroker === broker.id;
          return (
            <div
              key={broker.id}
              style={{
                border: conn ? "1px solid rgba(16,185,129,0.35)" : "1px solid var(--b1)",
                borderRadius: "var(--r-lg)",
                background: "var(--bg-card)",
                padding: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: `${broker.color}22`,
                      border: `1px solid ${broker.color}44`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      color: broker.color,
                    }}
                  >
                    {broker.logo}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <strong style={{ color: "var(--t1)" }}>{broker.name}</strong>
                      {conn?.connected && <CheckCircle size={12} color="#10b981" />}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--t4)", marginTop: 2 }}>
                      {conn?.connected
                        ? `Bagli - ${conn.currency || "USDT"} ${Number(conn.balance || 0).toFixed(2)}`
                        : "Henuz bagli degil"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <a
                    href={broker.docs}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      textDecoration: "none",
                      color: "var(--t3)",
                      border: "1px solid var(--b1)",
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontSize: 11,
                    }}
                  >
                    <ExternalLink size={10} /> Belge
                  </a>
                  {conn ? (
                    <button
                      onClick={() => handleDisconnect(broker.id)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        color: "#f87171",
                        border: "1px solid rgba(248,113,113,0.35)",
                        background: "rgba(248,113,113,0.1)",
                        borderRadius: 8,
                        padding: "6px 10px",
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      <Unlink size={10} /> Kes
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (IS_PRODUCTION) return;
                        setActiveBroker(isOpen ? null : broker.id);
                        setForm({ apiKey: "", secret: "", passphrase: "" });
                      }}
                      disabled={IS_PRODUCTION}
                      style={{
                        color: IS_PRODUCTION ? "rgba(255,255,255,0.55)" : "#0b1220",
                        background: IS_PRODUCTION
                          ? "rgba(255,255,255,0.15)"
                          : `linear-gradient(135deg, ${broker.color}, ${broker.color}cc)`,
                        border: "none",
                        borderRadius: 8,
                        padding: "6px 12px",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: IS_PRODUCTION ? "not-allowed" : "pointer",
                      }}
                    >
                      {IS_PRODUCTION ? "Productionda Kapali" : isOpen ? "Kapat" : "Bagla"}
                    </button>
                  )}
                </div>
              </div>

              {isOpen && !conn && !IS_PRODUCTION && (
                <div style={{ marginTop: 14, borderTop: "1px solid var(--b1)", paddingTop: 12 }}>
                  <div style={{ display: "grid", gap: 8 }}>
                    <input
                      type="text"
                      placeholder="API Key"
                      value={form.apiKey}
                      onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))}
                      style={{
                        width: "100%",
                        padding: "9px 10px",
                        borderRadius: 8,
                        background: "var(--bg-input)",
                        border: "1px solid var(--b1)",
                        color: "var(--t1)",
                        fontSize: 12,
                      }}
                    />
                    <input
                      type="password"
                      placeholder="Secret Key"
                      value={form.secret}
                      onChange={(e) => setForm((prev) => ({ ...prev, secret: e.target.value }))}
                      style={{
                        width: "100%",
                        padding: "9px 10px",
                        borderRadius: 8,
                        background: "var(--bg-input)",
                        border: "1px solid var(--b1)",
                        color: "var(--t1)",
                        fontSize: 12,
                      }}
                    />
                    {broker.requiresPassphrase && (
                      <input
                        type="password"
                        placeholder="Passphrase"
                        value={form.passphrase}
                        onChange={(e) => setForm((prev) => ({ ...prev, passphrase: e.target.value }))}
                        style={{
                          width: "100%",
                          padding: "9px 10px",
                          borderRadius: 8,
                          background: "var(--bg-input)",
                          border: "1px solid var(--b1)",
                          color: "var(--t1)",
                          fontSize: 12,
                        }}
                      />
                    )}
                    <button
                      onClick={() => handleConnect(broker.id)}
                      disabled={loading === broker.id}
                      style={{
                        width: "100%",
                        padding: "10px 0",
                        borderRadius: 8,
                        border: "none",
                        background: `linear-gradient(135deg, ${broker.color}, ${broker.color}cc)`,
                        color: "#0b1220",
                        fontWeight: 800,
                        fontSize: 12,
                        cursor: loading === broker.id ? "not-allowed" : "pointer",
                        opacity: loading === broker.id ? 0.6 : 1,
                      }}
                    >
                      {loading === broker.id ? "Dogrulaniyor..." : "Baglantiyi Dogrula"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 20,
          padding: "14px 16px",
          borderRadius: "var(--r-md)",
          border: "1px solid var(--b1)",
          background: "var(--bg-card)",
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        <Shield size={16} color="var(--t3)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 11, color: "var(--t4)", lineHeight: 1.6 }}>
          Production ortaminda istemciden dogrudan credential onboarding kapali olacak
          sekilde guard aktif. Gercek trade akisina gecmeden once 2FA, idempotency,
          audit log ve risk onayi zorunlu tutulur.
        </div>
      </div>
    </div>
  );
}
