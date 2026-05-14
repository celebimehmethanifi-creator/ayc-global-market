"use client";
import { useState, useEffect, useCallback } from "react";
import type { Drawing, DrawingType, DrawingPoint, DrawingStyle } from "../engine/drawingTypes";
import { createDrawingId } from "../engine/drawingTypes";

const STORAGE_KEY = "ayc_chart_drawings_v2";

function loadDrawings(): Drawing[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item === "object");
  } catch { return []; }
}

function saveDrawings(drawings: Drawing[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drawings));
}

export function useChartDrawings(symbol: string, timeframe: string) {
  const [drawings, setDrawings] = useState<Drawing[]>([]);

  const refreshScope = useCallback(() => {
    const all = loadDrawings();
    setDrawings(all.filter(d => d.symbol === symbol && d.timeframe === timeframe));
  }, [symbol, timeframe]);

  useEffect(() => {
    refreshScope();
  }, [refreshScope]);

  const addDrawing = useCallback((params: {
    type: DrawingType;
    points: DrawingPoint[];
    style: DrawingStyle;
    id?: string;
    createdAt?: string;
    updatedAt?: string;
  }) => {
    const now = new Date().toISOString();
    const drawing: Drawing = {
      id: params.id || createDrawingId(),
      symbol,
      timeframe,
      type: params.type,
      points: params.points,
      style: params.style,
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
    };
    const all = loadDrawings();
    const idx = all.findIndex((item) => item.id === drawing.id);
    if (idx >= 0) all[idx] = drawing;
    else all.push(drawing);
    saveDrawings(all);
    setDrawings(prev => {
      const existing = prev.findIndex((item) => item.id === drawing.id);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = drawing;
        return next;
      }
      return [...prev, drawing];
    });
    return drawing;
  }, [symbol, timeframe]);

  const upsertDrawing = useCallback((drawing: Drawing) => {
    const all = loadDrawings();
    const idx = all.findIndex((item) => item.id === drawing.id);
    const nextDrawing: Drawing = { ...drawing, updatedAt: new Date().toISOString() };
    if (idx >= 0) all[idx] = nextDrawing;
    else all.push(nextDrawing);
    saveDrawings(all);
    if (nextDrawing.symbol === symbol && nextDrawing.timeframe === timeframe) {
      setDrawings(prev => {
        const current = prev.findIndex((item) => item.id === nextDrawing.id);
        if (current >= 0) {
          const updated = [...prev];
          updated[current] = nextDrawing;
          return updated;
        }
        return [...prev, nextDrawing];
      });
    }
    return nextDrawing;
  }, [symbol, timeframe]);

  const removeDrawing = useCallback((id: string) => {
    const all = loadDrawings().filter(d => d.id !== id);
    saveDrawings(all);
    setDrawings(prev => prev.filter(d => d.id !== id));
  }, []);

  const clearDrawings = useCallback(() => {
    const all = loadDrawings().filter(d => !(d.symbol === symbol && d.timeframe === timeframe));
    saveDrawings(all);
    setDrawings([]);
  }, [symbol, timeframe]);

  return { drawings, addDrawing, upsertDrawing, removeDrawing, clearDrawings, refreshScope };
}
