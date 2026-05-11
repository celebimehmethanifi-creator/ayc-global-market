"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getUser, clearAuth } from "@/lib/auth";
import { User, Crown, CreditCard, LogOut, Shield, Zap, Check, Clock, TrendingUp, AlertCircle } from "lucide-react";

const PLANS = [
  { id: "free", name: "Ücretsiz", price: "$0", period: "", color: "#6B7280", icon: User, features: ["5 sinyal/gün", "Temel piyasa verisi", "Topluluk erişimi"] },
  { id: "pro", name: "Pro", price: "$9.99", period: "/ay", color: "#C9A84C", icon: Zap, features: ["Sınırsız sinyal", "Kalkan Risk Koruması", "AI Copilot (günlük 20)", "Gelişmiş grafikler", "Portföy takibi"], popular: true },
  { id: "elite", name: "Elite", price: "$24.99", period: "/ay", color: "#A855F7", icon: Crown, features: ["Sınırsız her şey", "Öncelikli AI sırası", "Özel strateji raporu", "API erişimi", "7/24 destek"] },
];

export default function AccountPage() {
  const router = useRouter();
  const user = getUser();
  const [sub, setSub] = useState<any>(null);
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState("");
  const [canceling, setCanceling] = useState(false);
  const [tab, setTab] = useState<"overview" | "billing" | "security">("overview");

  useEffect(() => {
    if (!user) { router.push("/signin"); return; }
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [subRes, txRes] = await Promise.allSettled([
        api.get("/billing/subscription"),
        api.get("/billing/transactions"),
      ]);
      if (subRes.status === "fulfilled") setSub(subRes.value.data);
      if (txRes.status === "fulfilled") setTxs(txRes.value.data?.transactions || []);
    } catch {}
    setLoading(false);
  }

  async function handleUpgrade(planId: string) {
    if (planId === "free") return;
    setUpgrading(planId);
    try {
      const r = await api.post("/billing/checkout", { plan: planId, payment_method: "stripe" });
      if (r.data?.checkout_url) window.open(r.data.checkout_url, "_blank");
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Ödeme sayfası açılamadı");
    }
    setUpgrading("");
  }

  async function handleCancel() {
    if (!confirm("Aboneliğinizi iptal etmek istediğinizden emin misiniz?")) return;
    setCanceling(true);
    try {
      await api.post("/billing/cancel");
      await fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "İptal işlemi başarısız");
    }
    setCanceling(false);
  }

  function handleLogout() {
    clearAuth();
    router.push("/signin");
  }

  if (!user) return null;
  const currentPlan = user.tier || "free";
  const planInfo = PLANS.find(p => p.id === currentPlan) || PLANS[0];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg,var(--gold),#B88A30)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "#0C0E16" }}>
            {(user.display_name || user.email || "U")[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "var(--t1)" }}>{user.display_name || user.email}</div>
            <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>{user.email}</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4, padding: "2px 8px", background: currentPlan === "elite" ? "rgba(168,85,247,0.12)" : currentPlan === "pro" ? "rgba(201,168,76,0.12)" : "rgba(255,255,255,0.05)", borderRadius: 20, border: `1px solid ${planInfo.color}40` }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: planInfo.color, textTransform: "uppercase" }}>{planInfo.name}</span>
            </div>
          </div>
        </div>
        <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(246,70,93,0.08)", border: "1px solid rgba(246,70,93,0.2)", borderRadius: "var(--r-sm)", color: "var(--down)", fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
          <LogOut size={14} /> Çıkış Yap
        </button>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--b1)" }}>
        {(["overview", "billing", "security"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "8px 16px", background: "none", border: "none", borderBottom: tab === t ? "2px solid var(--gold)" : "2px solid transparent", color: tab === t ? "var(--gold)" : "var(--t3)", fontSize: 13, fontWeight: tab === t ? 600 : 400, cursor: "pointer", marginBottom: -1 }}>
            {t === "overview" ? "Genel Bakış" : t === "billing" ? "Fatura & Plan" : "Güvenlik"}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16 }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--b1)", borderRadius: "var(--r-xl)", padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <CreditCard size={16} color="var(--gold)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Mevcut Plan</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: planInfo.color, marginBottom: 4 }}>{planInfo.name}</div>
            <div style={{ fontSize: 13, color: "var(--t3)", marginBottom: 16 }}>{planInfo.price}{planInfo.period}</div>
            {currentPlan !== "elite" && (
              <button onClick={() => setTab("billing")} style={{ width: "100%", padding: "9px", background: "linear-gradient(135deg,var(--gold),#B88A30)", border: "none", borderRadius: "var(--r-sm)", color: "#0C0E16", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                Planı Yükselt
              </button>
            )}
          </div>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--b1)", borderRadius: "var(--r-xl)", padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <TrendingUp size={16} color="var(--gold)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Hesap Özeti</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "AI Analiz Limiti", value: currentPlan === "free" ? "5/gün" : currentPlan === "pro" ? "20/gün" : "Sınırsız" },
                { label: "Portföy Takibi", value: currentPlan === "free" ? "3 varlık" : "Sınırsız" },
                { label: "Sinyal Erişimi", value: currentPlan === "free" ? "Temel" : "Gelişmiş" },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--t3)" }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "billing" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 16, marginBottom: 32 }}>
            {PLANS.map(plan => {
              const isCurrent = plan.id === currentPlan;
              return (
                <div key={plan.id} style={{ background: "var(--bg-card)", border: `1px solid ${isCurrent ? plan.color : "var(--b1)"}`, borderRadius: "var(--r-xl)", padding: 24, position: "relative" }}>
                  {plan.popular && !isCurrent && (
                    <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: "var(--gold)", color: "#0C0E16", fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 10 }}>EN POPÜLER</div>
                  )}
                  {isCurrent && (
                    <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: plan.color, color: plan.id === "free" ? "#fff" : "#0C0E16", fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 10 }}>MEVCUT PLANIN</div>
                  )}
                  <div style={{ fontWeight: 700, fontSize: 16, color: plan.color, marginBottom: 8 }}>{plan.name}</div>
                  <div style={{ marginBottom: 16 }}>
                    <span style={{ fontSize: 28, fontWeight: 800, color: "var(--t1)" }}>{plan.price}</span>
                    <span style={{ fontSize: 13, color: "var(--t3)" }}>{plan.period}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                    {plan.features.map(f => (
                      <div key={f} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Check size={12} color={plan.color} />
                        <span style={{ fontSize: 12, color: "var(--t2)" }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  {!isCurrent && plan.id !== "free" && (
                    <button onClick={() => handleUpgrade(plan.id)} disabled={!!upgrading} style={{ width: "100%", padding: "10px", background: `linear-gradient(135deg,${plan.color},${plan.color}aa)`, border: "none", borderRadius: "var(--r-sm)", color: plan.id === "elite" ? "#fff" : "#0C0E16", fontWeight: 700, fontSize: 13, cursor: upgrading ? "not-allowed" : "pointer", opacity: upgrading ? 0.6 : 1 }}>
                      {upgrading === plan.id ? "Yönlendiriliyor..." : `${plan.name}'e Geç`}
                    </button>
                  )}
                  {isCurrent && plan.id !== "free" && (
                    <button onClick={handleCancel} disabled={canceling} style={{ width: "100%", padding: "10px", background: "rgba(246,70,93,0.08)", border: "1px solid rgba(246,70,93,0.2)", borderRadius: "var(--r-sm)", color: "var(--down)", fontSize: 12, cursor: canceling ? "not-allowed" : "pointer" }}>
                      {canceling ? "İptal ediliyor..." : "Aboneliği İptal Et"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--b1)", borderRadius: "var(--r-xl)", padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <CreditCard size={16} color="var(--gold)" />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>İşlem Geçmişi</span>
            </div>
            {loading ? (
              <div style={{ textAlign: "center", color: "var(--t3)", padding: 20, fontSize: 13 }}>Yükleniyor...</div>
            ) : txs.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--t3)", padding: 20, fontSize: 13 }}>Henüz işlem bulunmuyor</div>
            ) : txs.map((tx, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--bg)", borderRadius: "var(--r-sm)", border: "1px solid var(--b1)", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{tx.plan?.toUpperCase()} Planı</div>
                  <div style={{ fontSize: 11, color: "var(--t3)" }}>{new Date(tx.created_at).toLocaleDateString("tr-TR")}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--up)" }}>${tx.amount || "9.99"}</div>
                  <div style={{ fontSize: 10, color: "var(--t3)" }}>{tx.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "security" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--b1)", borderRadius: "var(--r-xl)", padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Shield size={16} color="var(--gold)" />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>Güvenlik</span>
            </div>
            {[
              { label: "E-posta Adresi", value: user.email, action: "Değiştir" },
              { label: "Şifre", value: "••••••••••", action: "Değiştir" },
              { label: "İki Faktörlü Doğrulama", value: "Devre Dışı", action: "Etkinleştir" },
            ].map(({ label, value, action }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "var(--bg)", borderRadius: "var(--r-sm)", border: "1px solid var(--b1)", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--t3)" }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)" }}>{value}</div>
                </div>
                <button style={{ padding: "6px 12px", background: "none", border: "1px solid var(--b1)", borderRadius: "var(--r-sm)", color: "var(--gold)", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>{action}</button>
              </div>
            ))}
          </div>
          <div style={{ padding: "14px 16px", background: "rgba(246,70,93,0.05)", border: "1px solid rgba(246,70,93,0.15)", borderRadius: "var(--r-xl)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <AlertCircle size={14} color="var(--down)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--down)" }}>Tehlikeli Bölge</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 12 }}>Hesabınızı sildiğinizde tüm verileriniz kalıcı olarak silinir.</p>
            <button style={{ padding: "8px 16px", background: "rgba(246,70,93,0.08)", border: "1px solid rgba(246,70,93,0.2)", borderRadius: "var(--r-sm)", color: "var(--down)", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Hesabımı Sil</button>
          </div>
        </div>
      )}
    </div>
  );
}

