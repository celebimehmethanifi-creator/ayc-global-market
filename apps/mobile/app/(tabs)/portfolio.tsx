import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const C = {
  void: "#050508", surface: "#11111f", border: "#1e1e35",
  primary: "#7c3aed", accent: "#06b6d4", bull: "#10b981", bear: "#ef4444",
  text: "#ffffff", muted: "#ffffff60", dim: "#ffffff25",
};

type Position = {
  id: string;
  symbol: string;
  name: string;
  qty: string;
  avgCost: string;
  current: string;
  pnl: number;
};

const MOCK_POSITIONS: Position[] = [
  { id: "1", symbol: "BTC", name: "Bitcoin", qty: "0.15", avgCost: "58,000", current: "67,420", pnl: 14.1 },
  { id: "2", symbol: "THYAO", name: "Türk Hava Yolları", qty: "100", avgCost: "₺280", current: "₺312", pnl: 11.4 },
  { id: "3", symbol: "NVDA", name: "Nvidia", qty: "5", avgCost: "$750", current: "$887", pnl: 18.3 },
  { id: "4", symbol: "GOLD", name: "Altın", qty: "2", avgCost: "$2,100", current: "$2,312", pnl: 10.1 },
];

export default function PortfolioScreen() {
  const [positions, setPositions] = useState<Position[]>(MOCK_POSITIONS);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ symbol: "", name: "", qty: "", avgCost: "" });

  const totalPnl = positions.reduce((acc, p) => acc + p.pnl, 0) / positions.length;

  const addPosition = () => {
    if (!form.symbol || !form.qty || !form.avgCost) {
      Alert.alert("Eksik bilgi", "Sembol, miktar ve maliyet fiyatı gereklidir.");
      return;
    }
    const newPos: Position = {
      id: Date.now().toString(),
      symbol: form.symbol.toUpperCase(),
      name: form.name || form.symbol.toUpperCase(),
      qty: form.qty,
      avgCost: form.avgCost,
      current: form.avgCost,
      pnl: 0,
    };
    setPositions([newPos, ...positions]);
    setForm({ symbol: "", name: "", qty: "", avgCost: "" });
    setShowAdd(false);
  };

  return (
    <SafeAreaView style={s.root}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Portföy</Text>
            <Text style={s.sub}>Manuel takip modu</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(!showAdd)}>
            <Text style={s.addBtnText}>{showAdd ? "İptal" : "+ Ekle"}</Text>
          </TouchableOpacity>
        </View>

        {/* Summary card */}
        <View style={s.summaryCard}>
          <Text style={s.summaryLabel}>Ortalama Getiri</Text>
          <Text style={[s.summaryValue, { color: totalPnl >= 0 ? C.bull : C.bear }]}>
            {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}%
          </Text>
          <Text style={s.summaryCount}>{positions.length} pozisyon</Text>
        </View>

        {/* Add form */}
        {showAdd && (
          <View style={s.addForm}>
            <Text style={s.formTitle}>Yeni Pozisyon</Text>
            <TextInput
              style={s.input} placeholder="Sembol (BTC, THYAO...)"
              placeholderTextColor={C.dim} value={form.symbol}
              onChangeText={(v) => setForm({ ...form, symbol: v })}
              autoCapitalize="characters"
            />
            <TextInput
              style={s.input} placeholder="İsim (opsiyonel)"
              placeholderTextColor={C.dim} value={form.name}
              onChangeText={(v) => setForm({ ...form, name: v })}
            />
            <View style={s.formRow}>
              <TextInput
                style={[s.input, s.halfInput]} placeholder="Miktar"
                placeholderTextColor={C.dim} value={form.qty} keyboardType="decimal-pad"
                onChangeText={(v) => setForm({ ...form, qty: v })}
              />
              <TextInput
                style={[s.input, s.halfInput]} placeholder="Ort. Maliyet"
                placeholderTextColor={C.dim} value={form.avgCost} keyboardType="decimal-pad"
                onChangeText={(v) => setForm({ ...form, avgCost: v })}
              />
            </View>
            <TouchableOpacity style={s.saveBtn} onPress={addPosition}>
              <Text style={s.saveBtnText}>Kaydet</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Positions list */}
        <Text style={s.sectionTitle}>Pozisyonlar</Text>
        {positions.map((pos) => (
          <View key={pos.id} style={s.posCard}>
            <View style={s.posTop}>
              <View style={s.symbolBadge}>
                <Text style={s.badgeText}>{pos.symbol.slice(0, 4)}</Text>
              </View>
              <View style={s.posInfo}>
                <Text style={s.posSymbol}>{pos.symbol}</Text>
                <Text style={s.posName}>{pos.name}</Text>
              </View>
              <View style={s.posRight}>
                <Text style={[s.posPnl, { color: pos.pnl >= 0 ? C.bull : C.bear }]}>
                  {pos.pnl >= 0 ? "+" : ""}{pos.pnl.toFixed(2)}%
                </Text>
                <Text style={s.posCurrent}>{pos.current}</Text>
              </View>
            </View>
            <View style={s.posMeta}>
              <Text style={s.metaItem}>Miktar: {pos.qty}</Text>
              <Text style={s.metaItem}>Maliyet: {pos.avgCost}</Text>
            </View>
          </View>
        ))}

        <View style={s.disclaimerWrap}>
          <Text style={s.disclaimerText}>
            Portföy verileri cihazınızda tutulur. Gerçek fiyatlar API bağlantısı gerektir.
          </Text>
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { color: C.text, fontSize: 22, fontWeight: "800" },
  sub: { color: C.muted, fontSize: 12, marginTop: 2 },
  addBtn: { backgroundColor: C.primary + "22", borderWidth: 1, borderColor: C.primary + "44", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  addBtnText: { color: C.primary, fontSize: 13, fontWeight: "700" },
  summaryCard: { marginHorizontal: 16, marginBottom: 16, backgroundColor: C.primary + "15", borderWidth: 1, borderColor: C.primary + "30", borderRadius: 16, padding: 20, alignItems: "center" },
  summaryLabel: { color: C.muted, fontSize: 12 },
  summaryValue: { fontSize: 36, fontWeight: "800", fontFamily: "monospace", marginVertical: 4 },
  summaryCount: { color: C.dim, fontSize: 12 },
  addForm: { marginHorizontal: 16, marginBottom: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16 },
  formTitle: { color: C.text, fontSize: 14, fontWeight: "700", marginBottom: 12 },
  input: { backgroundColor: C.void, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: C.text, fontSize: 14, marginBottom: 8 },
  formRow: { flexDirection: "row", gap: 8 },
  halfInput: { flex: 1 },
  saveBtn: { backgroundColor: C.primary, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  sectionTitle: { color: C.text, fontSize: 14, fontWeight: "700", marginHorizontal: 16, marginBottom: 8 },
  posCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14 },
  posTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  symbolBadge: { width: 40, height: 40, borderRadius: 10, backgroundColor: C.primary + "20", alignItems: "center", justifyContent: "center" },
  badgeText: { color: C.primary, fontSize: 10, fontWeight: "800" },
  posInfo: { flex: 1 },
  posSymbol: { color: C.text, fontSize: 16, fontWeight: "800" },
  posName: { color: C.muted, fontSize: 11 },
  posRight: { alignItems: "flex-end" },
  posPnl: { fontSize: 16, fontWeight: "800", fontFamily: "monospace" },
  posCurrent: { color: C.muted, fontSize: 12, marginTop: 2 },
  posMeta: { flexDirection: "row", gap: 20 },
  metaItem: { color: C.dim, fontSize: 11 },
  disclaimerWrap: { marginHorizontal: 16, marginTop: 8 },
  disclaimerText: { color: C.dim, fontSize: 10, textAlign: "center" },
});
