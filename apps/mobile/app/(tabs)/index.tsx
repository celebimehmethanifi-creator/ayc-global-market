import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../src/api/client";

const { width: W } = Dimensions.get("window");

const C = {
  void: "#050508", surface: "#0d0d1a", card2: "#11111f", border: "#1e1e35",
  gold: "#f59e0b", up: "#10b981", down: "#ef4444", info: "#60a5fa",
  purple: "#7c3aed", text: "#ffffff", muted: "#ffffff70", dim: "#ffffff30",
};

const MOCK_SIGNALS = [
  { id:"1", symbol:"BTC",  name:"Bitcoin",  direction:"long",  confidence:88, risk_reward:2.1, stage:"SETUP",   price:"$81,250", chg:"+1.82%" },
  { id:"2", symbol:"XAU",  name:"Altın",    direction:"long",  confidence:79, risk_reward:1.9, stage:"TRIGGER", price:"$3,295",  chg:"+0.28%" },
  { id:"3", symbol:"NVDA", name:"NVIDIA",   direction:"long",  confidence:83, risk_reward:2.8, stage:"SETUP",   price:"$875.2",  chg:"+3.15%" },
  { id:"4", symbol:"TSLA", name:"Tesla",    direction:"short", confidence:76, risk_reward:1.7, stage:"WATCH",   price:"$172.6",  chg:"-2.84%" },
];

const MOCK_CAUSAL = {
  symbol: "BTCUSDT",
  primary_cause: "VOLUME_ANOMALY",
  primary_conf: 78,
  narrative: "Bitcoin yükselişinin birincil nedeni hacim anomalisi (5.2x ortalama). Kurumsal alım işareti. Teknik kırılım ikincil destek sağlıyor.",
  manipulation_risk: 12,
};

const STAGE_COLOR: Record<string, string> = {
  TRIGGER: C.up, SETUP: C.gold, WATCH: C.info, KALKAN: C.down, NONE: C.dim,
};

const CAUSE_LABELS: Record<string, string> = {
  VOLUME_ANOMALY: "Hacim Anomalisi",
  TECHNICAL_BREAKOUT: "Teknik Kırılım",
  NEWS_CATALYST: "Haber Katalizörü",
  LIQUIDITY_EVENT: "Likidite Değişimi",
  MANIPULATION_SIGNAL: "Manipülasyon",
};

export default function HomeScreen() {
  const { data: signalData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["home-signals"],
    queryFn: () => api.get("/signals/live?market=all&limit=8").then((r) => r.data).catch(() => null),
    refetchInterval: 60000,
  });

  const { data: causalData } = useQuery({
    queryKey: ["home-causal"],
    queryFn: () =>
      api.post("/intelligence/causal", {
        symbol: "BTCUSDT", price: 81250, change_24h: 1.82,
        volume_ratio: 2.1, indicators: { rsi: 62, macd_hist: 0.0012 }, market: "crypto",
      }).then((r) => r.data).catch(() => null),
    staleTime: 120000,
  });

  const signals = signalData?.signals || MOCK_SIGNALS;
  const causal = causalData || MOCK_CAUSAL;
  const longCount = signals.filter((s: any) => (s.direction || "").toLowerCase() === "long").length;

  return (
    <SafeAreaView style={s.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.gold} />}
      >
        {/* ── HEADER ── */}
        <View style={s.header}>
          <View>
            <Text style={s.logo}>AYC Global Market</Text>
            <View style={s.liveRow}>
              <View style={s.liveDot} />
              <Text style={s.liveTxt}>3 AI Motor Aktif</Text>
            </View>
          </View>
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>AI</Text>
          </View>
        </View>

        {/* ── STATS ROW ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.statsScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
          {[
            { label: "BTC/USD",    value: "$81,250", sub: "+1.82%", color: C.up },
            { label: "XAU/USD",    value: "$3,295",  sub: "+0.28%", color: C.gold },
            { label: "Sinyal",     value: `${signals.length}`,   sub: `${longCount} LONG`, color: C.info },
            { label: "KALKAN",     value: "AKTİF",   sub: "4 filtre", color: C.up },
          ].map(({ label, value, sub, color }) => (
            <View key={label} style={s.statCard}>
              <Text style={s.statLabel}>{label}</Text>
              <Text style={[s.statValue, { color }]}>{value}</Text>
              <Text style={s.statSub}>{sub}</Text>
            </View>
          ))}
        </ScrollView>

        {/* ── MARKET PULSE ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Market Nabzı</Text>
          <View style={s.pulseCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <Text style={s.pulseLabel}>Açgözlülük / Korku Endeksi</Text>
              <Text style={[s.pulseScore, { color: C.gold }]}>62 — Açgözlülük</Text>
            </View>
            <View style={s.pulseBar}>
              <View style={[s.pulseFill, { width: "62%" }]} />
              <View style={[s.pulseIndicator, { left: "60%" }]} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
              <Text style={s.pulseTick}>Korku</Text>
              <Text style={s.pulseTick}>Nötr</Text>
              <Text style={s.pulseTick}>Açgözlülük</Text>
            </View>
          </View>
        </View>

        {/* ── CAUSAL CARD ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Neden Bu Hareket? — {causal.symbol}</Text>
          <View style={s.causalCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Text style={[s.causeBadge, { color: C.gold }]}>
                {CAUSE_LABELS[causal.primary_cause] || causal.primary_cause}
              </Text>
              <Text style={s.causeConf}>{causal.primary_conf}% güven</Text>
            </View>
            <Text style={s.causeNarrative}>{causal.narrative}</Text>
            <View style={{ marginTop: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={s.dimTxt}>Manipülasyon Riski</Text>
                <Text style={[s.dimTxt, { color: causal.manipulation_risk > 55 ? C.down : causal.manipulation_risk > 30 ? C.gold : C.up }]}>
                  {causal.manipulation_risk}%
                </Text>
              </View>
              <View style={s.barBg}>
                <View style={[s.barFill, {
                  width: `${causal.manipulation_risk}%` as any,
                  backgroundColor: causal.manipulation_risk > 55 ? C.down : causal.manipulation_risk > 30 ? C.gold : C.up,
                }]} />
              </View>
            </View>
          </View>
        </View>

        {/* ── SIGNALS ── */}
        <View style={s.section}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={s.sectionTitle}>Aktif Sinyaller</Text>
            <Text style={s.dimTxt}>%70+ güven · Tavsiye değildir</Text>
          </View>
          {isLoading && <ActivityIndicator color={C.gold} style={{ margin: 16 }} />}
          {signals.slice(0, 5).map((sig: any) => {
            const isLong = (sig.direction || "").toLowerCase() === "long";
            const stageColor = STAGE_COLOR[sig.stage] || C.dim;
            const conf = Number(sig.confidence || sig.scores?.confidence || 0);
            const chg = Number(sig.change_24h || 0);
            return (
              <View key={sig.id || sig.symbol} style={[s.sigCard, { borderTopColor: stageColor }]}>
                <View style={s.sigTop}>
                  <View>
                    <Text style={s.sigSymbol}>{(sig.symbol || "").replace("USDT", "").replace(".IS", "")}</Text>
                    <Text style={s.sigName}>{sig.name}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <View style={[s.dirBadge, { backgroundColor: isLong ? "#10b98118" : "#ef444418", borderColor: isLong ? "#10b98140" : "#ef444440" }]}>
                      <Text style={[s.dirTxt, { color: isLong ? C.up : C.down }]}>
                        {isLong ? "▲ LONG" : "▼ SHORT"}
                      </Text>
                    </View>
                    {chg !== 0 && (
                      <Text style={[s.chgTxt, { color: chg >= 0 ? C.up : C.down }]}>
                        {chg >= 0 ? "+" : ""}{chg.toFixed(2)}%
                      </Text>
                    )}
                  </View>
                </View>
                <View style={s.sigMeta}>
                  <View style={s.metaItem}>
                    <Text style={s.metaLbl}>Güven</Text>
                    <Text style={[s.metaVal, { color: conf >= 75 ? C.up : conf >= 55 ? C.gold : C.down }]}>{conf}%</Text>
                  </View>
                  {sig.risk_reward && (
                    <View style={s.metaItem}>
                      <Text style={s.metaLbl}>R/R</Text>
                      <Text style={[s.metaVal, { color: C.info }]}>{Number(sig.risk_reward).toFixed(1)}x</Text>
                    </View>
                  )}
                  {sig.stage && (
                    <View style={s.metaItem}>
                      <Text style={s.metaLbl}>Aşama</Text>
                      <Text style={[s.metaVal, { color: stageColor }]}>{sig.stage}</Text>
                    </View>
                  )}
                </View>
                <View style={s.barBg}>
                  <View style={[s.barFill, { width: `${conf}%` as any, backgroundColor: isLong ? C.up : C.down }]} />
                </View>
              </View>
            );
          })}
        </View>

        {/* ── KALKAN STATUS ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>KALKAN Guard</Text>
          <View style={s.kalkanCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: 13 }}>Risk Filtreleri</Text>
              <View style={[s.activeBadge]}>
                <View style={s.activeDot} />
                <Text style={s.activeTxt}>AKTİF</Text>
              </View>
            </View>
            {["Sahte Kırılım Filtresi", "Geç Giriş Filtresi", "FOMO Kilidi", "İntikam İşlemi Kilidi", "Risk/Ödül Filtresi"].map((filter) => (
              <View key={filter} style={s.filterRow}>
                <Text style={s.filterLabel}>{filter}</Text>
                <View style={s.filterDot} />
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  logo: { color: C.text, fontSize: 18, fontWeight: "800", letterSpacing: 0.5 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.up },
  liveTxt: { color: C.up, fontSize: 10, fontWeight: "700" },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.purple + "33", alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: C.purple, fontWeight: "800", fontSize: 11 },
  statsScroll: { marginBottom: 8 },
  statCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, minWidth: 110 },
  statLabel: { color: C.dim, fontSize: 9, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: "800", fontVariant: ["tabular-nums"] as any },
  statSub: { color: C.muted, fontSize: 10, marginTop: 2 },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { color: C.text, fontSize: 14, fontWeight: "700", marginBottom: 10 },
  pulseCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16 },
  pulseLabel: { color: C.muted, fontSize: 11 },
  pulseScore: { fontSize: 13, fontWeight: "800" },
  pulseBar: { height: 8, borderRadius: 4, overflow: "visible", position: "relative", backgroundColor: "#1e1e35" },
  pulseFill: { position: "absolute", left: 0, top: 0, height: 8, borderRadius: 4, backgroundColor: C.gold },
  pulseIndicator: { position: "absolute", top: -3, width: 14, height: 14, borderRadius: 7, backgroundColor: "white", borderWidth: 2, borderColor: C.gold, marginLeft: -7 },
  pulseTick: { color: C.dim, fontSize: 9 },
  causalCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderLeftWidth: 3, borderLeftColor: C.gold, borderRadius: 14, padding: 14 },
  causeBadge: { fontSize: 12, fontWeight: "800" },
  causeConf: { color: C.muted, fontSize: 10 },
  causeNarrative: { color: C.muted, fontSize: 12, lineHeight: 18 },
  barBg: { height: 4, backgroundColor: C.border, borderRadius: 2, overflow: "hidden" },
  barFill: { height: 4, borderRadius: 2 },
  dimTxt: { color: C.dim, fontSize: 10 },
  sigCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderTopWidth: 2, borderRadius: 14, padding: 14, marginBottom: 10 },
  sigTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  sigSymbol: { color: C.text, fontSize: 16, fontWeight: "800" },
  sigName: { color: C.muted, fontSize: 10, marginTop: 2 },
  dirBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  dirTxt: { fontSize: 10, fontWeight: "800" },
  chgTxt: { fontSize: 10, fontWeight: "700", marginTop: 4 },
  sigMeta: { flexDirection: "row", gap: 20, marginBottom: 8 },
  metaItem: { gap: 2 },
  metaLbl: { color: C.dim, fontSize: 9, fontWeight: "600" },
  metaVal: { color: C.text, fontSize: 12, fontWeight: "800" },
  kalkanCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: "#10b98130", borderRadius: 14, padding: 16 },
  activeBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#10b98115", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: "#10b98130" },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.up },
  activeTxt: { color: C.up, fontSize: 10, fontWeight: "800" },
  filterRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.border },
  filterLabel: { color: C.muted, fontSize: 12 },
  filterDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.up },
});
