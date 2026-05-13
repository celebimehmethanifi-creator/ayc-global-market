"use client";
import { useState, useEffect, useCallback } from "react";
import type { Drawing, DrawingType, DrawingPoint, DrawingStyle } from "../engine/drawingTypes";
import { createDrawingId } from "../engine/drawingTypes";

const STORAGE_KEY = "ayc_chart_drawings";

function loadDrawings(): Drawing[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveDrawings(drawings: Drawing[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drawings));
}

export function useChartDrawings(symbol: string, timeframe: string) {
  const [drawings, setDrawings] = useState<Drawing[]>([]);

  useEffect(() => {
    const all = loadDrawings();
    setDrawings(all.filter(d => d.symbol === symbol && d.timeframe === timeframe));
  }, [symbol, timeframe]);

  const addDrawing = useCallback((type: DrawingType, points: DrawingPoint[], style: DrawingStyle) => {
    const drawing: Drawing = {
      id: createDrawingId(),
      symbol, timeframe, type, points, style,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const all = loadDrawings();
    all.push(drawing);
    saveDrawings(all);
    setDrawings(prev => [...prev, drawing]);
    return drawing;
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

  return { drawings, addDrawing, removeDrawing, clearDrawings };
}
