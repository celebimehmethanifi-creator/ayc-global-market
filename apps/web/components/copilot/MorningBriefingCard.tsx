"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sun, Loader2 } from "lucide-react";

export function MorningBriefingCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["morning-briefing"],
    queryFn: () => api.get("/copilot/briefing/latest").then((r) => r.data),
    staleTime: 1000 * 60 * 30,
  });

  return (
    <div className="glass-card p-5 border-l-2 border-primary">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary/20 rounded-lg mt-0.5">
          <Sun size={18} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-bold text-sm text-white">Sabah Brifing</h3>
            {isLoading && <Loader2 size={12} className="animate-spin text-primary" />}
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-3 bg-border rounded animate-pulse" style={{ width: `${70 + i * 10}%` }} />
              ))}
            </div>
          ) : (
            <div>
              <p className="text-white/70 text-sm whitespace-pre-line leading-relaxed">
                {data?.summary}
              </p>
              {data?.generated_at && (
                <p className="text-white/30 text-xs mt-2">
                  {new Date(data.generated_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          )}
          <p className="text-white/20 text-xs mt-3 border-t border-border pt-2">{data?.disclaimer}</p>
        </div>
      </div>
    </div>
  );
}
