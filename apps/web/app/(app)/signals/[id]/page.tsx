"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { TrendingUp, TrendingDown, Minus, Shield, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function SignalDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: sigData, isLoading: sigLoading } = useQuery({
    queryKey: ["signal", id],
    queryFn: () => api.get(`/signals/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const { data: stratData, isLoading: stratLoading } = useQuery({
    queryKey: ["strategy", id],
    queryFn: () => api.get(`/signals/${id}/strategy`).then((r) => r.data),
    enabled: !!id,
  });

  const sig = sigData?.signal;
  const strat = stratData?.strategy;

  const DirIcon = sig?.direction === "long" ? TrendingUp : sig?.direction === "short" ? TrendingDown : Minus;
  const dirColor = sig?.direction === "long" ? "text-bull" : sig?.direction === "short" ? "text-bear" : "text-neutral";
  const dirBg = sig?.direction === "long" ? "signal-long" : sig?.direction === "short" ? "signal-short" : "signal-neutral";

  if (sigLoading) return (
    <div className="space-y-4">
      {[...Array(4)].map((_, i) => <div key={i} className="h-24 glass-card animate-pulse" />)}
    </div>
  );

  if (!sig) return (
    <div className="glass-card p-12 text-center text-white/40">
      Sinyal bulunamadı.
      <Link href="/signals" className="block mt-4 text-primary hover:underline text-sm">← Sinyallere Dön</Link>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/signals" className="p-2 rounded-lg hover:bg-surface transition-colors">
          <ArrowLeft size={16} className="text-white/50" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">{sig.symbol?.replace(".IS", "")}</h1>
          <p className="text-white/40 text-sm">{sig.name} — {sig.category}</p>
        </div>
        <div className={`ml-auto px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${dirBg}`}>
          <DirIcon size={14} />
          <span className={`text-sm font-bold ${dirColor}`}>{sig.direction?.toUpperCase()}</span>
        </div>
      </div>

      {/* Confidence + Key Metrics */}
      <div className="glass-card p-5">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <p className="text-white/40 text-xs mb-1">AI Güven</p>
            <p className={`text-3xl font-bold ${dirColor}`}>{Number(sig.confidence).toFixed(0)}%</p>
          </div>
          {sig.risk_reward && (
            <div className="text-center">
              <p className="text-white/40 text-xs mb-1">Risk/Ödül</p>
              <p className="text-2xl font-bold text-white">{Number(sig.risk_reward).toFixed(1)}x</p>
            </div>
          )}
          <div className="text-center">
            <p className="text-white/40 text-xs mb-1">Zaman Dilimi</p>
            <p className="text-xl font-bold text-white">{sig.timeframe}</p>
          </div>
        </div>
        <div className="h-2 bg-border rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${sig.direction === "long" ? "bg-bull" : sig.direction === "short" ? "bg-bear" : "bg-neutral"}`}
            style={{ width: `${sig.confidence}%` }} />
        </div>
      </div>

      {/* Strategy Card */}
      {strat && (
        <div className="glass-card p-5">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <Shield size={16} className="text-primary" />
            Strateji Kartı
          </h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { label: "Giriş", value: Number(strat.entry_price).toFixed(4), color: "text-white" },
              { label: "Hedef 1", value: Number(strat.target1).toFixed(4), color: "text-bull" },
              { label: "Stop-Loss", value: Number(strat.stop_loss).toFixed(4), color: "text-bear" },
            ].map((item) => (
              <div key={item.label} className="glass-card p-3 text-center">
                <p className="text-white/40 text-xs mb-1">{item.label}</p>
                <p className={`font-mono font-bold ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* R/R per 100 */}
          {strat.risk_amount_per_100 && (
            <div className="bg-surface border border-border rounded-lg p-4 mb-4">
              <p className="text-white/50 text-xs mb-2 font-semibold">100 TL koyarsan:</p>
              <div className="flex gap-6">
                <div>
                  <span className="text-bear text-xs">Max Kayıp: </span>
                  <span className="text-bear font-bold">-{strat.risk_amount_per_100} TL</span>
                </div>
                <div>
                  <span className="text-bull text-xs">Hedef Kazanç: </span>
                  <span className="text-bull font-bold">+{strat.reward_amount_per_100} TL</span>
                </div>
              </div>
            </div>
          )}

          {/* Entry Timing */}
          {strat.entry_timing && (
            <div className="mb-4">
              <p className="text-white/50 text-xs font-semibold mb-2">Giriş Zamanlaması:</p>
              <p className="text-white/70 text-sm">{strat.entry_timing?.suggested_window}</p>
              <p className="text-white/40 text-xs mt-1">Kaçın: {strat.entry_timing?.avoid}</p>
            </div>
          )}

          {/* Exit Strategy */}
          {strat.exit_strategy && (
            <div>
              <p className="text-white/50 text-xs font-semibold mb-2">Çıkış Stratejisi:</p>
              <p className="text-white/70 text-sm">Hedef 1'de %{strat.exit_strategy?.target1_exit_pct} çık</p>
              <p className="text-white/40 text-xs mt-1">{strat.exit_strategy?.trailing_stop_activation}</p>
            </div>
          )}
        </div>
      )}

      {/* AI Reasoning */}
      {sig.ai_reasoning && (
        <div className="glass-card p-5 border-l-2 border-primary">
          <h3 className="font-bold text-white text-sm mb-2">AI Gerekçesi</h3>
          <p className="text-white/70 text-sm leading-relaxed">{sig.ai_reasoning}</p>
        </div>
      )}

      {/* Kalkan Status */}
      {sig.kalkan_block && sig.kalkan_reasons?.length > 0 && (
        <div className="glass-card p-5 border border-bear/40 bg-bear/5">
          <h3 className="font-bold text-bear text-sm mb-2 flex items-center gap-2">
            <Shield size={14} /> KALKAN Uyarıları
          </h3>
          {sig.kalkan_reasons.map((reason: string, i: number) => (
            <p key={i} className="text-white/60 text-sm flex items-start gap-2">
              <span className="text-bear mt-0.5">•</span> {reason}
            </p>
          ))}
        </div>
      )}

      <p className="text-white/20 text-xs">{sigData?.disclaimer}</p>
    </div>
  );
}
