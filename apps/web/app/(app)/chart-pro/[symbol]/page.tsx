"use client";
import { useParams } from "next/navigation";
import { AYCChartTerminal } from "@/components/chart-pro/AYCChartTerminal";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ChartProSymbolPage() {
  const params = useParams();
  const symbol = (params?.symbol as string) || "BTCUSDT";

  return (
    <div style={{ height: "calc(100vh - 120px)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <Link href="/chart-pro" style={{
          display: "flex", alignItems: "center", gap: 4,
          textDecoration: "none", color: "rgba(232,232,239,0.5)", fontSize: 12, fontWeight: 600,
        }}>
          <ArrowLeft size={14}/> Geri
        </Link>
        <span style={{ fontSize: 16, fontWeight: 800, color: "#D4AF37", fontFamily: "Syne" }}>{symbol}</span>
        <span style={{
          fontSize: 9, padding: "2px 8px", borderRadius: 4,
          background: "rgba(16,185,129,0.1)", color: "#10b981",
          fontFamily: "IBM Plex Mono", fontWeight: 700,
        }}>AYC Chart Pro</span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <AYCChartTerminal symbol={symbol} defaultTimeframe="1H" />
      </div>
    </div>
  );
}