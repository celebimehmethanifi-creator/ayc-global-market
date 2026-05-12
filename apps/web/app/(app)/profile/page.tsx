"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  User, Shield, Bell, CreditCard, Globe, ChevronRight,
  Trash2, Check, Lock, Star, Zap, Crown, LogOut
} from "lucide-react";

const PLAN_META = {
  free:  {label:"Free",  color:"rgba(255,255,255,0.5)", bg:"rgba(255,255,255,0.05)",  icon:User,  badge:""},
  pro:   {label:"Pro",   color:"#8b5cf6",               bg:"rgba(139,92,246,0.12)",   icon:Zap,   badge:"POPULER"},
  elite: {label:"Elite", color:"#f59e0b",               bg:"rgba(245,158,11,0.12)",   icon:Crown, badge:"PREMIUM"},
};

const PLAN_FEATURES = {
  free:  ["Günlük 5 sinyal","Temel analiz","1 portföy"],
  pro:   ["Sınırsız sinyal","AI Copilot","3 portföy","Gerçek zamanlı veri","Alarm merkezi"],
  elite: ["Her şey dahil","Özel AI modeli","API erişimi","Öncelikli destek","Kalkan Pro"],
};

const TABS = [
  {id:"profile", labelKey:"nav.profile",            icon:User},
  {id:"security",labelKey:"profile.security",       icon:Shield},
  {id:"notif",   labelKey:"profile.notifications",  icon:Bell},
  {id:"plan",    labelKey:"profile.subscription",   icon:CreditCard},
];

const RISK_LEVELS = [
  {value:"low",    labelKey:"profile.risk.low",    desc:"Muhafazakar, sermaye koruma öncelikli", color:"#10b981", tone:"16,185,129"},
  {value:"medium", labelKey:"profile.risk.medium", desc:"Dengeli risk/getiri profili",            color:"#f59e0b", tone:"245,158,11"},
  {value:"high",   labelKey:"profile.risk.high",   desc:"Agresif, yüksek getiri odaklı",           color:"#ef4444", tone:"239,68,68"},
];

export default function ProfilePage() {
  const { locale, setLocale, t } = useI18n();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("profile");
  const [displayName, setDisplayName] = useState("");
  const [language, setLanguage] = useState(locale);
  const [riskLevel, setRiskLevel] = useState("medium");
  const [maxDrawdown, setMaxDrawdown] = useState("10");
  const [saved, setSaved] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get("/auth/me").then(r => r.data.user).catch(() => null),
  });

  const updateMutation = useMutation({
    mutationFn: (body: any) => api.put("/auth/me", body).catch(() => ({data:{}})),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  useEffect(() => {
    setLanguage(locale);
  }, [locale]);

  useEffect(() => {
    if (!profile) return;
    if (typeof profile.display_name === "string") setDisplayName(profile.display_name);
    if (typeof profile.language === "string") {
      const normalized = profile.language === "en" ? "en" : "tr";
      setLanguage(normalized);
      setLocale(normalized);
    }
    if (typeof profile.risk_level === "string") setRiskLevel(profile.risk_level);
  }, [profile, setLocale]);

  const tier = profile?.tier || "free";
  const planMeta = PLAN_META[tier as keyof typeof PLAN_META] || PLAN_META.free;
  const username = profile?.display_name || profile?.email || "Kullanıcı";
  const initial = username[0].toUpperCase();

  return (
    <div className="profile-layout">

      {/* Left Sidebar */}
      <div className="profile-sidebar">
        {/* Avatar */}
        <div style={{
          background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",
          borderRadius:18,padding:20,textAlign:"center",marginBottom:4
        }}>
          <div style={{
            width:64,height:64,borderRadius:18,margin:"0 auto 12px",
            background:"linear-gradient(135deg,var(--primary),var(--accent))",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:26,fontWeight:800,color:"#fff",letterSpacing:-1
          }}>{initial}</div>
          <div style={{fontSize:14,fontWeight:700,color:"#fff"}}>{username}</div>
          <div style={{
            display:"inline-flex",alignItems:"center",gap:5,marginTop:6,
            padding:"3px 10px",borderRadius:20,background:planMeta.bg,
            fontSize:11,fontWeight:700,color:planMeta.color
          }}>
            <planMeta.icon size={10} />
            {planMeta.label}
          </div>
        </div>

        {/* Nav */}
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
            borderRadius:12,border:"none",cursor:"pointer",textAlign:"left",
            background: activeTab===tab.id ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.03)",
            transition:"all 0.2s",fontFamily:"inherit"
          }}>
            <tab.icon size={15} color={activeTab===tab.id ? "#8b5cf6" : "rgba(255,255,255,0.4)"} />
            <span style={{fontSize:13,fontWeight:600,color: activeTab===tab.id ? "#fff" : "rgba(255,255,255,0.5)"}}>
              {t(tab.labelKey)}
            </span>
            {activeTab===tab.id && <ChevronRight size={12} color="#8b5cf6" style={{marginLeft:"auto"}} />}
          </button>
        ))}

        <div style={{height:1,background:"rgba(255,255,255,0.05)",margin:"4px 0"}} />
        <button style={{
          display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
          borderRadius:12,border:"none",cursor:"pointer",
          background:"rgba(239,68,68,0.05)",fontFamily:"inherit",
          color:"#ef4444",fontSize:13,fontWeight:600
        }}>
          <LogOut size={15} color="#ef4444" />
          {t("auth.logout")}
        </button>
      </div>

<div className="profile-content">
        {/* PROFILE TAB */}
        {activeTab === "profile" && (
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div style={{
              background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:18,padding:24
            }}>
              <div style={{fontSize:14,fontWeight:700,color:"#fff",marginBottom:20}}>{t("profile.personal")}</div>
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                <div>
                  <label style={{fontSize:12,color:"rgba(255,255,255,0.4)",display:"block",marginBottom:6}}>{t("profile.displayName")}</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    style={{
                      width:"100%",background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.1)",
                      borderRadius:10,padding:"10px 14px",fontSize:13,color:"#fff",
                      outline:"none",boxSizing:"border-box",fontFamily:"inherit"
                    }}
                    onFocus={e => e.target.style.borderColor="rgba(139,92,246,0.5)"}
                    onBlur={e => e.target.style.borderColor="rgba(255,255,255,0.1)"}
                    placeholder={t("profile.displayNamePlaceholder")}
                  />
                </div>
                <div>
                  <label style={{fontSize:12,color:"rgba(255,255,255,0.4)",display:"block",marginBottom:6}}>{t("profile.email")}</label>
                  <input
                    type="email"
                    defaultValue={profile?.email || "trader@ayc.com"}
                    disabled
                    style={{
                      width:"100%",background:"rgba(0,0,0,0.2)",border:"1px solid rgba(255,255,255,0.06)",
                      borderRadius:10,padding:"10px 14px",fontSize:13,color:"rgba(255,255,255,0.4)",
                      outline:"none",boxSizing:"border-box",cursor:"not-allowed"
                    }}
                  />
                </div>
                <div>
                  <label style={{fontSize:12,color:"rgba(255,255,255,0.4)",display:"block",marginBottom:6}}>{t("profile.language")}</label>
                  <select
                    value={language}
                    onChange={e => {
                      const next = e.target.value === "en" ? "en" : "tr";
                      setLanguage(next);
                      setLocale(next);
                    }}
                    style={{
                      width:"100%",background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.1)",
                      borderRadius:10,padding:"10px 14px",fontSize:13,color:"#fff",
                      outline:"none",boxSizing:"border-box",fontFamily:"inherit",cursor:"pointer"
                    }}
                  >
                    <option value="tr">Türkçe</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>
              <button
                onClick={() => updateMutation.mutate({ display_name: displayName || undefined, language })}
                disabled={updateMutation.isPending}
                style={{
                  marginTop:18,display:"flex",alignItems:"center",gap:8,
                  background: saved ? "rgba(16,185,129,0.15)" : "var(--primary)",
                  border: saved ? "1px solid rgba(16,185,129,0.3)" : "none",
                  borderRadius:10,padding:"10px 20px",cursor:"pointer",
                  color: saved ? "#10b981" : "#fff",fontSize:13,fontWeight:600,fontFamily:"inherit",
                  transition:"all 0.3s"
                }}
              >
                {saved ? <><Check size={14} /> {t("profile.saved")}</> : t("profile.save")}
              </button>
            </div>

            {/* Risk Profile */}
            <div style={{
              background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:18,padding:24
            }}>
              <div style={{fontSize:14,fontWeight:700,color:"#fff",marginBottom:4,display:"flex",alignItems:"center",gap:8}}>
                <Shield size={15} color="var(--primary)" /> Risk Profili
              </div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.35)",marginBottom:18}}>
                Risk toleransınız sinyallerin gösterim sıklığını ve kalkan eşiklerini etkiler
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
                {RISK_LEVELS.map(r => (
                  <button key={r.value} onClick={() => setRiskLevel(r.value)} style={{
                    display:"flex",alignItems:"center",gap:12,padding:"12px 16px",
                    background: riskLevel===r.value ? `rgba(${r.tone},0.1)` : "rgba(255,255,255,0.02)",
                    border: riskLevel===r.value ? `1px solid ${r.color}40` : "1px solid rgba(255,255,255,0.06)",
                    borderRadius:12,cursor:"pointer",textAlign:"left",fontFamily:"inherit",transition:"all 0.2s"
                  }}>
                    <div style={{
                      width:12,height:12,borderRadius:"50%",flexShrink:0,
                      background: riskLevel===r.value ? r.color : "rgba(255,255,255,0.15)",
                      border: riskLevel===r.value ? `3px solid ${r.color}` : "3px solid transparent",
                      transition:"all 0.2s"
                    }} />
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:"#fff"}}>{t(r.labelKey)} Risk</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:2}}>{r.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div>
                <label style={{fontSize:12,color:"rgba(255,255,255,0.4)",display:"block",marginBottom:6}}>Maksimum Drawdown Eşiği</label>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <input type="range" min="2" max="30" value={maxDrawdown}
                    onChange={e => setMaxDrawdown(e.target.value)}
                    style={{flex:1,accentColor:"var(--primary)"}} />
                  <div style={{
                    minWidth:48,padding:"4px 10px",background:"rgba(239,68,68,0.1)",
                    border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,
                    fontSize:13,fontWeight:700,color:"#ef4444",textAlign:"center"
                  }}>%{maxDrawdown}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECURITY TAB */}
        {activeTab === "security" && (
          <div style={{
            background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:18,padding:24,
            display:"flex",flexDirection:"column",gap:16
          }}>
            <div style={{fontSize:14,fontWeight:700,color:"#fff"}}>Güvenlik Ayarları</div>
            {[
              {label:"Şifre Değiştir",          icon:Lock,  color:"var(--primary)", action:"Değiştir"},
              {label:"İki Faktörlü Doğrulama",  icon:Shield,color:"#10b981",        action:"Aktifleştir"},
              {label:"Aktif Oturumlar",         icon:Globe, color:"#f59e0b",        action:"Görüntüle"},
            ].map(item => (
              <div key={item.label} style={{
                display:"flex",alignItems:"center",gap:14,padding:"14px 16px",
                background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14
              }}>
                <div style={{
                  width:38,height:38,borderRadius:10,background:"rgba(255,255,255,0.05)",
                  display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0
                }}>
                  <item.icon size={16} color={item.color} />
                </div>
                <span style={{flex:1,fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.8)"}}>{item.label}</span>
                <button style={{
                  padding:"6px 14px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",
                  borderRadius:8,cursor:"pointer",color:"rgba(255,255,255,0.6)",fontSize:12,fontFamily:"inherit"
                }}>{item.action}</button>
              </div>
            ))}

            <div style={{height:1,background:"rgba(255,255,255,0.05)",margin:"4px 0"}} />
            <div style={{
              padding:16,background:"rgba(239,68,68,0.05)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:14
            }}>
              <div style={{fontSize:13,fontWeight:700,color:"#ef4444",marginBottom:10}}>Tehlikeli Bölge</div>
              <button style={{
                display:"flex",alignItems:"center",gap:8,padding:"8px 16px",
                background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",
                borderRadius:10,cursor:"pointer",color:"#ef4444",fontSize:12,fontFamily:"inherit"
              }}>
                <Trash2 size={13} /> Hesabı Sil (KVKK)
              </button>
            </div>
          </div>
        )}

        {/* NOTIFICATIONS TAB */}
        {activeTab === "notif" && (
          <div style={{
            background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:18,padding:24
          }}>
            <div style={{fontSize:14,fontWeight:700,color:"#fff",marginBottom:20}}>Bildirim Tercihleri</div>
            {[
              {label:"Yüksek güvenli sinyaller",     desc:"82%+ güven skorlu sinyaller",         on:true,  color:"#10b981"},
              {label:"Kalkan uyarıları",             desc:"Drawdown ve risk uyarıları",           on:true,  color:"#ef4444"},
              {label:"Sabah brifing",                desc:"Her gün saat 08:30 piyasa özeti",      on:true,  color:"#8b5cf6"},
              {label:"Fiyat alarmları",              desc:"Ayarladığınız alarm eşiklerine ulaşım",on:true, color:"#00d4ff"},
              {label:"Makro haberler",               desc:"FED, enflasyon, jeopolitik gelişmeler",on:false,color:"#f59e0b"},
              {label:"Haftalık rapor",               desc:"Pazar akşamı performans özeti",       on:false, color:"#6b7280"},
            ].map((n, i) => (
              <div key={i} style={{
                display:"flex",alignItems:"center",gap:14,padding:"14px 0",
                borderBottom:"1px solid rgba(255,255,255,0.04)"
              }}>
                <div style={{
                  width:8,height:8,borderRadius:"50%",background:n.on ? n.color : "rgba(255,255,255,0.15)",flexShrink:0
                }} />
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:"#fff"}}>{n.label}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:2}}>{n.desc}</div>
                </div>
                <button style={{
                  width:44,height:24,borderRadius:12,border:"none",cursor:"pointer",
                  background: n.on ? n.color : "rgba(255,255,255,0.1)",
                  position:"relative",transition:"background 0.3s"
                }}>
                  <div style={{
                    position:"absolute",top:3,left: n.on ? "calc(100% - 21px)" : 3,
                    width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left 0.3s"
                  }} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* PLAN TAB */}
        {activeTab === "plan" && (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
              {(["free","pro","elite"] as const).map(p => {
                const meta = PLAN_META[p];
                const features = PLAN_FEATURES[p];
                const isActive = tier === p;
                return (
                  <div key={p} style={{
                    background: isActive ? meta.bg : "rgba(255,255,255,0.02)",
                    border: isActive ? `2px solid ${meta.color}40` : "1px solid rgba(255,255,255,0.07)",
                    borderRadius:18,padding:20,position:"relative",overflow:"hidden"
                  }}>
                    {meta.badge && (
                      <div style={{
                        position:"absolute",top:12,right:12,fontSize:9,fontWeight:800,
                        padding:"2px 8px",borderRadius:10,background:meta.bg,color:meta.color,letterSpacing:1
                      }}>{meta.badge}</div>
                    )}
                    {isActive && (
                      <div style={{
                        position:"absolute",top:12,left:12,fontSize:9,fontWeight:800,
                        padding:"2px 8px",borderRadius:10,background:"rgba(16,185,129,0.15)",color:"#10b981",letterSpacing:1
                      }}>AKTİF</div>
                    )}
                    <div style={{marginTop:28,marginBottom:16}}>
                      <meta.icon size={22} color={meta.color} />
                      <div style={{fontSize:18,fontWeight:800,color:meta.color,marginTop:8}}>{meta.label}</div>
                    <div style={{fontSize:22,fontWeight:900,color:"#fff",lineHeight:1,marginTop:4}}>
                        {p==="free" ? "$0" : p==="pro" ? "$9.99" : "$24.99"}
                        {p!=="free" && <span style={{fontSize:12,color:"rgba(255,255,255,0.35)",fontWeight:400}}>/ay</span>}
                      </div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:16}}>
                      {features.map(f => (
                        <div key={f} style={{display:"flex",alignItems:"center",gap:8}}>
                          <Check size={12} color={meta.color} />
                          <span style={{fontSize:12,color:"rgba(255,255,255,0.6)"}}>{f}</span>
                        </div>
                      ))}
                    </div>
                    {!isActive && (
                      <a href="/subscribe" style={{
                        display:"block",textAlign:"center",padding:"9px",
                        background:meta.bg,border:`1px solid ${meta.color}40`,
                        borderRadius:10,color:meta.color,fontSize:12,fontWeight:700,
                        textDecoration:"none",transition:"all 0.2s"
                      }}>{p==="free" ? "Downgrade" : "Upgrade"}</a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
