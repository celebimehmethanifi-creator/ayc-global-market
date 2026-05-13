"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Home, Wallet, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { saveAuth, startGuestDemo } from "@/lib/auth";

function resolveReturnTo(raw: string | null): string {
  if (!raw) return "/dashboard";
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("/")) return "/dashboard";
  if (decoded.startsWith("//")) return "/dashboard";
  return decoded;
}

export default function SignInPage() {
  const router = useRouter();
  const [returnTo, setReturnTo] = useState("/dashboard");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextPath = resolveReturnTo(new URLSearchParams(window.location.search).get("returnTo"));
    setReturnTo(nextPath);
  }, []);

  const goAfterAuth = () => {
    router.push(returnTo || "/dashboard");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!email || !password) {
      setError("E-posta ve şifre gerekli.");
      setLoading(false);
      return;
    }

    try {
      const res = await api.post("/auth/login", { email, password });
      saveAuth(
        {
          access_token: res.data?.access_token || "",
          refresh_token: res.data?.refresh_token || "",
        },
        res.data?.user || {
          id: "",
          email,
          display_name: email.split("@")[0],
          tier: "free",
          language: "tr",
          risk_level: "medium",
        },
      );
      goAfterAuth();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Giriş başarısız.");
    } finally {
      setLoading(false);
    }
  };

  const signupHref = `/signup${returnTo !== "/dashboard" ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "calc(env(safe-area-inset-top, 0px) + 20px) 16px calc(env(safe-area-inset-bottom, 0px) + 20px)",
        background: "var(--bg)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: "1px solid var(--b1)",
              background: "var(--bg-card)",
              color: "var(--t2)",
              borderRadius: 8,
              padding: "7px 10px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <ArrowLeft size={13} /> Geri
          </button>

          <button
            type="button"
            onClick={() => router.push("/")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: "1px solid var(--b1)",
              background: "var(--bg-card)",
              color: "var(--t2)",
              borderRadius: 8,
              padding: "7px 10px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <Home size={13} /> Kapat
          </button>
        </div>

        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <h1 style={{ margin: 0, color: "var(--t1)", fontFamily: "var(--font-head)" }}>AYC Global Market</h1>
          <p style={{ marginTop: 6, color: "var(--t3)", fontSize: 13 }}>Hesabınıza giriş yapın</p>
        </div>

        <div
          style={{
            border: "1px solid var(--gold-border)",
            background: "rgba(245,158,11,0.10)",
            borderRadius: "var(--r-lg)",
            padding: 14,
            marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Wallet size={15} color="var(--gold)" />
            <strong style={{ color: "var(--gold)", fontSize: 13 }}>$10.000 Demo Hesap</strong>
          </div>
          <button
            onClick={() => {
              startGuestDemo();
              goAfterAuth();
            }}
            style={{
              width: "100%",
              padding: "10px 0",
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(135deg,var(--gold),#b88a30)",
              color: "#111827",
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Zap size={14} /> Demo ile devam et
          </button>
        </div>

        <form
          onSubmit={submit}
          style={{
            border: "1px solid var(--b1)",
            borderRadius: "var(--r-lg)",
            background: "var(--bg-card)",
            padding: 18,
            display: "grid",
            gap: 12,
          }}
        >
          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 12, color: "var(--t2)" }}>E-posta</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@mail.com"
              autoComplete="email"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--b1)",
                background: "var(--bg)",
                color: "var(--t1)",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 12, color: "var(--t2)" }}>Şifre</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{
                  width: "100%",
                  padding: "10px 40px 10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--b1)",
                  background: "var(--bg)",
                  color: "var(--t1)",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  display: "inline-flex",
                }}
              >
                {showPass ? <EyeOff size={16} color="var(--t3)" /> : <Eye size={16} color="var(--t3)" />}
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid rgba(239,68,68,0.3)",
                background: "rgba(239,68,68,0.1)",
                color: "#fca5a5",
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px 0",
              borderRadius: 8,
              border: "1px solid var(--b1)",
              background: "var(--bg-hover)",
              color: "var(--t1)",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 14, color: "var(--t3)", fontSize: 12 }}>
          Hesabın yok mu?{" "}
          <Link href={signupHref} style={{ color: "var(--gold)", textDecoration: "none" }}>
            Ücretsiz kayıt ol
          </Link>
        </p>
      </div>
    </div>
  );
}

