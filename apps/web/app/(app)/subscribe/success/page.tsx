"use client";
import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { CheckCircle, Crown, Zap, Star, ArrowRight, Loader2 } from "lucide-react";

const PLAN_META: Record<string, any> = {
  free:  { label: "Free",  color: "var(--t3)",  bg:"rgba(255,255,255,0.05)", icon: Star },
  pro:   { label: "Pro",   color: "var(--gold)", bg:"rgba(201,168,76,0.12)", icon: Zap },
  elite: { label: "Elite", color: "#818CF8",     bg:"rgba(129,140,248,0.12)", icon: Crown },
};

function SuccessContent() {
  const params = useSearchParams();
  const router = useRouter();
  const plan       = params.get("plan") || "pro";
  const provider   = params.get("provider") || "stripe";
  const session_id = params.get("session_id") || "";
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (session_id) {
      setVerifying(true);
      api
        .post("/billing/verify", { session_id, plan, provider })
        .then(async (r) => {
          setMessage(r.data?.message || "Plan aktifleştirildi");
          try {
            const me = await api.get("/auth/me");
            const user = me.data?.user;
            if (user) {
              localStorage.setItem(
                "ayc_user",
                JSON.stringify({
                  id: user.id,
                  email: user.email,
                  display_name: user.name || user.email?.split("@")[0] || "",
                  tier: user.tier || user.plan || "free",
                  language: "tr",
                  risk_level: "medium",
                }),
              );
            }
          } catch {
            // no-op: profile cache refresh is best-effort
          }
        })
        .catch(() => {})
        .finally(() => {
          setVerifying(false);
          setVerified(true);
        });
    } else {
      setVerified(true);
    }
  }, []);

  const meta = PLAN_META[plan] || PLAN_META.pro;
  const Icon = meta.icon;
  return (
    <div style={{ minHeight:"60vh", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ maxWidth:480, width:"100%", background:"var(--bg-card)", border:"1px solid var(--b1)", borderRadius:"var(--r-xl)", padding:40, textAlign:"center" }}>
        {verifying ? (
          <>
            <Loader2 size={48} color="var(--gold)" style={{margin:"0 auto 16px"}} />
            <div style={{fontSize:16,fontWeight:700,color:"var(--t1)"}}>Ödeme doğrulanıyor...</div>
          </>
        ) : (
          <>
            <div style={{ width:72, height:72, borderRadius:"50%", background:"rgba(14,203,129,0.12)", border:"2px solid rgba(14,203,129,0.3)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
              <CheckCircle size={36} color="var(--up)" />
            </div>
            <div style={{fontSize:24,fontWeight:900,color:"var(--t1)",marginBottom:8}}>Ödeme Başarılı!</div>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 16px", background:meta.bg, border:`1px solid ${meta.color}40`, borderRadius:20, marginBottom:20 }}>
              <Icon size={14} color={meta.color} />
              <span style={{fontSize:13,fontWeight:700,color:meta.color}}>{meta.label} Plan Aktif</span>
            </div>
            <div style={{fontSize:14,color:"var(--t2)",marginBottom:28,lineHeight:1.6}}>
              {message || `${meta.label} planınız başarıyla aktifleştirildi.`}
            </div>
            <Link href="/dashboard" style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"12px 28px", background:"linear-gradient(135deg,var(--gold),#B88A30)", borderRadius:"var(--r-sm)", color:"#0C0E16", fontWeight:700, fontSize:14, textDecoration:"none" }}>
              Dashboard&apos;a Git <ArrowRight size={16} />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function SubscribeSuccessPage() {
  return (
    <Suspense fallback={<div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"60vh",color:"var(--t3)"}}>Yükleniyor...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
