"use client";
import { Box, Lock } from "lucide-react";

interface Props {
  symbol: string;
  isBIST: boolean;
}

export function Depth3DPlaceholder({ symbol, isBIST }: Props) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      height: "100%", minHeight: 300, background: "rgba(12,14,22,0.95)",
      border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8,
    }}>
      {isBIST ? (
        <>
          <Lock size={32} color="rgba(232,232,239,0.2)" />
          <p style={{ color: "rgba(232,232,239,0.4)", fontSize: 13, marginTop: 12, textAlign: "center", maxWidth: 280 }}>
            BIST derinlik verisi lisanslı vendor gerektirir.
          </p>
          <span style={{ fontSize: 10, color: "rgba(232,232,239,0.25)", marginTop: 8, fontFamily: "IBM Plex Mono" }}>
            Matriks · Foreks · Finnet · Broker API
          </span>
        </>
      ) : (
        <>
          <Box size={32} color="rgba(212,175,55,0.4)" />
          <p style={{ color: "rgba(232,232,239,0.5)", fontSize: 13, marginTop: 12, textAlign: "center", maxWidth: 280 }}>
            3D Derinlik — V2
          </p>
          <span style={{ fontSize: 10, color: "rgba(232,232,239,0.25)", marginTop: 8, fontFamily: "IBM Plex Mono" }}>
            Three.js / ECharts GL ile derinlik yüzeyi
          </span>
          <span style={{ fontSize: 10, color: "#D4AF37", marginTop: 4 }}>
            {symbol} — POC Demo
          </span>
        </>
      )}
    </div>
  );
}
