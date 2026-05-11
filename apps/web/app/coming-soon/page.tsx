"use client";
import { useState, useEffect } from "react";
import Image from "next/image";

const LAUNCH_DATE = new Date("2026-09-01T00:00:00Z");

function useCountdown(target: Date) {
  const calc = () => {
    const diff = Math.max(0, target.getTime() - Date.now());
    return {
      days:    Math.floor(diff / 86400000),
      hours:   Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    };
  };
  const [t, setT] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setT(calc()), 1000);
    return () => clearInterval(id);
  });
  return t;
}

export default function ComingSoonPage() {
  const { days, hours, minutes, seconds } = useCountdown(LAUNCH_DATE);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [particles] = useState(() => Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    delay: Math.random() * 5,
    duration: Math.random() * 10 + 8,
  })));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) setSubmitted(true);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080A10",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
      fontFamily: "'DM Sans', system-ui, sans-serif",
      padding: "20px",
    }}>
      {/* Animated background grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(212,168,67,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(212,168,67,0.04) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
      }} />

      {/* Glow orb top */}
      <div style={{
        position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)",
        width: 600, height: 400,
        background: "radial-gradient(ellipse, rgba(212,168,67,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Glow orb bottom-left */}
      <div style={{
        position: "absolute", bottom: "-10%", left: "-10%",
        width: 400, height: 400,
        background: "radial-gradient(ellipse, rgba(59,130,246,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Floating particles */}
      {particles.map(p => (
        <div key={p.id} style={{
          position: "absolute",
          left: `${p.x}%`, top: `${p.y}%`,
          width: p.size, height: p.size,
          borderRadius: "50%",
          background: "rgba(212,168,67,0.6)",
          animation: `float ${p.duration}s ${p.delay}s ease-in-out infinite alternate`,
        }} />
      ))}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap');
        @keyframes float {
          from { transform: translateY(0px) scale(1); opacity: 0.4; }
          to   { transform: translateY(-20px) scale(1.3); opacity: 1; }
        }
        @keyframes pulse-border {
          0%, 100% { box-shadow: 0 0 0 0 rgba(212,168,67,0.4); }
          50%       { box-shadow: 0 0 0 12px rgba(212,168,67,0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up-1 { animation: fadeUp 0.7s 0.1s ease both; }
        .fade-up-2 { animation: fadeUp 0.7s 0.3s ease both; }
        .fade-up-3 { animation: fadeUp 0.7s 0.5s ease both; }
        .fade-up-4 { animation: fadeUp 0.7s 0.7s ease both; }
        .fade-up-5 { animation: fadeUp 0.7s 0.9s ease both; }
        .email-input:focus { outline: none; border-color: rgba(212,168,67,0.6) !important; box-shadow: 0 0 0 3px rgba(212,168,67,0.1); }
        .submit-btn:hover { background: linear-gradient(135deg, #E8C853, #B88A30) !important; transform: translateY(-1px); }
        .submit-btn:active { transform: translateY(0); }
        @media (max-width: 480px) {
          .countdown-grid { gap: 12px !important; }
          .countdown-box { min-width: 64px !important; padding: 14px 10px !important; }
          .headline { font-size: 36px !important; }
        }
      `}</style>

      {/* Main card */}
      <div style={{ position: "relative", zIndex: 10, maxWidth: 680, width: "100%", textAlign: "center" }}>

        {/* Logo */}
        <div className="fade-up-1" style={{ marginBottom: 32, display: "flex", justifyContent: "center" }}>
          <div style={{
            position: "relative",
            display: "inline-block",
            animation: "pulse-border 3s ease-in-out infinite",
            borderRadius: "50%",
          }}>
            <div style={{
              width: 88, height: 88, borderRadius: "50%",
              background: "linear-gradient(135deg, rgba(212,168,67,0.15), rgba(212,168,67,0.05))",
              border: "2px solid rgba(212,168,67,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(10px)",
            }}>
              <Image src="/ayc-logo.png" alt="AYC Global Market" width={64} height={64}
                style={{ borderRadius: "50%", objectFit: "contain" }}
                onError={() => {}} />
            </div>
          </div>
        </div>

        {/* Badge */}
        <div className="fade-up-1" style={{ marginBottom: 20, display: "flex", justifyContent: "center" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 16px", borderRadius: 100,
            border: "1px solid rgba(212,168,67,0.3)",
            background: "rgba(212,168,67,0.06)",
            fontSize: 12, fontWeight: 600, letterSpacing: "0.1em",
            color: "#D4A843", textTransform: "uppercase",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#D4A843", display: "inline-block", animation: "pulse-border 2s ease-in-out infinite" }} />
            Test Aşaması
          </span>
        </div>

        {/* Headline */}
        <h1 className="fade-up-2 headline" style={{
          fontSize: 56, fontWeight: 800, lineHeight: 1.1,
          fontFamily: "'Syne', sans-serif",
          background: "linear-gradient(135deg, #F0F2F8 0%, #D4A843 50%, #F0F2F8 100%)",
          backgroundSize: "200% auto",
          animation: "shimmer 4s linear infinite",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          marginBottom: 16,
        }}>
          Çok Yakında
        </h1>

        {/* Tagline */}
        <p className="fade-up-2" style={{
          fontSize: 18, color: "#9BA3BA", lineHeight: 1.6,
          marginBottom: 8, fontWeight: 400,
        }}>
          AYC Global Market
        </p>
        <p className="fade-up-3" style={{
          fontSize: 15, color: "#5C6480", lineHeight: 1.7,
          marginBottom: 48, maxWidth: 480, margin: "0 auto 48px",
        }}>
          Yapay zeka destekli global piyasa analiz platformu.<br />
          Hisse, kripto, emtia ve forex piyasalarını tek ekranda takip et.
        </p>

        {/* Countdown */}
        <div className="fade-up-3 countdown-grid" style={{
          display: "flex", justifyContent: "center", gap: 16,
          marginBottom: 52, flexWrap: "wrap",
        }}>
          {[
            { label: "Gün",    value: days },
            { label: "Saat",   value: hours },
            { label: "Dakika", value: minutes },
            { label: "Saniye", value: seconds },
          ].map(({ label, value }) => (
            <div key={label} className="countdown-box" style={{
              minWidth: 80, padding: "18px 14px",
              background: "linear-gradient(135deg, rgba(17,20,32,0.9), rgba(12,14,22,0.9))",
              border: "1px solid rgba(212,168,67,0.15)",
              borderRadius: 16, backdropFilter: "blur(10px)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}>
              <div style={{
                fontSize: 36, fontWeight: 700,
                fontFamily: "'IBM Plex Mono', monospace",
                color: "#D4A843", lineHeight: 1,
                marginBottom: 6,
              }}>
                {String(value).padStart(2, "0")}
              </div>
              <div style={{ fontSize: 11, color: "#5C6480", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Email waitlist */}
        <div className="fade-up-4" style={{ marginBottom: 48 }}>
          {!submitted ? (
            <form onSubmit={handleSubmit} style={{
              display: "flex", gap: 10, maxWidth: 440, margin: "0 auto",
              flexWrap: "wrap", justifyContent: "center",
            }}>
              <input
                type="email"
                placeholder="E-posta adresinizi girin"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="email-input"
                style={{
                  flex: 1, minWidth: 220, padding: "13px 18px",
                  background: "rgba(17,20,32,0.8)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12, color: "#F0F2F8", fontSize: 14,
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
              />
              <button type="submit" className="submit-btn" style={{
                padding: "13px 24px",
                background: "linear-gradient(135deg, #D4A843, #B88A30)",
                border: "none", borderRadius: 12, cursor: "pointer",
                color: "#0C0E16", fontWeight: 700, fontSize: 14,
                transition: "all 0.2s", whiteSpace: "nowrap",
              }}>
                Erken Erişim
              </button>
            </form>
          ) : (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "14px 24px", borderRadius: 12,
              background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
              color: "#22C55E", fontSize: 14, fontWeight: 500,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Kaydınız alındı! Yayına geçtiğimizde sizi bilgilendireceğiz.
            </div>
          )}
        </div>

        {/* Features teaser */}
        <div className="fade-up-4" style={{
          display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12,
          marginBottom: 48,
        }}>
          {[
            "Anlık Fiyat Takibi",
            "AI Sinyal Motoru",
            "Kalkan Risk Koruması",
            "Haber Analizi",
            "Çoklu AI Modeli",
            "Kişisel Portföy",
          ].map(feat => (
            <span key={feat} style={{
              padding: "7px 14px", borderRadius: 100,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              fontSize: 12, color: "#9BA3BA", fontWeight: 500,
            }}>
              {feat}
            </span>
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(212,168,67,0.2), transparent)", marginBottom: 28 }} />

        {/* Footer */}
        <p className="fade-up-5" style={{ fontSize: 12, color: "#3A4060" }}>
          © 2026 AYC Global Market — Tüm hakları saklıdır
        </p>
      </div>
    </div>
  );
}
