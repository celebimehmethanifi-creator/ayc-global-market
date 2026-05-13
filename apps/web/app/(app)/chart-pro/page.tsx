"use client";
import { AYCChartTerminal } from "@/components/chart-pro/AYCChartTerminal";
import Link from "next/link";

const DEMO_SYMBOLS = [
  { symbol: "BTCUSDT", label: "Bitcoin", cat: "Kripto" },
  { symbol: "ETHUSDT", label: "Ethereum", cat: "Kripto" },
  { symbol: "XAUUSD", label: "Altin", cat: "Emtia" },
  { symbol: "THYAO.IS", label: "THY", cat: "BIST" },
  { symbol: "GARAN.IS", label: "Garanti", cat: "BIST" },
  { symbol: "USDTRY", label: "USD/TRY", cat: "Forex" },
  { symbol: "SPX", label: "S&P 500", cat: "Endeks" },
];

export default function ChartProPage() {
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#D4AF37", fontFamily: "Syne", margin: 0 }}>
            AYC Chart Pro
          </h1>
          <span style={{
            fontSize: 9, padding: "2px 8px", borderRadius: 4,
            background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.2)",
            color: "#D4AF37", fontFamily: "IBM Plex Mono", fontWeight: 700,
          }}>POC v0.1</span>
        </div>
        <p style={{ fontSize: 13, color: "rgba(232,232,239,0.5)", margin: 0 }}>
          Profesyonel grafik terminali. Teknik indikatorler, cizim araclari ve canli veri.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginBottom: 24 }}>
        {DEMO_SYMBOLS.map(s => (
          <Link key={s.symbol} href={"/chart-pro/" + s.symbol} style={{
            textDecoration: "none", padding: "10px 12px", borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.06)", background: "rgba(17,18,27,0.6)",
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#e8e8ef", fontFamily: "IBM Plex Mono" }}>{s.symbol}</div>
            <div style={{ fontSize: 10, color: "rgba(232,232,239,0.4)", marginTop: 2 }}>{s.label}</div>
            <span style={{ fontSize: 9, color: "#D4AF37", fontFamily: "IBM Plex Mono" }}>{s.cat}</span>
          </Link>
        ))}
      </div>
      <div style={{ height: 600 }}>
        <AYCChartTerminal symbol="BTCUSDT" defaultTimeframe="1H" />
      </div>
    </div>
  );
}