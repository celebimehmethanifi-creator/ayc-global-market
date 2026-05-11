"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Check, Zap, Shield, Crown, Star } from "lucide-react";

const PLANS = [
  {
    key: "free",
    name: "Free",
    priceTry: 0,
    priceUsd: 0,
    icon: Star,
    color: "var(--t3)",
    border: "var(--b1)",
    bg: "rgba(255,255,255,0.02)",
    badge: "",
    features: ["Günde 5 sinyal", "Simülasyon modu", "Temel Kalkan", "Piyasa özeti"],
  },
  {
    key: "pro",
    name: "Pro",
    priceTry: 299,
    priceUsd: 9.99,
    icon: Zap,
    color: "var(--gold)",
    border: "var(--gold-border)",
    bg: "var(--gold-dim)",
    badge: "En Popüler",
    features: ["Sınırsız sinyal", "Tam Kalkan sistemi", "AI Copilot sohbet", "Sabah brifing", "Tüm kategoriler", "Öncelikli destek"],
  },
  {
    key: "elite",
    name: "Elite",
    priceTry: 799,
    priceUsd: 24.99,
    icon: Crown,
    color: "#818CF8",
    border: "rgba(129,140,248,0.25)",
    bg: "rgba(129,140,248,0.06)",
    badge: "En Güçlü",
    features: ["Pro özellikleri +", "What-If simülatör", "Öncelikli sinyal", "VIP destek", "Özel strateji raporları", "API erişimi"],
  },
];

export default function SubscribePage() {
  const { data: status } = useQuery({
    queryKey: ["sub-status"],
    queryFn: () => api.get("/billing/subscription").then((r) => r.data).catch(() => ({ tier: "free" })),
  });

  const checkoutMutation = useMutation({
    mutationFn: ({ plan, provider }: { plan: string; provider: string }) =>
      api.post("/billing/checkout", { plan, provider }).then((r) => r.data),
    onSuccess: (data) => {
      if (data.checkout_url) window.location.href = data.checkout_url;
    },
  });

  const currentTier = status?.tier || "free";

  return (
    <div style={{maxWidth:960,margin:"0 auto"}}>
      {/* Header */}
      <div style={{textAlign:"center",marginBottom:36}}>
        <div style={{
          display:"inline-flex",alignItems:"center",gap:8,padding:"6px 16px",
          background:"var(--gold-dim)",border:"1px solid var(--gold-border)",
          borderRadius:20,marginBottom:16
        }}>
          <Zap size={12} color="var(--gold)" />
          <span style={{fontSize:12,fontWeight:600,color:"var(--gold)"}}>Üyelik Planları</span>
        </div>
        <h1 style={{fontSize:28,fontWeight:800,color:"var(--t1)",fontFamily:"var(--font-head)",marginBottom:8}}>
          AYC Global Market&apos;i Tam Güçte Kullan
        </h1>
        <p style={{fontSize:14,color:"var(--t2)",maxWidth:480,margin:"0 auto"}}>
          AI destekli sinyaller, Kalkan risk koruması ve gerçek zamanlı piyasa analizi
        </p>
        {currentTier !== "free" && (
          <div style={{
            display:"inline-flex",alignItems:"center",gap:8,marginTop:16,
            padding:"6px 16px",background:"rgba(14,203,129,0.1)",
            border:"1px solid rgba(14,203,129,0.2)",borderRadius:20
          }}>
            <Shield size={12} color="var(--up)" />
            <span style={{fontSize:12,fontWeight:600,color:"var(--up)"}}>
              Mevcut planınız: {currentTier.toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Plans grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16,marginBottom:32}}>
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isActive = currentTier === plan.key;
          return (
            <div key={plan.key} style={{
              background: isActive ? plan.bg : "var(--bg-card)",
              border: `2px solid ${isActive ? plan.border : "var(--b1)"}`,
              borderRadius:"var(--r-xl)",padding:28,position:"relative",
              transition:"all 0.2s",boxShadow: isActive ? "var(--shadow-gold)" : "none"
            }}>
              {plan.badge && (
                <div style={{
                  position:"absolute",top:-12,left:"50%",transform:"translateX(-50%)",
                  padding:"3px 14px",background:plan.key==="pro"?"var(--gold)":"#818CF8",
                  color:plan.key==="pro"?"#0C0E16":"#fff",
                  borderRadius:20,fontSize:11,fontWeight:700,whiteSpace:"nowrap"
                }}>{plan.badge}</div>
              )}
              {isActive && (
                <div style={{
                  position:"absolute",top:12,right:12,
                  padding:"2px 10px",background:"rgba(14,203,129,0.12)",
                  border:"1px solid rgba(14,203,129,0.2)",
                  color:"var(--up)",borderRadius:20,fontSize:10,fontWeight:700
                }}>AKTİF</div>
              )}

              <div style={{marginBottom:20}}>
                <div style={{
                  width:44,height:44,borderRadius:12,
                  background:`${plan.bg || "rgba(255,255,255,0.04)"}`,
                  border:`1px solid ${plan.border}`,
                  display:"flex",alignItems:"center",justifyContent:"center",marginBottom:14
                }}>
                  <Icon size={20} color={plan.color} />
                </div>
                <div style={{fontSize:18,fontWeight:800,color:plan.color,fontFamily:"var(--font-head)"}}>{plan.name}</div>
                {plan.priceTry === 0 ? (
                  <div style={{fontSize:26,fontWeight:900,color:"var(--t1)",marginTop:6}}>Ücretsiz</div>
                ) : (
                  <div style={{marginTop:6}}>
                    <span style={{fontSize:28,fontWeight:900,color:"var(--t1)"}}>₺{plan.priceTry}</span>
                    <span style={{fontSize:13,color:"var(--t3)"}}>/ay</span>
                    <div style={{fontSize:11,color:"var(--t4)",marginTop:2}}>${plan.priceUsd}/month</div>
                  </div>
                )}
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:24}}>
                {plan.features.map((f) => (
                  <div key={f} style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{
                      width:18,height:18,borderRadius:5,flexShrink:0,
                      background:`${plan.bg}`,border:`1px solid ${plan.border}`,
                      display:"flex",alignItems:"center",justifyContent:"center"
                    }}>
                      <Check size={10} color={plan.color} />
                    </div>
                    <span style={{fontSize:13,color:"var(--t2)"}}>{f}</span>
                  </div>
                ))}
              </div>

              {isActive ? (
                <div style={{
                  padding:"11px",textAlign:"center",
                  background:"rgba(255,255,255,0.03)",border:"1px solid var(--b1)",
                  borderRadius:"var(--r-sm)",fontSize:13,color:"var(--t3)",fontWeight:600
                }}>Mevcut Plan</div>
              ) : plan.priceTry === 0 ? (
                <div style={{
                  padding:"11px",textAlign:"center",
                  background:"rgba(255,255,255,0.03)",border:"1px solid var(--b1)",
                  borderRadius:"var(--r-sm)",fontSize:13,color:"var(--t3)",fontWeight:600
                }}>Varsayılan</div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {/* PRIMARY — Turkish card via iyzico */}
                  <button
                    onClick={() => checkoutMutation.mutate({ plan: plan.key, provider: "iyzico" })}
                    disabled={checkoutMutation.isPending}
                    style={{
                      padding:"12px",
                      background: plan.key === "pro"
                        ? "linear-gradient(135deg, #f59e0b, #d97706)"
                        : "linear-gradient(135deg, #6366f1, #818cf8)",
                      border:"none",borderRadius:"var(--r-sm)",
                      color: plan.key === "pro" ? "#000" : "#fff",
                      fontWeight:700,fontSize:13,cursor:"pointer",
                      fontFamily:"var(--font-body)",
                      opacity:checkoutMutation.isPending?0.7:1,
                      width:"100%",
                      boxShadow: plan.key === "pro"
                        ? "0 0 16px rgba(245,158,11,0.35)"
                        : "0 0 20px rgba(99,102,241,0.4)",
                      display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                    }}
                  >
                    {checkoutMutation.isPending ? "Yönlendiriliyor..." : "💳 Türk Kartı ile Öde"}
                  </button>
                  {/* SECONDARY — International card via Lemon Squeezy */}
                  <button
                    onClick={() => checkoutMutation.mutate({ plan: plan.key, provider: "lemonsqueezy" })}
                    disabled={checkoutMutation.isPending}
                    style={{
                      padding:"9px",
                      background:"rgba(255,255,255,0.03)",
                      border:"1px solid var(--b1)",
                      borderRadius:"var(--r-sm)",
                      color:"var(--t3)",fontWeight:500,fontSize:11,
                      cursor:"pointer",fontFamily:"var(--font-body)",width:"100%",
                    }}
                  >
                    🌍 Uluslararası Kart (USD)
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Features comparison */}
      <div style={{
        background:"var(--bg-card)",border:"1px solid var(--b1)",borderRadius:"var(--r-xl)",
        padding:24,marginBottom:24
      }}>
        <div style={{fontSize:14,fontWeight:700,color:"var(--t1)",marginBottom:16}}>Neden AYC Global Market?</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16}}>
          {[
            {icon:"🛡️",title:"Kalkan Risk Koruması",desc:"Drawdown kilidi, FOMO engeli, stop disiplini"},
            {icon:"🤖",title:"AI Copilot",desc:"GPT + Claude + Gemini consensus motoru"},
            {icon:"📡",title:"Gerçek Zamanlı",desc:"Canlı fiyat, hacim, haber entegrasyonu"},
            {icon:"🧠",title:"Psikolojik Kalkan",desc:"Duygusal kararları önleyen sistem"},
          ].map((f,i)=>(
            <div key={i} style={{
              padding:"14px 16px",background:"rgba(255,255,255,0.02)",
              border:"1px solid var(--b1)",borderRadius:"var(--r-md)"
            }}>
              <div style={{fontSize:22,marginBottom:8}}>{f.icon}</div>
              <div style={{fontSize:13,fontWeight:700,color:"var(--t1)",marginBottom:4}}>{f.title}</div>
              <div style={{fontSize:12,color:"var(--t3)"}}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{textAlign:"center",marginTop:8}}>
        <p style={{fontSize:11,color:"var(--t4)",marginBottom:6}}>
          Fiyatlar KDV hariçtir. İstediğiniz zaman iptal edebilirsiniz. Bu platform yatırım tavsiyesi vermez.
        </p>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:16,flexWrap:"wrap"}}>
          <span style={{fontSize:10,color:"var(--t4)",display:"flex",alignItems:"center",gap:4}}>
            <span>🔒</span> SSL Güvenli Ödeme
          </span>
          <span style={{fontSize:10,color:"var(--t4)",display:"flex",alignItems:"center",gap:4}}>
            <span>🏦</span> iyzico — Türk Bankası Onaylı
          </span>
          <span style={{fontSize:10,color:"var(--t4)",display:"flex",alignItems:"center",gap:4}}>
            <span>🌍</span> Lemon Squeezy — Global MOR
          </span>
        </div>
      </div>
    </div>
  );
}

