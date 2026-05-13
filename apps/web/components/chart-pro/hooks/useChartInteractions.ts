"use client";
import { useState, useCallback, useEffect } from "react";
import type { DrawingType } from "../engine/drawingTypes";

export function useChartInteractions() {
  const [isFullscreen, setFullscreen] = useState(false);
  const [activeTool, setActiveTool] = useState<DrawingType | "cursor" | "eraser">("cursor");
  const [crosshairData, setCrosshairData] = useState<{ time: number; price: number; volume: number } | null>(null);

  const toggleFullscreen = useCallback(() => setFullscreen(p => !p), []);
  const exitFullscreen = useCallback(() => setFullscreen(false), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) exitFullscreen();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen, exitFullscreen]);

  useEffect(() => {
    if (isFullscreen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isFullscreen]);

  return { isFullscreen, toggleFullscreen, exitFullscreen, activeTool, setActiveTool, crosshairData, setCrosshairData };
}
