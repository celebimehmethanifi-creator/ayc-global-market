"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Wallet, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { saveAuth, startGuestDemo } from "@/lib/auth";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!name || !email || !password) {
      setError("Tüm alanlar gerekli.");
      setLoading(false);
      return;
    }
    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalı.");
      setLoading(false);
      return;
    }

    try {
      const res = await api.post("/auth/register", { name, email, password });
      saveAuth(
        {
          access_token: res.data?.access_token || "",
          refresh_token: res.data?.refresh_token || "",
        },
        res.data?.user || {
          id: "",
          email,
          display_name: name,
          tier: "free",
          language: "tr",
          risk_level: "medium",
        },
      );
      localStorage.setItem("ayc_show_welcome", "1");
      router.push("/dashboard?welcome=1");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Kayıt başarısız.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 16px",
        background: "var(--bg)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{ margin: 0, color: "var(--t1)" }}>AYC Global Market</h1>
          <p style={{ marginTop: 6, color: "var(--t3)", fontSize: 13 }}>Ücretsiz hesap oluştur</p>
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
              localStorage.setItem("ayc_show_welcome", "1");
              router.push("/dashboard?welcome=1");
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
            <Zap size={14} /> Demo ile başla
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
            <label style={{ display: "block", marginBottom: 6, fontSize: 12, color: "var(--t2)" }}>Ad Soyad</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ad Soyad"
              autoComplete="name"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--b1)",
                background: "var(--bg)",
                color: "var(--t1)",
              }}
            />
          </div>

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
                autoComplete="new-password"
                style={{
                  width: "100%",
                  padding: "10px 40px 10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--b1)",
                  background: "var(--bg)",
                  color: "var(--t1)",
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
            {loading ? "Kayıt yapılıyor..." : "Hesap oluştur"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 14, color: "var(--t3)", fontSize: 12 }}>
          Zaten hesabın var mı?{" "}
          <Link href="/signin" style={{ color: "var(--gold)", textDecoration: "none" }}>
            Giriş yap
          </Link>
        </p>
      </div>
    </div>
  );
}
