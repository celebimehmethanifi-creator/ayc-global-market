"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Clock3,
  Crown,
  Loader2,
  Star,
  Zap,
} from "lucide-react";

const PLAN_META: Record<string, any> = {
  free: { label: "Free", color: "var(--t3)", bg: "rgba(255,255,255,0.05)", icon: Star },
  pro: { label: "Pro", color: "var(--gold)", bg: "rgba(201,168,76,0.12)", icon: Zap },
  elite: { label: "Elite", color: "#818CF8", bg: "rgba(129,140,248,0.12)", icon: Crown },
};

type VerifyStatus = "verifying" | "verified" | "failed" | "pending";

function updateCachedTier(plan: string | null | undefined) {
  if (!plan || typeof window === "undefined") return;
  if (!["free", "pro", "elite"].includes(plan)) return;
  try {
    const raw = localStorage.getItem("ayc_user");
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    localStorage.setItem(
      "ayc_user",
      JSON.stringify({
        ...parsed,
        tier: plan,
      }),
    );
  } catch {
    // no-op
  }
}

function SuccessContent() {
  const params = useSearchParams();
  const plan = params.get("plan") || "pro";
  const provider = params.get("provider") || "stripe";
  const session_id = params.get("session_id") || "";
  const [status, setStatus] = useState<VerifyStatus>("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let pollCount = 0;

    const pollSubscriptionState = async () => {
      try {
        const [sub, me] = await Promise.all([api.get("/billing/subscription"), api.get("/auth/me")]);
        const subscriptionTier = String(sub.data?.tier || "").toLowerCase();
        const userTier = String(me.data?.user?.tier || me.data?.user?.plan || "").toLowerCase();
        const resolvedTier = subscriptionTier || userTier;
        if (["pro", "elite"].includes(resolvedTier) && mounted) {
          updateCachedTier(resolvedTier);
          setStatus("verified");
          setMessage("Abonelik webhook ile doğrulandı ve planınız aktifleşti.");
          if (pollTimer) clearInterval(pollTimer);
        }
      } catch {
        // no-op
      }
    };

    const startPolling = () => {
      pollTimer = setInterval(() => {
        pollCount += 1;
        if (pollCount > 6) {
          if (pollTimer) clearInterval(pollTimer);
          return;
        }
        pollSubscriptionState().catch(() => {});
      }, 5000);
    };

    async function run() {
      if (!session_id) {
        if (!mounted) return;
        setStatus("pending");
        setMessage("Ödemeniz alındıysa abonelik webhook ile doğrulanacak, lütfen hesabınızı kontrol edin.");
        startPolling();
        return;
      }

      setStatus("verifying");
      try {
        const r = await api.post("/billing/verify", { session_id, plan, provider });
        const resolvedPlan = String(r.data?.plan || "").toLowerCase();
        if (!mounted) return;
        updateCachedTier(resolvedPlan);
        setMessage(r.data?.message || "Plan aktifleştirildi");
        setStatus("verified");
      } catch (error: any) {
        const statusCode = Number(error?.response?.status || 0);
        if (!mounted) return;
        if (statusCode === 400 || statusCode === 403) {
          setStatus("pending");
          setMessage(
            "Ödeme doğrulaması henüz tamamlanmadı. Plan güncellemesi webhook sonrası hesabınıza yansıyacaktır.",
          );
          startPolling();
          return;
        }
        setStatus("failed");
        setMessage("Ödeme doğrulanırken hata oluştu. Lütfen daha sonra tekrar kontrol edin.");
      }
    }

    run().catch(() => {
      if (!mounted) return;
      setStatus("failed");
      setMessage("Ödeme doğrulaması başlatılamadı.");
    });

    return () => {
      mounted = false;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [session_id, plan, provider]);

  const meta = PLAN_META[plan] || PLAN_META.pro;
  const Icon = meta.icon;

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          background: "var(--bg-card)",
          border: "1px solid var(--b1)",
          borderRadius: "var(--r-xl)",
          padding: 40,
          textAlign: "center",
        }}
      >
        {status === "verifying" ? (
          <>
            <Loader2 size={48} color="var(--gold)" style={{ margin: "0 auto 16px" }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>Ödeme doğrulanıyor...</div>
          </>
        ) : status === "pending" ? (
          <>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(245,158,11,0.12)",
                border: "2px solid rgba(245,158,11,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <Clock3 size={34} color="var(--gold)" />
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "var(--t1)", marginBottom: 8 }}>Doğrulama Bekleniyor</div>
            <div style={{ fontSize: 14, color: "var(--t2)", marginBottom: 28, lineHeight: 1.6 }}>{message}</div>
            <Link
              href="/account"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 28px",
                background: "linear-gradient(135deg,var(--gold),#B88A30)",
                borderRadius: "var(--r-sm)",
                color: "#0C0E16",
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Hesabımı Kontrol Et <ArrowRight size={16} />
            </Link>
          </>
        ) : status === "failed" ? (
          <>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(239,68,68,0.12)",
                border: "2px solid rgba(239,68,68,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <AlertCircle size={34} color="#ef4444" />
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "var(--t1)", marginBottom: 8 }}>Doğrulama Başarısız</div>
            <div style={{ fontSize: 14, color: "var(--t2)", marginBottom: 28, lineHeight: 1.6 }}>{message}</div>
            <Link
              href="/subscribe"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 28px",
                background: "linear-gradient(135deg,var(--gold),#B88A30)",
                borderRadius: "var(--r-sm)",
                color: "#0C0E16",
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Aboneliğe Dön <ArrowRight size={16} />
            </Link>
          </>
        ) : (
          <>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(14,203,129,0.12)",
                border: "2px solid rgba(14,203,129,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <CheckCircle size={36} color="var(--up)" />
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "var(--t1)", marginBottom: 8 }}>Ödeme Başarılı!</div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 16px",
                background: meta.bg,
                border: `1px solid ${meta.color}40`,
                borderRadius: 20,
                marginBottom: 20,
              }}
            >
              <Icon size={14} color={meta.color} />
              <span style={{ fontSize: 13, fontWeight: 700, color: meta.color }}>{meta.label} Plan Aktif</span>
            </div>
            <div style={{ fontSize: 14, color: "var(--t2)", marginBottom: 28, lineHeight: 1.6 }}>
              {message || `${meta.label} planınız başarıyla aktifleştirildi.`}
            </div>
            <Link
              href="/dashboard"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 28px",
                background: "linear-gradient(135deg,var(--gold),#B88A30)",
                borderRadius: "var(--r-sm)",
                color: "#0C0E16",
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
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
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            color: "var(--t3)",
          }}
        >
          Yükleniyor...
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
