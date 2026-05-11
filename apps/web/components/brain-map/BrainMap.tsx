// @ts-nocheck
"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface Node {
  id: string;
  symbol: string;
  name: string;
  category: string;
  price?: number;
  change_pct?: number;
  x?: number;
  y?: number;
  confidence?: number;
  direction?: "long" | "short" | "neutral";
}

const CATEGORY_COLORS: Record<string, string> = {
  BIST: "#7c3aed",
  US: "#4f46e5",
  CRYPTO: "#06b6d4",
  COMMODITY: "#f59e0b",
  ENERGY: "#f97316",
  FOREX: "#10b981",
  INDEX: "#a855f7",
  ETF: "#6366f1",
};

const DIRECTION_GLOW: Record<string, string> = {
  long: "rgba(16,185,129,0.8)",
  short: "rgba(239,68,68,0.8)",
  neutral: "rgba(99,102,241,0.5)",
};

export default function BrainMap() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState<Node | null>(null);

  const { data: assetsData } = useQuery({
    queryKey: ["assets-brain"],
    queryFn: () => api.get("/assets?limit=100").then((r) => r.data.items),
    refetchInterval: 30000,
  });

  const { data: signalsData } = useQuery({
    queryKey: ["signals-brain"],
    queryFn: () => api.get("/signals?limit=100").then((r) => r.data.items),
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (!assetsData || !svgRef.current) return;

    const signalMap: Record<string, any> = {};
    (signalsData || []).forEach((s: any) => {
      signalMap[s.asset_id] = s;
    });

    const nodes: Node[] = assetsData.map((a: any) => ({
      id: a.id,
      symbol: a.symbol,
      name: a.name,
      category: a.category,
      price: a.price,
      change_pct: a.change_pct,
      direction: signalMap[a.id]?.direction || "neutral",
      confidence: signalMap[a.id]?.confidence || 0,
    }));

    const links = nodes
      .filter((_, i) => i > 0)
      .map((n, i) => ({
        source: nodes[Math.floor(Math.random() * Math.min(i, 10))].id,
        target: n.id,
      }));

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth || 800;
    const height = 500;

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g");

    // Zoom
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 3])
        .on("zoom", (event) => g.attr("transform", event.transform))
    );

    const simulation = d3
      .forceSimulation(nodes as any)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(80))
      .force("charge", d3.forceManyBody().strength(-120))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(20));

    // Links
    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#1e1e35")
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.4);

    // Nodes
    const node = g
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .on("click", (_, d) => setSelected(d));

    // Node circle
    node
      .append("circle")
      .attr("r", (d) => {
        const base = 8;
        const conf = (d.confidence || 0) / 100;
        return base + conf * 8;
      })
      .attr("fill", (d) => CATEGORY_COLORS[d.category] || "#6366f1")
      .attr("fill-opacity", 0.85)
      .attr("stroke", (d) => DIRECTION_GLOW[d.direction || "neutral"])
      .attr("stroke-width", (d) => (d.confidence || 0) >= 70 ? 2.5 : 1)
      .attr("filter", (d) => (d.confidence || 0) >= 70 ? "url(#glow)" : "none");

    // Glow filter
    const defs = svg.append("defs");
    const filter = defs.append("filter").attr("id", "glow");
    filter.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Labels
    node
      .append("text")
      .text((d) => d.symbol.replace(".IS", "").replace("USDT", ""))
      .attr("text-anchor", "middle")
      .attr("dy", -14)
      .attr("font-size", 10)
      .attr("fill", "#ffffff80")
      .attr("font-family", "Inter, sans-serif");

    // Drag
    node.call(
      d3.drag<SVGGElement, Node>()
        .on("start", (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
    );

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);
      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => { simulation.stop(); };
  }, [assetsData, signalsData]);

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-lg neon-text">Canlı Beyin Haritası</h2>
          <p className="text-white/50 text-sm">Her varlık bir nöron – sinyal gücü ile ışıldıyor</p>
        </div>
        <div className="flex gap-3 text-xs">
          {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
            <span key={cat} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-white/50">{cat}</span>
            </span>
          ))}
        </div>
      </div>

      <svg ref={svgRef} className="w-full h-[500px] rounded-lg bg-deep/50" />

      {selected && (
        <div className="mt-4 glass-card p-4">
          <div className="flex justify-between items-start">
            <div>
              <span className="font-bold text-white">{selected.symbol}</span>
              <span className="ml-2 text-white/50 text-sm">{selected.name}</span>
            </div>
            <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white">✕</button>
          </div>
          {selected.direction && (
            <div className={`mt-2 inline-flex px-3 py-1 rounded-full text-xs font-medium signal-${selected.direction}`}>
              {selected.direction.toUpperCase()} – {selected.confidence?.toFixed(0)}% güven
            </div>
          )}
          <p className="text-white/40 text-xs mt-2">Bu içerik yatırım tavsiyesi değildir.</p>
        </div>
      )}
    </div>
  );
}
