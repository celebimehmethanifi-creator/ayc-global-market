import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../src/api/client";

const C = {
  void: "#050508", surface: "#0d0d1a", border: "#1e1e35",
  gold: "#f59e0b", up: "#10b981", down: "#ef4444", info: "#60a5fa",
  text: "#ffffff", muted: "#ffffff70", dim: "#ffffff30",
};

type ScenarioOutcome = "KAZANÇ_YÜKSEK"|"KAZANÇ_ORTA"|"NÖTR"|"KAYIP_ORTA"|"KAYIP_YÜKSEK"|"LİKİDASYON";

const OUTCOME_COLOR: Record<ScenarioOutcome, string> = {
  KAZANÇ_YÜKSEK: C.up, KAZANÇ_ORTA: C.up, NÖTR: "#6b7280",
  KAYIP_ORTA: C.down, KAYIP_YÜKSEK: C.down, LİKİDASYON: C.down,
};

const MOCK_REPORT = {
  symbol: "BTCUSDT", price: 81250, direction: "LONG",
  recommended: "Tetik Bekle",
  key_insight: "R/R 2.1 ve güven %72 — makul. Tetik onayıyla girişte sahte kırılım riski %40 azalır.",
  scenarios: [
    { name: "Şimdi Gir",      outcome: "KAZANÇ_ORTA",   expected_pnl_pct: 1.8,  max_loss_pct: 2.4,  probability: 62, risk_reward: 1.8,  kelly_size: 0.07, verdict: "Kabul edilebilir R/R 1.8. Slippage riski var." },
    { name: "Tetik Bekle",    outcome: "KAZANÇ_YÜKSEK",  expected_pnl_pct: 2.3,  max_loss_pct: 1.9,  probability: 72, risk_reward: 2.1,  kelly_size: 0.09, verdict: "En verimli giriş. Sahte kırılım riski %40 düşer." },
    { name: "Stop Koymadan",  outcome: "KAYIP_YÜKSEK",   expected_pnl_pct: 0.4,  max_loss_pct: 6.2,  probability: 57, risk_reward: 0.6,  kelly_size: 0.0,  verdict: "CVaR: %6.2. Stop olmadan açık pozisyon.", warning: "KALKAN: Stop koyma!" },
    { name: "3x Kaldıraç",    outcome: "LİKİDASYON",     expected_pnl_pct: 3.8,  max_loss_pct: 30.0, probability: 47, risk_reward: 1.2,  kelly_size: 0.0,  verdict: "Likidasyon %30 mesafede.", warning: "KALKAN AKTİF: Kelly = 0" },
    { name: "Bekle / Geç",    outcome: "NÖTR",            expected_pnl_pct: 0.0,  max_loss_pct: 0.0,  probability: 100,risk_reward: 0.0,  kelly_size: 0.0,  verdict: "Sermaye korunur. Başka fırsat ara." },
    { name: "Yarı Pozisyon",  outcome: "KAZANÇ_ORTA",    expected_pnl_pct: 1.1,  max_loss_pct: 1.0,  probability: 68, risk_reward: 2.0,  kelly_size: 0.05, verdict: "Konservatif. Kayıp %1'e sınırlanır." },
  ],
};

export default function ScenarioScreen() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [confidence, setConfidence] = useState("72");
  const [direction, setDirection] = useState<"LONG"|"SHORT">("LONG");
  const [ran, setRan] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["scenario-mobile", symbol],
    queryFn: () =>
      api.post("/intelligence/scenario", {
        symbol, price: 81250, direction, confidence_score: parseFloat(confidence) || 60,
        volatility_daily: 3, leverage: 1, market: "crypto",
      }).then((r) => r.data).catch(() => null),
    enabled: ran,
  });

  const report = data || MOCK_REPORT;

  return (
    <SafeAreaView style={s.root}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Senaryo Simülatörü</Text>
          <Text style={s.sub}>Kelly Criterion · CVaR · 6 Senaryo</Text>
        </View>

        {/* Form */}
        <View style={s.form}>
          <View style={s.inputRow}>
            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>SEMBOL</Text>
              <TextInput value={symbol} onChangeText={setSymbol}
                style={s.input} placeholderTextColor={C.dim} placeholder="BTCUSDT" />
            </View>
            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>GÜVEN %</Text>
              <TextInput value={confidence} onChangeText={setConfidence}
                style={s.input} placeholderTextColor={C.dim} placeholder="72" keyboardType="numeric" />
            </View>
          </View>
          <View style={s.dirRow}>
            {(["LONG","SHORT"] as const).map(d => (
              <TouchableOpacity key={d} onPress={() => setDirection(d)}
                style={[s.dirBtn, direction === d && { backgroundColor: d==="LONG"?"#10b98120":"#ef444420", borderColor: d==="LONG"?C.up:C.down }]}>
                <Text style={[s.dirTxt, { color: direction === d ? (d==="LONG"?C.up:C.down) : C.muted }]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={() => { setRan(true); refetch(); }} style={s.runBtn}>
            {isLoading ? <ActivityIndicator color={C.void} /> : <Text style={s.runTxt}>Simülasyonu Çalıştır</Text>}
          </TouchableOpacity>
        </View>

        {/* Key insight */}
        <View style={s.insightCard}>
          <Text style={s.insightLabel}>TEMEL İÇGÖRÜ</Text>
          <Text style={s.insightTxt}>{report.key_insight}</Text>
          <View style={s.recRow}>
            <Text style={s.dimTxt}>Önerilen:</Text>
            <View style={s.recBadge}>
              <Text style={s.recTxt}>{report.recommended}</Text>
            </View>
          </View>
        </View>

        {/* Scenarios */}
        <View style={s.scenSection}>
          {report.scenarios.map((sc: any) => {
            const isRec = sc.name === report.recommended;
            const color = OUTCOME_COLOR[sc.outcome as ScenarioOutcome] || C.muted;
            return (
              <View key={sc.name} style={[s.scCard, isRec && { borderColor: C.gold }]}>
                {isRec && (
                  <View style={s.recFlag}>
                    <Text style={s.recFlagTxt}>ÖNERİLEN</Text>
                  </View>
                )}
                <Text style={s.scName}>{sc.name}</Text>
                <View style={s.scGrid}>
                  {[
                    { lbl: "PnL",      val: `${sc.expected_pnl_pct>=0?"+":""}${sc.expected_pnl_pct}%`, color: sc.expected_pnl_pct>=0?C.up:C.down },
                    { lbl: "Max Kayıp",val: `-${sc.max_loss_pct}%`, color: C.down },
                    { lbl: "Başarı",   val: `${sc.probability}%`, color: sc.probability>=65?C.up:sc.probability>=45?C.gold:C.down },
                    { lbl: "R/R",      val: `${sc.risk_reward}x`, color: sc.risk_reward>=2?C.up:sc.risk_reward>=1?C.gold:C.down },
                    { lbl: "Kelly",    val: sc.kelly_size>0?`${(sc.kelly_size*100).toFixed(0)}%`:"—", color: C.text },
                    { lbl: "Sonuç",    val: sc.outcome.replace("_"," "), color },
                  ].map(({ lbl, val, color: vColor }) => (
                    <View key={lbl} style={s.scMetaItem}>
                      <Text style={s.scMetaLbl}>{lbl}</Text>
                      <Text style={[s.scMetaVal, { color: vColor }]}>{val}</Text>
                    </View>
                  ))}
                </View>
                <Text style={s.scVerdict}>{sc.verdict}</Text>
                {sc.warning && (
                  <View style={s.warnBox}>
                    <Text style={s.warnTxt}>⚠️ {sc.warning}</Text>
                  </View>
                )}
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
  form: { marginHorizontal: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, marginBottom: 16 },
  inputRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  inputGroup: { flex: 1 },
  inputLabel: { color: C.dim, fontSize: 9, fontWeight: "700", letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: "#1e1e3560", borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: C.text, fontSize: 13 },
  dirRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  dirBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  dirTxt: { fontSize: 12, fontWeight: "800" },
  runBtn: { backgroundColor: C.gold, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  runTxt: { color: C.void, fontSize: 13, fontWeight: "800" },
  insightCard: { marginHorizontal: 16, backgroundColor: "#60a5fa10", borderWidth: 1, borderColor: "#60a5fa30", borderRadius: 14, padding: 14, marginBottom: 16 },
  insightLabel: { color: C.info, fontSize: 9, fontWeight: "800", letterSpacing: 0.8, marginBottom: 6 },
  insightTxt: { color: C.text, fontSize: 12, lineHeight: 18, marginBottom: 10 },
  recRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dimTxt: { color: C.dim, fontSize: 10 },
  recBadge: { backgroundColor: "#f59e0b15", borderWidth: 1, borderColor: "#f59e0b40", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  recTxt: { color: C.gold, fontSize: 11, fontWeight: "800" },
  scenSection: { paddingHorizontal: 16 },
  scCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, marginBottom: 12, position: "relative" },
  recFlag: { position: "absolute", top: 10, right: 12, backgroundColor: "#f59e0b15", borderWidth: 1, borderColor: "#f59e0b40", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  recFlagTxt: { color: C.gold, fontSize: 8, fontWeight: "800" },
  scName: { color: C.text, fontSize: 14, fontWeight: "800", marginBottom: 10 },
  scGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  scMetaItem: { backgroundColor: "#1e1e3560", borderRadius: 8, padding: 8, minWidth: "28%" },
  scMetaLbl: { color: C.dim, fontSize: 8, fontWeight: "700", marginBottom: 3 },
  scMetaVal: { fontSize: 12, fontWeight: "800" },
  scVerdict: { color: C.muted, fontSize: 11, lineHeight: 16 },
  warnBox: { marginTop: 8, backgroundColor: "#ef444415", borderWidth: 1, borderColor: "#ef444440", borderRadius: 8, padding: 8 },
  warnTxt: { color: C.down, fontSize: 10 },
});
