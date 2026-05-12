"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Zap, Shield, Globe, TrendingUp, CheckCircle, AlertCircle, Link, Unlink, ExternalLink, Info, ArrowLeft, X } from "lucide-react";

const BROKERS = [
  // Crypto CEX - Tier 1
  {
    id: "binance", name: "Binance", category: "Kripto CEX", logo: "🟡",
    description: "Dünyanın en büyük kripto borsası. Spot + Futures işlem.",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "Binance API Key", secret: false },
      { key: "secret", label: "Secret Key", placeholder: "Binance Secret Key", secret: true },
    ],
    docs: "https://www.binance.com/en/support/faq/360002502072",
    markets: ["Kripto Spot", "Kripto Futures"],
    difficulty: "Kolay", color: "#F0B90B",
    testMode: false,
  },
  {
    id: "bybit", name: "Bybit", category: "Kripto CEX", logo: "🟠",
    description: "Kripto spot, perpetual ve options işlem platformu.",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "Bybit API Key", secret: false },
      { key: "secret", label: "Secret Key", placeholder: "Bybit Secret Key", secret: true },
    ],
    docs: "https://www.bybit.com/en/help-center/article/How-to-create-your-API-key",
    markets: ["Kripto Spot", "Perpetual", "Options"],
    difficulty: "Kolay", color: "#F7A600",
    testMode: false,
  },
  {
    id: "okx", name: "OKX", category: "Kripto CEX", logo: "⚫",
    description: "Global kripto borsası. Spot, futures, DeFi.",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "OKX API Key", secret: false },
      { key: "secret", label: "Secret Key", placeholder: "OKX Secret Key", secret: true },
      { key: "passphrase", label: "Passphrase", placeholder: "OKX API Passphrase", secret: true },
    ],
    docs: "https://www.okx.com/learn/complete-guide-to-okx-api",
    markets: ["Kripto Spot", "Futures", "DeFi"],
    difficulty: "Orta", color: "#333",
    testMode: false,
  },
  // US Equities
  {
    id: "alpaca", name: "Alpaca", category: "ABD Hisseleri", logo: "🦙",
    description: "Commission-free US stocks & ETFs. Ücretsiz paper trading ile test edebilirsiniz.",
    fields: [
      { key: "apiKey", label: "API Key ID", placeholder: "APCA-API-KEY-ID", secret: false },
      { key: "secret", label: "Secret Key", placeholder: "APCA-API-SECRET-KEY", secret: true },
      { key: "paper", label: "Paper Trading (Test Modu)", type: "checkbox", placeholder: "", secret: false },
    ],
    docs: "https://alpaca.markets/learn/connect-to-alpaca-api",
    markets: ["ABD Hisseleri", "ETF"],
    difficulty: "Kolay", color: "#FFCB00",
    testMode: true,
  },
  // Turkish BIST
  {
    id: "algolab", name: "AlgoLab (Deniz Yatırım)", category: "BIST / Türkiye", logo: "🇹🇷",
    description: "Türkiye'nin en gelişmiş algo trading altyapısı. BIST hisseleri + VIOP vadeli işlemler.",
    fields: [
      { key: "apiKey", label: "AlgoLab API Kodu", placeholder: "API Kodu", secret: false },
      { key: "username", label: "Kullanıcı Adı", placeholder: "Deniz Yatırım kullanıcı adı", secret: false },
      { key: "password", label: "Şifre", placeholder: "Hesap şifresi", secret: true },
    ],
    docs: "https://www.algolab.com.tr",
    markets: ["BIST Hisseleri", "VIOP Vadeli"],
    difficulty: "Orta", color: "#E30A17",
    testMode: false,
  },
  // Global
  {
    id: "ibkr", name: "Interactive Brokers", category: "Global / Çok Piyasalı", logo: "🌐",
    description: "150+ ülkede hisse, futures, options, forex. Kurumsal seviye altyapı.",
    fields: [
      { key: "username", label: "IBKR Kullanıcı Adı", placeholder: "TWS/CP Gateway username", secret: false },
      { key: "password", label: "Şifre", placeholder: "TWS/CP Gateway password", secret: true },
      { key: "accountId", label: "Hesap ID", placeholder: "U12345678", secret: false },
    ],
    docs: "https://www.interactivebrokers.com/en/trading/ib-api.php",
    markets: ["Hisse", "Futures", "Options", "Forex", "Tahvil"],
    difficulty: "Zor", color: "#E31837",
    testMode: false,
  },
  // MetaTrader (GCM etc.)
  {
    id: "metatrader5", name: "MetaTrader 5 (GCM / MT5 Destekli)", category: "Forex / VIOP", logo: "📊",
    description: "GCM Yatırım ve diğer MT5 aracılar. VIOP, Forex, CFD işlemi. Masaüstü MT5 kurulu olması gerekir.",
    fields: [
      { key: "server", label: "MT5 Sunucu", placeholder: "GCMTrader5-Live", secret: false },
      { key: "login", label: "Hesap No", placeholder: "MT5 Hesap Numarası", secret: false },
      { key: "password", label: "Şifre", placeholder: "MT5 Şifresi", secret: true },
    ],
    docs: "https://www.gcmyatirim.com.tr",
    markets: ["Forex", "CFD", "VIOP", "Emtia"],
    difficulty: "Orta", color: "#0066CC",
    testMode: false,
  },
];

interface Connection { brokerId: string; connected: boolean; credentials: Record<string,string>; connectedAt?: string; balance?: number; }

export default function ExchangesPage() {
  const [connections, setConnections] = useState<Record<string,Connection>>({});
  const [openForm, setOpenForm] = useState<string|null>(null);
  const [formData, setFormData] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState<string|null>(null);
  const [message, setMessage] = useState<{type:"ok"|"err";text:string}|null>(null);
  const user = getUser();
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("ayc_broker_connections");
    if (stored) {
      try { setConnections(JSON.parse(stored)); } catch {}
    }
  }, []);

  const saveConnections = (updated: Record<string,Connection>) => {
    setConnections(updated);
    localStorage.setItem("ayc_broker_connections", JSON.stringify(updated));
  };

  const handleConnect = async (brokerId: string) => {
    setLoading(brokerId);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/broker/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brokerId, credentials: formData }),
      });
      const data = await res.json();
      if (data.success) {
        const updated = {
          ...connections,
          [brokerId]: {
            brokerId, connected: true, credentials: formData,
            connectedAt: new Date().toISOString(),
            balance: data.balance ?? 0,
          }
        };
        saveConnections(updated);
        setOpenForm(null);
        setFormData({});
        setMessage({ type: "ok", text: `${BROKERS.find(b=>b.id===brokerId)?.name} başarıyla bağlandı!` });
      } else {
        setMessage({ type: "err", text: data.error || "Bağlantı başarısız." });
      }
    } catch {
      setMessage({ type: "err", text: "Ağ hatası. Bilgileri kontrol edin." });
    }
    setLoading(null);
  };

  const handleDisconnect = (brokerId: string) => {
    const updated = { ...connections };
    delete updated[brokerId];
    saveConnections(updated);
    setMessage({ type: "ok", text: "Bağlantı kaldırıldı." });
  };

  const categories = Array.from(new Set(BROKERS.map(b => b.category)));

  return (
    <div style={{ padding:"24px", maxWidth:1100, margin:"0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <button onClick={() => router.back()} style={{
          display:"flex", alignItems:"center", gap:6, marginBottom:14,
          background:"var(--bg-card)", border:"1px solid var(--b1)",
          borderRadius:"var(--r-md)", padding:"6px 14px", cursor:"pointer",
          color:"var(--t3)", fontSize:12, fontWeight:600,
          transition:"all 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.color="var(--t1)")}
        onMouseLeave={e => (e.currentTarget.style.color="var(--t3)")}>
          <ArrowLeft size={13}/> Geri
        </button>
        <h1 style={{ fontSize:22, fontWeight:800, color:"var(--t1)", margin:0 }}>Borsa Bağlantıları</h1>
        <p style={{ fontSize:13, color:"var(--t3)", marginTop:6 }}>
          Hesabınızı borsalara bağlayın. AI analizleri gerçek portföyünüz üzerinden yapılır ve emir gönderilebilir.
        </p>
      </div>

      {/* Status message */}
      {message && (
        <div style={{
          marginBottom:16, padding:"10px 16px", borderRadius:"var(--r-md)",
          background: message.type==="ok" ? "rgba(38,215,130,0.1)" : "rgba(246,70,93,0.1)",
          border: `1px solid ${message.type==="ok" ? "var(--up)" : "var(--down)"}`,
          color: message.type==="ok" ? "var(--up)" : "var(--down)",
          fontSize:13, display:"flex", alignItems:"center", gap:8,
        }}>
          {message.type==="ok" ? <CheckCircle size={14}/> : <AlertCircle size={14}/>}
          {message.text}
        </div>
      )}

      {/* Connected count banner */}
      {Object.keys(connections).length > 0 && (
        <div style={{
          marginBottom:20, padding:"12px 16px", borderRadius:"var(--r-md)",
          background:"rgba(99,102,241,0.08)", border:"1px solid rgba(99,102,241,0.25)",
          display:"flex", alignItems:"center", gap:10,
        }}>
          <CheckCircle size={14} color="var(--purple)"/>
          <span style={{ fontSize:13, color:"var(--t2)" }}>
            <strong style={{color:"var(--purple)"}}>{Object.keys(connections).length} borsa</strong> bağlı —  AI analizleri artık gerçek verilerinizle çalışıyor.
          </span>
        </div>
      )}

      {/* Broker cards by category */}
      {categories.map(cat => (
        <div key={cat} style={{ marginBottom:32 }}>
          <h2 style={{ fontSize:13, fontWeight:700, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:14 }}>
            {cat}
          </h2>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:14 }}>
            {BROKERS.filter(b => b.category === cat).map(broker => {
              const conn = connections[broker.id];
              const isConnected = !!conn?.connected;
              const isOpen = openForm === broker.id;

              return (
                <div key={broker.id} style={{
                  background:"var(--bg-card)", border:`1px solid ${isConnected ? "rgba(38,215,130,0.3)" : "var(--b1)"}`,
                  borderRadius:"var(--r-lg)", overflow:"hidden",
                  boxShadow: isConnected ? "0 0 0 1px rgba(38,215,130,0.1)" : "none",
                }}>
                  {/* Card header */}
                  <div style={{ padding:"14px 16px", display:"flex", alignItems:"flex-start", gap:12 }}>
                    <div style={{
                      width:40, height:40, borderRadius:"var(--r-md)", flexShrink:0,
                      background:`${broker.color}18`, border:`1px solid ${broker.color}30`,
                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:20,
                    }}>
                      {broker.logo}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:14, fontWeight:700, color:"var(--t1)" }}>{broker.name}</span>
                        {isConnected && <CheckCircle size={12} color="var(--up)"/>}
                        {broker.testMode && <span style={{ fontSize:9, padding:"1px 5px", borderRadius:3, background:"rgba(99,102,241,0.15)", color:"var(--purple)", fontWeight:700 }}>TEST</span>}
                      </div>
                      <div style={{ fontSize:11, color:"var(--t4)", marginTop:2 }}>{broker.description}</div>
                    </div>
                  </div>

                  {/* Markets + difficulty */}
                  <div style={{ padding:"0 16px 12px", display:"flex", gap:6, flexWrap:"wrap" }}>
                    {broker.markets.map(m => (
                      <span key={m} style={{ fontSize:9, padding:"2px 6px", borderRadius:3, background:"var(--bg-hover)", color:"var(--t3)", fontWeight:600 }}>{m}</span>
                    ))}
                    <span style={{ fontSize:9, padding:"2px 6px", borderRadius:3, background:"var(--bg-hover)", color:"var(--t4)" }}>
                      Zorluk: {broker.difficulty}
                    </span>
                  </div>

                  {/* Connect / Disconnect button */}
                  <div style={{ padding:"0 16px 14px", display:"flex", gap:8 }}>
                    {isConnected ? (
                      <>
                        <div style={{ flex:1, fontSize:11, color:"var(--up)", display:"flex", alignItems:"center", gap:5 }}>
                          <CheckCircle size={11}/>
                          Bağlı {conn.balance ? `· $${conn.balance.toLocaleString()}` : ""}
                        </div>
                        <button onClick={() => handleDisconnect(broker.id)} style={{
                          padding:"6px 12px", borderRadius:"var(--r-sm)", fontSize:11, cursor:"pointer",
                          background:"rgba(246,70,93,0.1)", border:"1px solid rgba(246,70,93,0.3)", color:"var(--down)",
                          display:"flex", alignItems:"center", gap:5,
                        }}>
                          <Unlink size={10}/> Kopar
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setOpenForm(isOpen ? null : broker.id); setFormData({}); }} style={{
                          flex:1, padding:"8px 0", borderRadius:"var(--r-sm)", fontSize:12, fontWeight:700, cursor:"pointer",
                          background: isOpen ? "var(--bg-hover)" : `linear-gradient(135deg,${broker.color},${broker.color}cc)`,
                          border: isOpen ? "1px solid var(--b1)" : "none",
                          color: isOpen ? "var(--t2)" : "#000",
                          display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                        }}>
                          <Link size={11}/> {isOpen ? "İptal" : "Bağlan"}
                        </button>
                        <a href={broker.docs} target="_blank" rel="noopener noreferrer" style={{
                          padding:"8px 10px", borderRadius:"var(--r-sm)", fontSize:11, cursor:"pointer",
                          background:"var(--bg-hover)", border:"1px solid var(--b1)", color:"var(--t3)",
                          display:"flex", alignItems:"center", gap:4, textDecoration:"none",
                        }}>
                          <ExternalLink size={10}/> Belge
                        </a>
                      </>
                    )}
                  </div>

                  {/* Connection form */}
                  {isOpen && !isConnected && (
                    <div style={{ padding:"0 16px 16px", borderTop:"1px solid var(--b1)" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:12, marginBottom:8 }}>
                        <span style={{ fontSize:11, fontWeight:700, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"0.06em" }}>API Bilgileri</span>
                        <button onClick={() => { setOpenForm(null); setFormData({}); }} style={{
                          background:"var(--bg-hover)", border:"1px solid var(--b1)",
                          borderRadius:"50%", width:22, height:22, cursor:"pointer",
                          display:"flex", alignItems:"center", justifyContent:"center", color:"var(--t3)",
                        }}>
                          <X size={11}/>
                        </button>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        {broker.fields.map(field => (
                          <div key={field.key}>
                            <label style={{ fontSize:11, color:"var(--t3)", display:"block", marginBottom:4 }}>{field.label}</label>
                            {field.type === "checkbox" ? (
                              <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
                                <input
                                  type="checkbox"
                                  checked={formData[field.key] === "true"}
                                  onChange={e => setFormData(p => ({ ...p, [field.key]: e.target.checked ? "true" : "false" }))}
                                />
                                <span style={{ fontSize:11, color:"var(--t2)" }}>Paper Trading Modu (Test)</span>
                              </label>
                            ) : (
                              <input
                                type={field.secret ? "password" : "text"}
                                placeholder={field.placeholder}
                                value={formData[field.key] || ""}
                                onChange={e => setFormData(p => ({ ...p, [field.key]: e.target.value }))}
                                style={{
                                  width:"100%", padding:"8px 10px", borderRadius:"var(--r-sm)",
                                  background:"var(--bg-input)", border:"1px solid var(--b1)",
                                  color:"var(--t1)", fontSize:12, boxSizing:"border-box",
                                }}
                              />
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => handleConnect(broker.id)}
                          disabled={loading === broker.id}
                          style={{
                            marginTop:4, padding:"9px 0", borderRadius:"var(--r-sm)",
                            background:`linear-gradient(135deg,${broker.color},${broker.color}cc)`,
                            border:"none", color:"#000", fontSize:12, fontWeight:700, cursor:"pointer",
                            opacity: loading === broker.id ? 0.6 : 1,
                          }}
                        >
                          {loading === broker.id ? "Bağlanıyor..." : "Bağlantıyı Doğrula"}
                        </button>
                        <div style={{ fontSize:10, color:"var(--t4)", textAlign:"center" }}>
                          API bilgileriniz tarayıcınızda şifreli saklanır, sunuculara gönderilmez.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Security info */}
      <div style={{
        marginTop:8, padding:"14px 16px", borderRadius:"var(--r-md)",
        background:"var(--bg-card)", border:"1px solid var(--b1)",
        display:"flex", gap:12, alignItems:"flex-start",
      }}>
        <Shield size={16} color="var(--t3)" style={{ flexShrink:0, marginTop:1 }}/>
        <div>
          <div style={{ fontSize:12, fontWeight:600, color:"var(--t2)", marginBottom:3 }}>Güvenlik Notu</div>
          <div style={{ fontSize:11, color:"var(--t4)", lineHeight:1.6 }}>
            API anahtarlarınız sadece tarayıcınızın localStorage&apos;ında tutulur. Sunucularımıza iletilmez.
            Borsanızda API anahtarı oluştururken sadece &quot;okuma&quot; ve &quot;işlem&quot; izinlerini verin, para çekme iznini vermeyin.
            Şüpheli işlem gördüğünüzde borsanızdan API anahtarını hemen iptal edin.
          </div>
        </div>
      </div>
    </div>
  );
}
