import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../src/api/client";

const C = {
  void: "#050508", surface: "#0d0d1a", border: "#1e1e35",
  gold: "#f59e0b", up: "#10b981", down: "#ef4444", info: "#60a5fa",
  text: "#ffffff", muted: "#ffffff70", dim: "#ffffff30",
};

const MOCK_STATS = {
  total: 47, closed: 38, pending: 9, hits: 24, stops: 10,
  hit_rate: 63.2, avg_pnl: 1.24, avg_win: 2.8, avg_loss: -1.4,
  best_trade: 8.2, worst_trade: -3.1, expectancy: 0.82,
  records: [
    { id:"BTC_001", symbol:"BTCUSDT", stage:"TRIGGER", direction:"LONG",  entry_price:79100, target_price:82000, stop_price:77500, confidence:82, outcome:"HIT",      pnl_pct:3.73,  created_at:"2026-05-10T09:15:00Z" },
    { id:"XAU_001", symbol:"XAUUSD",  stage:"SETUP",   direction:"LONG",  entry_price:3245,  target_price:3310,  stop_price:3210,  confidence:76, outcome:"HIT",      pnl_pct:2.06,  created_at:"2026-05-10T11:30:00Z" },
    { id:"NVDA_001",symbol:"NVDA",    stage:"WATCH",   direction:"LONG",  entry_price:845,   target_price:880,   stop_price:825,   confidence:68, outcome:"STOP_HIT", pnl_pct:-2.49, created_at:"2026-05-09T15:00:00Z" },
    { id:"ETH_001", symbol:"ETHUSDT", stage:"TRIGGER", direction:"LONG",  entry_price:2210,  target_price:2350,  stop_price:2140,  confidence:79, outcome:"HIT",      pnl_pct:6.38,  created_at:"2026-05-09T08:00:00Z" },
    { id:"TSLA_001",symbol:"TSLA",    stage:"SETUP",   direction:"SHORT", entry_price:178,   target_price:162,   stop_price:185,   confidence:71, outcome:"HIT",      pnl_pct:8.43,  created_at:"2026-05-08T14:00:00Z" },
  ],
};

const OUTCOME_CFG: Record<string,{color:string;label:string}> = {
  HIT:       { color: C.up,   label: "✓ HIT" },
  STOP_HIT:  { color: C.down, label: "✕ STOP" },
  TIMEOUT:   { color: C.dim,  label: "⏱ ZAMAN" },
  PENDING:   { color: C.gold, label: "⏳ BEKLİYOR" },
};

type Filter = "all" | "HIT" | "STOP_HIT" | "PENDING";

export default function PerformanceScreen() {
  const [filter, setFilter] = useState<Filter>("all");

  const { data } = useQuery({
    queryKey: ["performance-mobile"],
    queryFn: () => api.get("/intelligence/performance").then((r) => r.data).catch(() => null),
    staleTime: 30000,
  });

  const stats = data || MOCK_STATS;
  const filtered = filter === "all" ? stats.records : stats.records.filter((r: any) => r.outcome === filter);

  return (
    <SafeAreaView style={s.root}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Performans & Audit</Text>
          <Text style={s.sub}>Sinyal hit rate · Backtest sonuçları</Text>
        </View>

        {/* Hit rate visual */}
        <View style={s.hitCard}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={s.hitLabel}>Genel Hit Rate</Text>
            <Text style={[s.hitScore, { color: stats.hit_rate >= 60 ? C.up : C.gold }]}>{stats.hit_rate}%</Text>
          </View>
          <View style={s.hitBar}>
            <View style={[s.hitFill, { width: `${(stats.hits / Math.max(stats.closed, 1)) * 100}%` as any }]} />
          </View>
          <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
            {[
              { lbl: `✓ HIT (${stats.hits})`,    color: C.up },
              { lbl: `✕ STOP (${stats.stops})`,  color: C.down },
              { lbl: `⏳ BEKL (${stats.pending})`,color: C.gold },
            ].map(({ lbl, color }) => (
              <View key={lbl} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color }} />
                <Text style={{ color: C.dim, fontSize: 9 }}>{lbl}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Metrics grid */}
        <View style={s.metricsGrid}>
          {[
            { lbl: "Ort. Kazanç", val: `+${stats.avg_win}%`,   color: C.up },
            { lbl: "Ort. Kayıp",  val: `${stats.avg_loss}%`,   color: C.down },
            { lbl: "Beklenti",    val: `${stats.expectancy>0?"+":""}${stats.expectancy}%`, color: stats.expectancy>0?C.up:C.down },
            { lbl: "En İyi",      val: `+${stats.best_trade}%`, color: C.up },
            { lbl: "En Kötü",     val: `${stats.worst_trade}%`, color: C.down },
            { lbl: "Ort. PnL",    val: `${stats.avg_pnl>0?"+":""}${stats.avg_pnl}%`, color: stats.avg_pnl>0?C.up:C.down },
          ].map(({ lbl, val, color }) => (
            <View key={lbl} style={s.metricCard}>
              <Text style={s.metricLbl}>{lbl}</Text>
              <Text style={[s.metricVal, { color }]}>{val}</Text>
            </View>
          ))}
        </View>

        {/* Filter tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {(["all","HIT","STOP_HIT","PENDING"] as const).map(f => (
            <TouchableOpacity key={f} onPress={() => setFilter(f)}
              style={[s.fBtn, filter === f && { borderColor: C.gold, backgroundColor: "#f59e0b15" }]}>
              <Text style={[s.fTxt, filter === f && { color: C.gold }]}>
                {f === "all" ? "Tümü" : f === "HIT" ? "✓ Başarılı" : f === "STOP_HIT" ? "✕ Stop" : "⏳ Bekliyor"}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Records */}
        <View style={{ paddingHorizontal: 16 }}>
          {filtered.map((r: any) => {
            const oc = OUTCOME_CFG[r.outcome] || OUTCOME_CFG.PENDING;
            const pnl = Number(r.pnl_pct || 0);
            return (
              <View key={r.id} style={s.recordCard}>
                <View style={s.recTop}>
                  <View>
                    <Text style={s.recSym}>{r.symbol}</Text>
                    <Text style={s.recDate}>{new Date(r.created_at).toLocaleDateString("tr")}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[s.recPnl, { color: pnl > 0 ? C.up : pnl < 0 ? C.down : C.dim }]}>
                      {pnl === 0 ? "—" : `${pnl > 0 ? "+" : ""}${pnl.toFixed(2)}%`}
                    </Text>
                    <Text style={[s.recOutcome, { color: oc.color }]}>{oc.label}</Text>
                  </View>
                </View>
                <View style={s.recMeta}>
                  {[
                    { lbl: "Aşama",  val: r.stage,    color: r.stage==="TRIGGER"?C.up:r.stage==="SETUP"?C.gold:C.info },
                    { lbl: "Yön",    val: r.direction, color: r.direction==="LONG"?C.up:C.down },
                    { lbl: "Güven",  val: `${r.confidence}%`, color: C.text },
                    { lbl: "Giriş",  val: r.entry_price?.toLocaleString(), color: C.muted },
                  ].map(({ lbl, val, color }) => (
                    <View key={lbl} style={s.recMetaItem}>
                      <Text style={s.recMetaLbl}>{lbl}</Text>
                      <Text style={[s.recMetaVal, { color }]}>{val}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { color: C.text, fontSize: 22, fontWeight: "800" },
  sub: { color: C.muted, fontSize: 11, marginTop: 2 },
  hitCard: { marginHorizontal: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, marginBottom: 12 },
  hitLabel: { color: C.muted, fontSize: 12 },
  hitScore: { fontSize: 22, fontWeight: "800" },
  hitBar: { height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: C.border },
  hitFill: { height: 8, borderRadius: 4, backgroundColor: C.up },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  metricCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, width: "31%" },
  metricLbl: { color: C.dim, fontSize: 9, fontWeight: "600", marginBottom: 4 },
  metricVal: { fontSize: 14, fontWeight: "800" },
  fBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  fTxt: { color: C.muted, fontSize: 11, fontWeight: "600" },
  recordCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, marginBottom: 10 },
  recTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  recSym: { color: C.text, fontSize: 15, fontWeight: "800" },
  recDate: { color: C.dim, fontSize: 10, marginTop: 2 },
  recPnl: { fontSize: 18, fontWeight: "800" },
  recOutcome: { fontSize: 10, fontWeight: "700", marginTop: 2 },
  recMeta: { flexDirection: "row", gap: 12 },
  recMetaItem: {},
  recMetaLbl: { color: C.dim, fontSize: 9, fontWeight: "600", marginBottom: 2 },
  recMetaVal: { fontSize: 11, fontWeight: "700" },
});
