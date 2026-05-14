"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MousePointer2,
  Minus,
  ArrowRight,
  TrendingUp,
  Hash,
  Square,
  Type,
  Eraser,
  Target,
  CircleDot,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
} from "lucide-react";
import type { DrawingType } from "./engine/drawingTypes";

type Tool = DrawingType | "cursor" | "eraser";

interface Props {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  onClear: () => void;
  hasSelected: boolean;
  onDeleteSelected: () => void;
}

const TOOLS: { id: Tool; icon: any; label: string }[] = [
  { id: "cursor", icon: MousePointer2, label: "Sec" },
  { id: "trendLine", icon: TrendingUp, label: "Trend" },
  { id: "horizontalLine", icon: Minus, label: "Yatay" },
  { id: "verticalLine", icon: ArrowRight, label: "Dikey" },
  { id: "fibonacci", icon: Hash, label: "Fib" },
  { id: "rectangle", icon: Square, label: "Kutu" },
  { id: "entryLine", icon: CircleDot, label: "Giris" },
  { id: "targetLine", icon: Target, label: "Hedef" },
  { id: "text", icon: Type, label: "Metin" },
  { id: "eraser", icon: Eraser, label: "Sil" },
];

function ToolButton({
  icon: Icon,
  label,
  active,
  onClick,
  compact = false,
}: {
  icon: any;
  label: string;
  active: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        width: compact ? 30 : 32,
        height: compact ? 30 : 32,
        borderRadius: 6,
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: active ? "rgba(212,175,55,0.15)" : "transparent",
        color: active ? "#D4AF37" : "rgba(232,232,239,0.5)",
        transition: "all 0.15s",
      }}
    >
      <Icon size={14} />
    </button>
  );
}

export function DrawingToolbar({
  activeTool,
  onToolChange,
  onClear,
  hasSelected,
  onDeleteSelected,
}: Props) {
  const [width, setWidth] = useState(1200);
  const isCompact = width <= 1024;
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("orientationchange", update, { passive: true });
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  useEffect(() => {
    if (!isCompact) setCollapsed(false);
    else setCollapsed(true);
  }, [isCompact]);

  const panelTools = useMemo(() => TOOLS, []);

  if (isCompact) {
    return (
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          zIndex: 30,
          pointerEvents: "auto",
          maxWidth: "calc(100% - 16px)",
        }}
      >
        <button
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Cizim araclarini ac" : "Cizim araclarini kapat"}
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            border: "1px solid rgba(212,175,55,0.3)",
            background: "rgba(17,18,27,0.94)",
            color: "#D4AF37",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
          }}
        >
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>

        {!collapsed && (
          <div
            style={{
              marginTop: 8,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(17,18,27,0.96)",
              backdropFilter: "blur(8px)",
              padding: 8,
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: 4,
              maxWidth: 290,
            }}
          >
            {panelTools.map((tool) => (
              <ToolButton
                key={tool.id}
                icon={tool.icon}
                label={tool.label}
                active={activeTool === tool.id}
                onClick={() => onToolChange(tool.id)}
                compact
              />
            ))}
            <button
              onClick={onDeleteSelected}
              disabled={!hasSelected}
              title="Secili cizimi sil"
              style={{
                width: 30,
                height: 30,
                borderRadius: 6,
                border: "1px solid rgba(239,68,68,0.3)",
                cursor: hasSelected ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: hasSelected ? "rgba(239,68,68,0.12)" : "rgba(148,163,184,0.08)",
                color: hasSelected ? "rgba(239,68,68,0.85)" : "rgba(148,163,184,0.5)",
              }}
            >
              <Trash2 size={12} />
            </button>
            <button
              onClick={onClear}
              title="Tum cizimleri temizle"
              style={{
                width: 30,
                height: 30,
                borderRadius: 6,
                border: "1px solid rgba(239,68,68,0.3)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(239,68,68,0.1)",
                color: "rgba(239,68,68,0.85)",
              }}
            >
              <Eraser size={12} />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "8px 4px",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(17,18,27,0.95)",
        width: 44,
        alignItems: "center",
        flexShrink: 0,
      }}
    >
      {panelTools.map((tool) => (
        <ToolButton
          key={tool.id}
          icon={tool.icon}
          label={tool.label}
          active={activeTool === tool.id}
          onClick={() => onToolChange(tool.id)}
        />
      ))}
      <div style={{ flex: 1 }} />
      <button
        onClick={onDeleteSelected}
        disabled={!hasSelected}
        title="Secili cizimi sil"
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          border: "1px solid rgba(239,68,68,0.22)",
          cursor: hasSelected ? "pointer" : "not-allowed",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: hasSelected ? "rgba(239,68,68,0.08)" : "rgba(148,163,184,0.08)",
          color: hasSelected ? "rgba(239,68,68,0.72)" : "rgba(148,163,184,0.55)",
          marginBottom: 4,
        }}
      >
        <Trash2 size={13} />
      </button>
      <button
        onClick={onClear}
        title="Tum cizimleri temizle"
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          border: "1px solid rgba(239,68,68,0.22)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(239,68,68,0.05)",
          color: "rgba(239,68,68,0.72)",
        }}
      >
        <Eraser size={13} />
      </button>
    </div>
  );
}
