"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { saveAuth, startGuestDemo } from "@/lib/auth";
import { Eye, EyeOff, Zap, Shield, TrendingUp, Wallet, ChevronRight, CheckCircle2 } from "lucide-react";

export default function SignUpPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const router = useRouter();

  /* â”€â”€ Guest demo (no registration) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function handleGuestDemo() {
    startGuestDemo();
    localStorage.setItem("ayc_show_welcome", "1");
    router.push("/dashboard?welcome=1");
  }

  /* â”€â”€ Registration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    if (!email || !password || !name) {
      setError("TÃ¼m alanlar gerekli");
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setError("Åifre en az 6 karakter olmalÄ±");
      setLoading(false);
      return;
    }
    try {
      const r = await api.post("/auth/register", { email, password, name });
      saveAuth(
        {
          access_token: r.data?.access_token || "",
          refresh_token: r.data?.refresh_token || "",
          credential_token: r.data?.credential_token,
        },
        r.data?.user || { id: "", email, display_name: name, tier: "free", language: "tr", risk_level: "medium" }
      );
      localStorage.setItem("ayc_show_welcome", "1");
      router.push("/dashboard?welcome=1");
    } catch (err: any) {
      if (!err?.response) {
        setError("BaÄŸlantÄ± hatasÄ± â€” internet baÄŸlantÄ±nÄ±zÄ± kontrol edin.");
      } else {
        setError(err.response?.data?.detail || `KayÄ±t baÅŸarÄ±sÄ±z (${err.response?.status || "hata"}), tekrar deneyin.`);
      }
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight:"100vh", background:"var(--bg)",
      display:"flex", alignItems:"center", justifyContent:"center",
      padding:"20px 16px",
    }}>
      <div style={{width:"100%", maxWidth:440}}>

        {/* â”€â”€ Logo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div style={{textAlign:"center", marginBottom:28}}>
          <div style={{
            display:"inline-flex", alignItems:"center", justifyContent:"center",
            width:56, height:56, borderRadius:16,
            background:"linear-gradient(135deg,var(--gold),#B88A30)",
            marginBottom:14, boxShadow:"var(--shadow-gold)",
          }}>
            <span style={{color:"#0C0E16", fontWeight:900, fontSize:24, fontFamily:"var(--font-head)"}}>A</span>
          </div>
          <div style={{fontSize:22, fontWeight:800, color:"var(--t1)", fontFamily:"var(--font-head)"}}>AYC Global Market</div>
          <div style={{fontSize:13, color:"var(--t3)", marginTop:4}}>Ãœcretsiz hesabÄ±nÄ±zÄ± oluÅŸturun</div>
        </div>

        {/* â”€â”€ Demo CTA Banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div style={{
          background:"linear-gradient(135deg,rgba(212,175,55,0.12),rgba(212,175,55,0.04))",
          border:"1px solid var(--gold-border)", borderRadius:"var(--r-xl)",
          padding:"18px 20px", marginBottom:20,
          display:"flex", flexDirection:"column", gap:12,
        }}>
          <div style={{display:"flex", alignItems:"flex-start", gap:12}}>
            <div style={{
              width:40, height:40, borderRadius:10, flexShrink:0,
              background:"var(--gold-dim)", display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <Wallet size={20} color="var(--gold)" />
            </div>
            <div>
              <div style={{fontSize:14, fontWeight:800, color:"var(--gold)", marginBottom:4}}>
                $10.000 Sanal Bakiye â€” Tamamen Ãœcretsiz
              </div>
              <div style={{fontSize:12, color:"var(--t3)", lineHeight:1.5}}>
                Para yatÄ±rmadan piyasalarÄ± dene. GerÃ§ek fiyatlarla iÅŸlem simÃ¼lasyonu yap.
              </div>
            </div>
          </div>
          {[
            "KayÄ±t olmadan anÄ±nda baÅŸla",
            "TÃ¼m piyasalara canlÄ± fiyatlarla eriÅŸim",
            "AI sinyal ve risk analizi",
            "PortfÃ¶y simÃ¼lasyonu",
          ].map((t,i) => (
            <div key={i} style={{display:"flex", alignItems:"center", gap:8}}>
              <CheckCircle2 size={13} color="var(--up)" />
              <span style={{fontSize:12, color:"var(--t2)"}}>{t}</span>
            </div>
          ))}
          <button
            onClick={handleGuestDemo}
            style={{
              width:"100%", padding:"11px", marginTop:4,
              background:"linear-gradient(135deg,var(--gold),#B88A30)",
              border:"none", borderRadius:"var(--r-md)",
              color:"#0C0E16", fontWeight:800, fontSize:14,
              cursor:"pointer", fontFamily:"var(--font-body)",
              display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              boxShadow:"0 4px 20px rgba(212,175,55,0.3)",
            }}
          >
            <Zap size={15} /> Hemen Demo BaÅŸlat
            <ChevronRight size={15} />
          </button>
          <div style={{textAlign:"center", fontSize:11, color:"var(--t4)"}}>
            Kredi kartÄ± yok Â· YÃ¼kleme yok Â· AnÄ±nda eriÅŸim
          </div>
        </div>

        {/* â”€â”€ Divider â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div style={{display:"flex", alignItems:"center", gap:12, marginBottom:20}}>
          <div style={{flex:1, height:1, background:"var(--b1)"}} />
          <span style={{fontSize:11, color:"var(--t4)", whiteSpace:"nowrap"}}>veya kalÄ±cÄ± hesap oluÅŸtur</span>
          <div style={{flex:1, height:1, background:"var(--b1)"}} />
        </div>

        {/* â”€â”€ Register Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div style={{
          background:"var(--bg-card)", border:"1px solid var(--b1)",
          borderRadius:"var(--r-xl)", padding:"24px 28px",
        }}>
          <div style={{fontSize:15, fontWeight:700, color:"var(--t1)", marginBottom:20, fontFamily:"var(--font-head)"}}>
            KalÄ±cÄ± Hesap OluÅŸtur
          </div>
          <form onSubmit={handleSubmit} style={{display:"flex", flexDirection:"column", gap:14}}>
            <div>
              <label style={{fontSize:12, color:"var(--t2)", display:"block", marginBottom:6, fontWeight:600}}>Ad Soyad</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="AdÄ±nÄ±z SoyadÄ±nÄ±z" autoComplete="name"
                style={{
                  width:"100%", background:"var(--bg)", border:"1px solid var(--b1)",
                  borderRadius:"var(--r-sm)", padding:"10px 14px", fontSize:13, color:"var(--t1)",
                  outline:"none", boxSizing:"border-box", fontFamily:"var(--font-body)",
                }}
                onFocus={e => e.currentTarget.style.borderColor = "var(--gold-border)"}
                onBlur={e => e.currentTarget.style.borderColor = "var(--b1)"}
              />
            </div>
            <div>
              <label style={{fontSize:12, color:"var(--t2)", display:"block", marginBottom:6, fontWeight:600}}>E-posta</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="ornek@mail.com" autoComplete="email"
                style={{
                  width:"100%", background:"var(--bg)", border:"1px solid var(--b1)",
                  borderRadius:"var(--r-sm)", padding:"10px 14px", fontSize:13, color:"var(--t1)",
                  outline:"none", boxSizing:"border-box", fontFamily:"var(--font-body)",
                }}
                onFocus={e => e.currentTarget.style.borderColor = "var(--gold-border)"}
                onBlur={e => e.currentTarget.style.borderColor = "var(--b1)"}
              />
            </div>
            <div>
              <label style={{fontSize:12, color:"var(--t2)", display:"block", marginBottom:6, fontWeight:600}}>Åifre</label>
              <div style={{position:"relative"}}>
                <input
                  type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="En az 6 karakter" autoComplete="new-password"
                  style={{
                    width:"100%", background:"var(--bg)", border:"1px solid var(--b1)",
                    borderRadius:"var(--r-sm)", padding:"10px 40px 10px 14px", fontSize:13, color:"var(--t1)",
                    outline:"none", boxSizing:"border-box", fontFamily:"var(--font-body)",
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = "var(--gold-border)"}
                  onBlur={e => e.currentTarget.style.borderColor = "var(--b1)"}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{
                  position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
                  background:"none", border:"none", cursor:"pointer", padding:0,
                }}>
                  {showPass ? <EyeOff size={16} color="var(--t3)" /> : <Eye size={16} color="var(--t3)" />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                padding:"10px 14px", background:"rgba(246,70,93,0.08)",
                border:"1px solid rgba(246,70,93,0.2)", borderRadius:"var(--r-sm)",
                fontSize:12, color:"var(--down)",
              }}>{error}</div>
            )}

            <button type="submit" disabled={loading} style={{
              padding:"11px", background:"var(--bg-hover)",
              border:"1px solid var(--b1)", borderRadius:"var(--r-sm)",
              color:"var(--t1)", fontWeight:700, fontSize:14,
              cursor:loading ? "not-allowed" : "pointer",
              opacity:loading ? 0.7 : 1,
              fontFamily:"var(--font-body)", transition:"all 0.2s",
            }}>
              {loading ? "Kaydediliyor..." : "Hesap OluÅŸtur â€” Ãœcretsiz"}
            </button>

            <div style={{ textAlign:"center", marginTop:8 }}>
              <button
                type="button"
                onClick={async () => {
                  const res = await fetch("/api/v1/auth/login", {
                    method:"POST",
                    headers:{"Content-Type":"application/json"},
                    body: JSON.stringify({ email:"demo@aycmarket.com", password:"AycDemo2026!" }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    localStorage.setItem("ayc_token", data.token);
                    localStorage.setItem("ayc_user", JSON.stringify(data.user));
                    window.location.href = "/dashboard";
                  }
                }}
                style={{
                  background:"none", border:"1px solid var(--b1)", borderRadius:"var(--r-md)",
                  padding:"8px 20px", color:"var(--t3)", fontSize:12, cursor:"pointer",
                  width:"100%",
                }}
              >
                Demo ile HÄ±zlÄ± GiriÅŸ â†’
              </button>
            </div>
          </form>

          <div style={{textAlign:"center", marginTop:16, fontSize:12, color:"var(--t3)"}}>
            Zaten hesabÄ±n var mÄ±?{" "}
            <Link href="/signin" style={{color:"var(--gold)", textDecoration:"none", fontWeight:600}}>
              GiriÅŸ Yap
            </Link>
          </div>
        </div>

        <p style={{textAlign:"center", fontSize:11, color:"var(--t4)", marginTop:14, lineHeight:1.5}}>
          Bu platform yatÄ±rÄ±m tavsiyesi vermez. Demo hesabÄ± eÄŸitim amaÃ§lÄ±dÄ±r.
        </p>
      </div>
    </div>
  );
}

