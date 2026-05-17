"use client";
import { useDemo } from "@/lib/demo/DemoContext";
import { FlaskConical, TrendingUp, TrendingDown, Sparkles, ChevronRight } from "lucide-react";
import Link from "next/link";

export function DemoBanner() {
  const { totalValue, totalPnlUSD, totalPnlPct, demo } = useDemo();
  const up = totalPnlUSD >= 0;
  const fmt = (n: number, d = 2) =>
    n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(245,158,11,0.10) 0%, rgba(16,185,129,0.07) 100%)",
      border: "1px solid rgba(245,158,11,0.28)",
      borderRadius: 12,
      padding: "14px 18px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 24,
      flexWrap: "wrap",
    }}>
      {/* Left */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: "rgba(245,158,11,0.15)",
          border: "1px solid rgba(245,158,11,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <FlaskConical size={18} color="#f59e0b" />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: "#f59e0b" }}>
              EĞİTİM HESABI
            </span>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
              background: "rgba(245,158,11,0.2)", color: "#f59e0b", letterSpacing: 0.5,
            }}>ÜCRETSİZ</span>
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
            Eğitim hesabı · $10.000 sanal bakiye ile piyasaları inceleyin
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.72)", marginTop: 4 }}>
            Bu demo bakiyedir, gerçek para değildir. Demo işlemler eğitim amaçlıdır.
          </div>
        </div>
      </div>

      {/* Center: balance */}
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>
            DEMO BAKİYE
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "var(--font-mono)", color: "#fff" }}>
            ${fmt(totalValue)}
          </div>
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: up ? "var(--up)" : "var(--down)",
            display: "flex", alignItems: "center", gap: 3, justifyContent: "center", marginTop: 1
          }}>
            {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {up ? "+" : ""}{fmt(totalPnlUSD)} ({up ? "+" : ""}{fmt(totalPnlPct)}%)
          </div>
        </div>

        {demo.openTrades.length > 0 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>
              AÇIK POZİSYON
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "var(--font-mono)", color: "var(--gold)" }}>
              {demo.openTrades.length}
            </div>
          </div>
        )}
      </div>

      {/* Right: CTA */}
      <Link href="/subscribe" style={{ textDecoration: "none" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
          background: "linear-gradient(135deg, #f59e0b, #d97706)",
          borderRadius: 10, cursor: "pointer",
          boxShadow: "0 4px 12px rgba(245,158,11,0.3)",
        }}>
          <Sparkles size={14} color="#fff" />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
            Gerçek Hesap Aç
          </span>
          <ChevronRight size={14} color="#fff" />
        </div>
      </Link>
    </div>
  );
}
