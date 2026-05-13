"use client";
import { MousePointer2, Minus, ArrowRight, TrendingUp, Hash, Square, Type, Eraser, Target, CircleDot } from "lucide-react";
import type { DrawingType } from "./engine/drawingTypes";

type Tool = DrawingType | "cursor" | "eraser";

interface Props {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  onClear: () => void;
}

const TOOLS: { id: Tool; icon: any; label: string }[] = [
  { id: "cursor", icon: MousePointer2, label: "Seç" },
  { id: "trendLine", icon: TrendingUp, label: "Trend" },
  { id: "horizontalLine", icon: Minus, label: "Yatay" },
  { id: "verticalLine", icon: ArrowRight, label: "Dikey" },
  { id: "fibonacci", icon: Hash, label: "Fib" },
  { id: "rectangle", icon: Square, label: "Kutu" },
  { id: "entryLine", icon: CircleDot, label: "Giriş" },
  { id: "targetLine", icon: Target, label: "Hedef" },
  { id: "text", icon: Type, label: "Metin" },
  { id: "eraser", icon: Eraser, label: "Sil" },
];

export function DrawingToolbar({ activeTool, onToolChange, onClear }: Props) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 2, padding: "8px 4px",
      borderRight: "1px solid rgba(255,255,255,0.06)", background: "rgba(17,18,27,0.95)",
      width: 44, alignItems: "center",
    }}>
      {TOOLS.map(tool => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        return (
          <button key={tool.id} onClick={() => onToolChange(tool.id)} title={tool.label} style={{
            width: 32, height: 32, borderRadius: 6, border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: isActive ? "rgba(212,175,55,0.15)" : "transparent",
            color: isActive ? "#D4AF37" : "rgba(232,232,239,0.4)",
            transition: "all 0.15s",
          }}>
            <Icon size={15}/>
          </button>
        );
      })}
      <div style={{ flex: 1 }}/>
      <button onClick={onClear} title="Tümünü Sil" style={{
        width: 32, height: 32, borderRadius: 6, border: "1px solid rgba(239,68,68,0.2)",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(239,68,68,0.05)", color: "rgba(239,68,68,0.7)",
      }}>
        <Eraser size={13}/>
      </button>
    </div>
  );
}
