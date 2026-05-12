"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { saveAuth, startGuestDemo } from "@/lib/auth";
import { Eye, EyeOff, Zap, ChevronRight, Wallet } from "lucide-react";

export default function SignInPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const router = useRouter();

  function handleGuestDemo() {
    startGuestDemo();
    router.push("/dashboard");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    if (!email || !password) { setError("E-posta ve sifre gerekli"); setLoading(false); return; }
    try {
      const r = await api.post("/auth/login", { email, password });
      saveAuth(
        {
          access_token: r.data?.access_token || "",
          refresh_token: r.data?.refresh_token || "",
          credential_token: r.data?.credential_token,
        },
        r.data?.user || { id: "", email, display_name: email.split("@")[0], tier: "free", language: "tr", risk_level: "medium" }
      );
      router.push("/dashboard");
    } catch (err: any) {
      if (!err?.response) {
        setError("Baglanti hatasi - internet baglantinizi kontrol edin.");
      } else {
        setError(err.response?.data?.detail || "Giris basarisiz - e-posta ve sifrenizi kontrol edin.");
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
      <div style={{width:"100%", maxWidth:420}}>

        {/* Logo */}
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
          <div style={{fontSize:13, color:"var(--t3)", marginTop:4}}>Hesabiniza giris yapin</div>
        </div>

        {/* Demo Banner */}
        <div style={{
          background:"linear-gradient(135deg,rgba(212,175,55,0.1),rgba(212,175,55,0.03))",
          border:"1px solid var(--gold-border)", borderRadius:"var(--r-xl)",
          padding:"14px 16px", marginBottom:20,
        }}>
          <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:10}}>
            <Wallet size={16} color="var(--gold)" />
            <span style={{fontSize:13, fontWeight:700, color:"var(--gold)"}}>$10.000 Demo Hesabi - Hemen Dene</span>
          </div>
          <p style={{fontSize:12, color:"var(--t3)", margin:0, marginBottom:10, lineHeight:1.5}}>
            Giris yapmadan, para yatirmadan tum ozellikleri kesfet.
          </p>
          <button onClick={handleGuestDemo} style={{
            width:"100%", padding:"10px",
            background:"linear-gradient(135deg,var(--gold),#B88A30)",
            border:"none", borderRadius:"var(--r-sm)",
            color:"#0C0E16", fontWeight:800, fontSize:13,
            cursor:"pointer", fontFamily:"var(--font-body)",
            display:"flex", alignItems:"center", justifyContent:"center", gap:6,
            boxShadow:"0 4px 16px rgba(212,175,55,0.25)",
          }}>
            <Zap size={14} /> Demo Hesabiyla Devam Et
            <ChevronRight size={13} />
          </button>
        </div>

        {/* Divider */}
        <div style={{display:"flex", alignItems:"center", gap:12, marginBottom:20}}>
          <div style={{flex:1, height:1, background:"var(--b1)"}} />
          <span style={{fontSize:11, color:"var(--t4)"}}>gercek hesapla giris yap</span>
          <div style={{flex:1, height:1, background:"var(--b1)"}} />
        </div>

        {/* Login Form */}
        <div style={{
          background:"var(--bg-card)", border:"1px solid var(--b1)",
          borderRadius:"var(--r-xl)", padding:"24px 28px",
        }}>
          <form onSubmit={handleSubmit} style={{display:"flex", flexDirection:"column", gap:14}}>
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
              <div style={{display:"flex", justifyContent:"space-between", marginBottom:6}}>
                <label style={{fontSize:12, color:"var(--t2)", fontWeight:600}}>Sifre</label>
                <span style={{fontSize:11, color:"var(--gold)", cursor:"pointer"}}>Sifremi unuttum</span>
              </div>
              <div style={{position:"relative"}}>
                <input
                  type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Sifrenizi girin" autoComplete="current-password"
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
              {loading ? "Giris yapiliyor..." : "Giris Yap"}
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
                Demo ile Hizli Giris 
              </button>
            </div>
          </form>

          <div style={{textAlign:"center", marginTop:16, fontSize:12, color:"var(--t3)"}}>
            Hesabin yok mu?{" "}
            <Link href="/signup" style={{color:"var(--gold)", textDecoration:"none", fontWeight:600}}>
              Ucretsiz Kayit Ol
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

