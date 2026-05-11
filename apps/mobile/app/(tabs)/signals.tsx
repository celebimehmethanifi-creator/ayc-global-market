import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../src/api/client";

const C = {
  void: "#050508", surface: "#0d0d1a", border: "#1e1e35",
  gold: "#f59e0b", up: "#10b981", down: "#ef4444", info: "#60a5fa",
  purple: "#7c3aed", text: "#ffffff", muted: "#ffffff70", dim: "#ffffff30",
};

const STAGE_META: Record<string, { color: string; bg: string; label: string; desc: string }> = {
  TRIGGER: { color: C.up,   bg: "#10b98115", label: "Tetik Alarmı",    desc: "Hacim destekli kırılım — giriş bölgesinde" },
  SETUP:   { color: C.gold, bg: "#f59e0b15", label: "Kurulum Oluşuyor", desc: "İşlem ihtimali doğdu — tetik bekleniyor" },
  WATCH:   { color: C.info, bg: "#60a5fa15", label: "İzleme Alarmı",   desc: "Hareket başlangıcı — yakın takip modu" },
  KALKAN:  { color: C.down, bg: "#ef444415", label: "KALKAN Bloke",    desc: "Sinyal var ama risk filtresi bloke etti" },
  NONE:    { color: C.dim,  bg: "#1e1e3520", label: "Sinyal Yok",      desc: "Sinyal şartları oluşmuyor" },
};

const MOCK_SIGNALS = [
  { id:"s1", symbol:"BTCUSDT", name:"Bitcoin",  stage:"SETUP",   direction:"LONG",  confidence:88, change_24h:1.82,  price:81250, ai_hint:"Kurulum oluştu. Fırsat 91/100. Kırılırsa tetik: $81,319.", trigger_level:81319, invalidation:79060, take_profit:84300, scores:{opportunity:91,risk:30,confidence:60,trend:61,liquidity:59,volatility:47} },
  { id:"s2", symbol:"XAUUSD",  name:"Altın",    stage:"TRIGGER", direction:"LONG",  confidence:79, change_24h:0.28,  price:3295,  ai_hint:"5/6 motor LONG. Fırsat 88 | Risk 22 | Güven 79.", trigger_level:3308, invalidation:3265, take_profit:3380, scores:{opportunity:88,risk:22,confidence:79,trend:82,liquidity:71,volatility:28} },
  { id:"s3", symbol:"NVDA",    name:"NVIDIA",   stage:"SETUP",   direction:"LONG",  confidence:83, change_24h:3.15,  price:875.2, ai_hint:"Bollinger kırılımı + momentum. Kurumsal birikim.", trigger_level:880, invalidation:845, take_profit:920, scores:{opportunity:83,risk:35,confidence:72,trend:74,liquidity:62,volatility:48} },
  { id:"s4", symbol:"ETHUSDT", name:"Ethereum", stage:"WATCH",   direction:"LONG",  confidence:72, change_24h:2.41,  price:2357,  ai_hint:"Hareket başlangıcı. 3/6 motor pozitif.", trigger_level:2380, invalidation:2290, take_profit:null, scores:{opportunity:68,risk:38,confidence:52,trend:55,liquidity:63,volatility:52} },
  { id:"s5", symbol:"TSLA",    name:"Tesla",    stage:"KALKAN",  direction:"SHORT", confidence:76, change_24h:-2.84, price:172.6, ai_hint:"KALKAN bloke: sahte kırılım riski yüksek.", trigger_level:null, invalidation:null, take_profit:null, scores:{opportunity:72,risk:68,confidence:38,trend:44,liquidity:42,volatility:78}, kalkan_reason:"Risk/ödül oranı kabul edilemez — sahte kırılım riski." },
];

const SCORE_KEYS = [
  { key: "opportunity", label: "Fırsat",   color: (v: number) => v>=65?C.up:v>=45?C.gold:C.down },
  { key: "risk",        label: "Risk",     color: (v: number) => v<=35?C.up:v<=60?C.gold:C.down },
  { key: "confidence",  label: "Güven",   color: (v: number) => v>=65?C.up:v>=45?C.gold:C.down },
  { key: "trend",       label: "Trend",   color: (v: number) => v>=60?C.up:v>=45?C.gold:C.down },
  { key: "liquidity",   label: "Likidite",color: (v: number) => v>=60?C.up:v>=40?C.gold:C.down },
  { key: "volatility",  label: "Volat.",  color: (v: number) => v<=40?C.up:v<=65?C.gold:C.down },
];

type StageFilter = "ALL" | "TRIGGER" | "SETUP" | "WATCH" | "KALKAN";

export default function SignalsScreen() {
  const [filter, setFilter] = useState<StageFilter>("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["signals-4stage", filter],
    queryFn: () => api.get("/signals/live?market=all&limit=15").then((r) => r.data).catch(() => null),
    refetchInterval: 60000,
  });

  const allSigs = data?.signals || MOCK_SIGNALS;
  const counts = data?.stage_counts || { TRIGGER: 1, SETUP: 2, WATCH: 1, KALKAN: 1 };
  const filtered = filter === "ALL" ? allSigs : allSigs.filter((s: any) => s.stage === filter);

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Signal Intelligence</Text>
        <Text style={s.sub}>4 Aşama · 7 Skor · KALKAN</Text>
      </View>

      {/* Stage filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        <TouchableOpacity onPress={() => setFilter("ALL")} style={[s.fBtn, filter === "ALL" && s.fBtnActive]}>
          <Text style={[s.fTxt, filter === "ALL" && { color: C.text }]}>Tümü ({allSigs.length})</Text>
        </TouchableOpacity>
        {(["TRIGGER", "SETUP", "WATCH", "KALKAN"] as const).map(stage => {
          const meta = STAGE_META[stage];
          return (
            <TouchableOpacity key={stage} onPress={() => setFilter(stage)}
              style={[s.fBtn, { borderColor: filter === stage ? meta.color : C.border, backgroundColor: filter === stage ? meta.bg : "transparent" }]}>
              <Text style={[s.fTxt, filter === stage && { color: meta.color, fontWeight: "800" }]}>
                {meta.label} {counts[stage] > 0 ? `(${counts[stage]})` : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {isLoading && <ActivityIndicator color={C.gold} style={{ margin: 16 }} />}

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={s.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.gold} />}
      >
        {filtered.map((sig: any) => {
          const meta = STAGE_META[sig.stage] || STAGE_META.NONE;
          const isLong = (sig.direction || "").toUpperCase() === "LONG";
          const conf = Number(sig.confidence || sig.scores?.confidence || 0);
          const chg = Number(sig.change_24h || 0);
          const isOpen = expanded === (sig.id || sig.symbol);
          const scores = sig.scores || {};

          return (
            <TouchableOpacity key={sig.id || sig.symbol}
              onPress={() => setExpanded(isOpen ? null : (sig.id || sig.symbol))}
              style={[s.card, { borderTopColor: meta.color }]}
              activeOpacity={0.85}>

              {/* Stage badge */}
              <View style={s.cardTop}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={s.sym}>{(sig.symbol || "").replace("USDT", "")}</Text>
                  <View style={[s.stageBadge, { backgroundColor: meta.bg, borderColor: meta.color + "50" }]}>
                    <Text style={[s.stageTxt, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[s.confNum, { color: conf >= 75 ? C.up : conf >= 55 ? C.gold : C.down }]}>{conf}</Text>
                  <Text style={s.confLbl}>güven</Text>
                </View>
              </View>

              <Text style={s.sigName}>{sig.name}</Text>

              {/* Price + change */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Text style={s.price}>${Number(sig.price || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}</Text>
                <View style={[s.dirBadge, { backgroundColor: isLong ? "#10b98115" : "#ef444415", borderColor: isLong ? "#10b98140" : "#ef444440" }]}>
                  <Text style={[s.dirTxt, { color: isLong ? C.up : C.down }]}>{isLong ? "▲ LONG" : "▼ SHORT"}</Text>
                </View>
              </View>

              {/* AI hint */}
              {sig.ai_hint && (
                <Text style={s.hint} numberOfLines={2}>{sig.ai_hint}</Text>
              )}

              {/* Confidence bar */}
              <View style={s.barBg}>
                <View style={[s.barFill, { width: `${conf}%` as any, backgroundColor: conf >= 75 ? C.up : conf >= 55 ? C.gold : C.down }]} />
              </View>

              {/* Expanded: score bars + levels */}
              {isOpen && (
                <View style={s.expanded}>
                  {/* 6 score bars */}
                  {SCORE_KEYS.map(({ key, label, color }) => {
                    const val = Number(scores[key] || 0);
                    return (
                      <View key={key} style={s.scoreRow}>
                        <Text style={s.scoreLbl}>{label}</Text>
                        <View style={s.scoreBarBg}>
                          <View style={[s.scoreBarFill, { width: `${val}%` as any, backgroundColor: color(val) }]} />
                        </View>
                        <Text style={[s.scoreVal, { color: color(val) }]}>{val}</Text>
                      </View>
                    );
                  })}
                  {/* Levels */}
                  {(sig.trigger_level || sig.invalidation) && (
                    <View style={s.levelsRow}>
                      {sig.trigger_level && (
                        <View style={s.levelItem}>
                          <Text style={s.levelLbl}>TETİK</Text>
                          <Text style={[s.levelVal, { color: C.up }]}>${Number(sig.trigger_level).toLocaleString()}</Text>
                        </View>
                      )}
                      {sig.invalidation && (
                        <View style={s.levelItem}>
                          <Text style={s.levelLbl}>İPTAL</Text>
                          <Text style={[s.levelVal, { color: C.down }]}>${Number(sig.invalidation).toLocaleString()}</Text>
                        </View>
                      )}
                      {sig.take_profit && (
                        <View style={s.levelItem}>
                          <Text style={s.levelLbl}>HEDEF</Text>
                          <Text style={[s.levelVal, { color: C.up }]}>${Number(sig.take_profit).toLocaleString()}</Text>
                        </View>
                      )}
                    </View>
                  )}
                  {/* KALKAN warning */}
                  {sig.kalkan_reason && (
                    <View style={s.kalkanWarn}>
                      <Text style={s.kalkanTxt}>⚠️ {sig.kalkan_reason}</Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { color: C.text, fontSize: 22, fontWeight: "800" },
  sub: { color: C.muted, fontSize: 11, marginTop: 2 },
  filterScroll: { marginBottom: 8 },
  fBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  fBtnActive: { backgroundColor: "#ffffff15", borderColor: C.text },
  fTxt: { color: C.muted, fontSize: 11, fontWeight: "600" },
  list: { flex: 1, paddingHorizontal: 16 },
  card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderTopWidth: 2, borderRadius: 16, padding: 14, marginBottom: 12 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  sym: { color: C.text, fontSize: 18, fontWeight: "800" },
  stageBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  stageTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  confNum: { fontSize: 22, fontWeight: "800", lineHeight: 24 },
  confLbl: { color: C.dim, fontSize: 8, textAlign: "center" },
  sigName: { color: C.muted, fontSize: 11, marginBottom: 8 },
  price: { color: C.text, fontSize: 18, fontWeight: "800" },
  dirBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  dirTxt: { fontSize: 10, fontWeight: "800" },
  hint: { color: C.muted, fontSize: 11, lineHeight: 16, marginBottom: 8 },
  barBg: { height: 3, backgroundColor: C.border, borderRadius: 2, overflow: "hidden", marginBottom: 4 },
  barFill: { height: 3, borderRadius: 2 },
  expanded: { marginTop: 12, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 5 },
  scoreLbl: { color: C.dim, fontSize: 9, fontWeight: "700", width: 46 },
  scoreBarBg: { flex: 1, height: 4, backgroundColor: C.border, borderRadius: 2, overflow: "hidden" },
  scoreBarFill: { height: 4, borderRadius: 2 },
  scoreVal: { fontSize: 9, fontWeight: "800", width: 22, textAlign: "right" },
  levelsRow: { flexDirection: "row", gap: 12, marginTop: 10, backgroundColor: "#1e1e3540", borderRadius: 10, padding: 10 },
  levelItem: {},
  levelLbl: { color: C.dim, fontSize: 8, fontWeight: "700", marginBottom: 2 },
  levelVal: { fontSize: 11, fontWeight: "800" },
  kalkanWarn: { marginTop: 8, backgroundColor: "#ef444415", borderWidth: 1, borderColor: "#ef444440", borderRadius: 8, padding: 8 },
  kalkanTxt: { color: C.down, fontSize: 10, lineHeight: 15 },
});
