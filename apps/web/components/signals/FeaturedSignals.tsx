"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Shield } from "lucide-react";
import Link from "next/link";

const DIRECTION_CONFIG = {
  long: { icon: TrendingUp, color: "text-bull", bg: "bg-bull/10 border-bull/30", label: "LONG" },
  short: { icon: TrendingDown, color: "text-bear", bg: "bg-bear/10 border-bear/30", label: "SHORT" },
  neutral: { icon: Minus, color: "text-neutral", bg: "bg-neutral/10 border-neutral/30", label: "NÖTR" },
};

const DISCLAIMER = "Bu içerik yatırım tavsiyesi değildir.";

export function FeaturedSignals() {
  const { data, isLoading } = useQuery({
    queryKey: ["featured-signals"],
    queryFn: () => api.get("/signals/featured").then((r) => r.data.featured),
    refetchInterval: 300000,
  });

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-border rounded w-1/4" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(9)].map((_, i) => <div key={i} className="h-24 bg-border rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  const categories = Object.keys(data || {}).slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg neon-text">Öne Çıkan Sinyaller</h2>
        <p className="text-white/30 text-xs">{DISCLAIMER}</p>
      </div>

      {categories.map((cat) => {
        const catData = data[cat];
        return (
          <div key={cat} className="glass-card p-5">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              {cat}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(["saglam", "long", "short"] as const).map((type) => {
                const signals = catData[type] || [];
                const dirLabel = type === "saglam" ? "NÖTR" : type.toUpperCase();
                const dirKey = type === "saglam" ? "neutral" : type;
                const cfg = DIRECTION_CONFIG[dirKey as keyof typeof DIRECTION_CONFIG];
                return (
                  <div key={type}>
                    <div className={`text-xs font-bold mb-2 px-2 py-0.5 rounded inline-flex items-center gap-1 border ${cfg.bg} ${cfg.color}`}>
                      <cfg.icon size={12} />
                      {dirLabel} — Top 5
                    </div>
                    <div className="space-y-2">
                      {signals.length === 0 && (
                        <p className="text-white/30 text-xs">Yeterli sinyal yok</p>
                      )}
                      {signals.map((sig: any) => (
                        <motion.div
                          key={sig.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          whileHover={{ scale: 1.02 }}
                        >
                          <Link href={`/signals/${sig.id}`}>
                            <div className={`p-3 rounded-lg border cursor-pointer transition-all ${cfg.bg}`}>
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-sm text-white">
                                  {sig.symbol?.replace(".IS", "").replace("USDT", "")}
                                </span>
                                <span className={`text-xs font-mono font-bold ${cfg.color}`}>
                                  {sig.confidence?.toFixed(0)}%
                                </span>
                              </div>
                              <div className="text-white/40 text-xs mt-1 truncate">{sig.name}</div>
                              {sig.risk_reward && (
                                <div className="text-white/50 text-xs mt-1">
                                  R/R: {Number(sig.risk_reward).toFixed(1)}x
                                </div>
                              )}
                            </div>
                          </Link>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
