"use client";
import { Clock, Wifi, WifiOff, Maximize2, Minimize2 } from "lucide-react";

interface Props {
  symbol: string;
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  provider: string | null;
  updatedAt: number | null;
  loading: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

const TF_OPTIONS = ["5M", "15M", "1H", "4H", "1D", "1W", "1M"];

export function ChartHeader({ symbol, timeframe, onTimeframeChange, provider, updatedAt, loading, isFullscreen, onToggleFullscreen }: Props) {
  const timeStr = updatedAt ? new Date(updatedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--";

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)",
      background: "rgba(17,18,27,0.95)", flexWrap: "wrap", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 14, color: "#D4AF37" }}>
          {symbol}
        </span>
        <div style={{ display: "flex", gap: 2 }}>
          {TF_OPTIONS.map(tf => (
            <button key={tf} onClick={() => onTimeframeChange(tf)} style={{
              padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
              fontFamily: "IBM Plex Mono", border: "none", cursor: "pointer",
              background: tf === timeframe ? "rgba(212,175,55,0.2)" : "transparent",
              color: tf === timeframe ? "#D4AF37" : "rgba(232,232,239,0.5)",
              transition: "all 0.15s",
            }}>{tf}</button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <DataStatusBadge provider={provider} updatedAt={updatedAt} loading={loading} />
        <button onClick={onToggleFullscreen} style={{
          background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
          color: "rgba(232,232,239,0.6)", cursor: "pointer", padding: "4px 6px",
          display: "flex", alignItems: "center",
        }}>
          {isFullscreen ? <Minimize2 size={14}/> : <Maximize2 size={14}/>}
        </button>
      </div>
    </div>
  );
}

function DataStatusBadge({ provider, updatedAt, loading }: { provider: string | null; updatedAt: number | null; loading: boolean }) {
  if (loading) return (
    <span style={{ fontSize: 10, color: "rgba(232,232,239,0.4)", fontFamily: "IBM Plex Mono" }}>Yükleniyor...</span>
  );
  const timeStr = updatedAt ? new Date(updatedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {provider && (
        <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: "rgba(16,185,129,0.1)", color: "#10b981", fontFamily: "IBM Plex Mono", fontWeight: 600 }}>
          {provider}
        </span>
      )}
      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "rgba(232,232,239,0.4)", fontFamily: "IBM Plex Mono" }}>
        <Clock size={10}/>{timeStr}
      </span>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 4px #10b981" }}/>
    </div>
  );
}
