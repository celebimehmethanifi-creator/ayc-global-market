"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Shield, AlertTriangle, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function KalkanStatusBanner() {
  const { data } = useQuery({
    queryKey: ["kalkan-status"],
    queryFn: () => api.get("/alarms/kalkan-status").then((r) => r.data),
    refetchInterval: 30000,
  });

  const blocks = data?.active_kalkan_blocks || [];
  if (blocks.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        className="glass-card border border-kalkan/40 bg-kalkan/5 p-4"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 bg-kalkan/20 rounded-full mt-0.5">
            <Shield size={18} className="text-kalkan" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-kalkan text-sm">KALKAN AKTİF</span>
              <span className="text-xs bg-kalkan/20 text-kalkan px-2 py-0.5 rounded-full">
                {blocks.length} engel
              </span>
            </div>
            <div className="mt-1 space-y-1">
              {blocks.map((b: any) => (
                <div key={b.id} className="text-white/60 text-xs flex items-center gap-1">
                  <Lock size={10} className="text-kalkan" />
                  {b.condition?.reason || b.alarm_type}
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Full-screen Kalkan overlay — used when a hard block is triggered
export function KalkanOverlay({ reasons, onDismiss }: { reasons: string[]; onDismiss?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="kalkan-overlay"
    >
      <div className="max-w-md w-full mx-4 glass-card border border-kalkan/60 p-8">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-kalkan/20 rounded-full flex items-center justify-center animate-pulse-slow">
            <Shield size={40} className="text-kalkan" />
          </div>
        </div>
        <h2 className="text-center text-2xl font-bold text-kalkan mb-2">KALKAN DEVREYİ GİRDİ</h2>
        <p className="text-center text-white/60 text-sm mb-6">
          AI bu işlemi şu an yapmamanızı öneriyor
        </p>
        <div className="space-y-3 mb-6">
          {reasons.map((reason, i) => (
            <div key={i} className="flex items-start gap-3 bg-kalkan/10 border border-kalkan/20 rounded-lg p-3">
              <AlertTriangle size={16} className="text-kalkan mt-0.5 flex-shrink-0" />
              <span className="text-sm text-white/80">{reason}</span>
            </div>
          ))}
        </div>
        <p className="text-center text-white/30 text-xs mb-4">
          Bu bir tavsiye değil, bir korumadır. Kararı yine de siz alırsınız.
        </p>
        {onDismiss && (
          <button onClick={onDismiss} className="w-full btn-ghost text-sm">
            Anladım, devam et
          </button>
        )}
      </div>
    </motion.div>
  );
}
