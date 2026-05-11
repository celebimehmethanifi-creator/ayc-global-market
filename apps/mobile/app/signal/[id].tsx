import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";

const C = {
  void: "#050508", surface: "#11111f", border: "#1e1e35",
  primary: "#7c3aed", accent: "#06b6d4", bull: "#10b981", bear: "#ef4444",
  text: "#ffffff", muted: "#ffffff60", dim: "#ffffff25",
};

// Mock detail veri
const MOCK_DETAIL: Record<string, any> = {
  "1": { symbol: "BTCUSDT", name: "Bitcoin", direction: "long", confidence: 87, risk_reward: 2.4, category: "Kripto", entry: "66,800", target: "72,000", stop: "64,200", timeframe: "4H", reasoning: "BTC, 65,000 desteğini test etti ve güçlü bir dip oluşumu gözlemleniyor. RSI aşırı satım bölgesinden çıkıyor, MACD pozitif kesişime yakın. On-chain veriler birikim fazına işaret ediyor.", ai_models: ["GPT-4o", "Claude 3.5"], consensus: 87, disclaimer: "Bu analiz algoritmik modellerden üretilmiştir. Yatırım tavsiyesi değildir." },
};

export default function SignalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sig = MOCK_DETAIL[id ?? ""] ?? {
    symbol: "DEMO", name: "Demo Sinyal", direction: "long", confidence: 75,
    risk_reward: 2.0, entry: "100", target: "120", stop: "90",
    timeframe: "1D", category: "Demo",
    reasoning: "API bağlantısı olmadığı için bu örnek veri gösterilmektedir.",
    ai_models: ["GPT-4o", "Claude 3.5"], consensus: 75,
    disclaimer: "Bu analiz algoritmik modellerden üretilmiştir. Yatırım tavsiyesi değildir.",
  };

  const isLong = sig.direction === "long";
  const dirColor = isLong ? C.bull : C.bear;

  return (
    <SafeAreaView style={s.root}>
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>Sinyal Detayı</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroTop}>
            <Text style={s.heroSymbol}>{sig.symbol?.replace(".IS", "").replace("USDT", "")}</Text>
            <View style={[s.dirBadge, { backgroundColor: dirColor + "20", borderColor: dirColor + "40" }]}>
              <Text style={[s.dirText, { color: dirColor }]}>
                {isLong ? "▲" : "▼"} {sig.direction?.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={s.heroName}>{sig.name} • {sig.category} • {sig.timeframe}</Text>

          {/* Confidence gauge */}
          <View style={s.confidenceWrap}>
            <View style={s.confRow}>
              <Text style={s.confLabel}>AI Güven</Text>
              <Text style={[s.confValue, { color: dirColor }]}>{sig.confidence}%</Text>
            </View>
            <View style={s.barBg}>
              <View style={[s.barFill, { width: `${sig.confidence}%` as any, backgroundColor: dirColor }]} />
            </View>
            <Text style={s.modelsText}>
              {sig.ai_models?.join(" + ")} consensus
            </Text>
          </View>
        </View>

        {/* Levels */}
        <View style={s.levelsCard}>
          <Text style={s.cardTitle}>Seviyeleri</Text>
          <View style={s.levelsGrid}>
            <View style={s.levelItem}>
              <Text style={s.levelLabel}>Giriş</Text>
              <Text style={[s.levelValue, { color: C.accent }]}>{sig.entry}</Text>
            </View>
            <View style={[s.levelItem, s.levelBorder]}>
              <Text style={s.levelLabel}>Hedef</Text>
              <Text style={[s.levelValue, { color: C.bull }]}>{sig.target}</Text>
            </View>
            <View style={s.levelItem}>
              <Text style={s.levelLabel}>Stop Loss</Text>
              <Text style={[s.levelValue, { color: C.bear }]}>{sig.stop}</Text>
            </View>
          </View>
        </View>

        {/* Risk/Reward */}
        <View style={s.rrCard}>
          <Text style={s.rrLabel}>Risk / Ödül Oranı</Text>
          <Text style={[s.rrValue, { color: C.accent }]}>{sig.risk_reward}x</Text>
          <Text style={s.rrSub}>Her 1 birim riske karşılık {sig.risk_reward} birim potansiyel getiri</Text>
        </View>

        {/* Reasoning */}
        <View style={s.reasonCard}>
          <Text style={s.cardTitle}>AI Analizi</Text>
          <Text style={s.reasonText}>{sig.reasoning}</Text>
        </View>

        {/* Disclaimer */}
        <View style={s.disclaimerCard}>
          <Text style={s.disclaimerText}>⚠️ {sig.disclaimer}</Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { padding: 4 },
  backText: { color: C.primary, fontSize: 14 },
  topTitle: { color: C.text, fontSize: 15, fontWeight: "700" },
  hero: { padding: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  heroSymbol: { color: C.text, fontSize: 28, fontWeight: "900" },
  dirBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  dirText: { fontSize: 13, fontWeight: "800" },
  heroName: { color: C.muted, fontSize: 12, marginBottom: 20 },
  confidenceWrap: { gap: 6 },
  confRow: { flexDirection: "row", justifyContent: "space-between" },
  confLabel: { color: C.muted, fontSize: 13 },
  confValue: { fontSize: 18, fontWeight: "800", fontFamily: "monospace" },
  barBg: { height: 6, backgroundColor: C.border, borderRadius: 3, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  modelsText: { color: C.dim, fontSize: 10 },
  levelsCard: { margin: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16 },
  cardTitle: { color: C.text, fontSize: 14, fontWeight: "700", marginBottom: 14 },
  levelsGrid: { flexDirection: "row" },
  levelItem: { flex: 1, alignItems: "center" },
  levelBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.border },
  levelLabel: { color: C.dim, fontSize: 11, marginBottom: 4 },
  levelValue: { fontSize: 16, fontWeight: "800", fontFamily: "monospace" },
  rrCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: C.accent + "10", borderWidth: 1, borderColor: C.accent + "30", borderRadius: 16, padding: 16, alignItems: "center" },
  rrLabel: { color: C.muted, fontSize: 12 },
  rrValue: { fontSize: 36, fontWeight: "900", fontFamily: "monospace", marginVertical: 4 },
  rrSub: { color: C.dim, fontSize: 11, textAlign: "center" },
  reasonCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16 },
  reasonText: { color: C.muted, fontSize: 13, lineHeight: 20 },
  disclaimerCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: "#f59e0b10", borderWidth: 1, borderColor: "#f59e0b30", borderRadius: 12, padding: 12 },
  disclaimerText: { color: "#f59e0b", fontSize: 11, lineHeight: 16 },
});
