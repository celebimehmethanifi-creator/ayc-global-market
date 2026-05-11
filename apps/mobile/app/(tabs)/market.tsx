import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../src/api/client";

const C = {
  void: "#050508", deep: "#0a0a12", surface: "#11111f", border: "#1e1e35",
  primary: "#7c3aed", accent: "#06b6d4", bull: "#10b981", bear: "#ef4444",
  text: "#ffffff", muted: "#ffffff60", dim: "#ffffff25",
};

const CATEGORIES = ["Tümü", "BIST", "ABD", "Kripto", "Emtia", "Enerji", "Forex", "Endeksler", "ETF"];

const MOCK_ASSETS = [
  { symbol: "BTC", name: "Bitcoin", price: "67,420", change: "+2.34", cat: "Kripto", bull: true },
  { symbol: "ETH", name: "Ethereum", price: "3,241", change: "+1.82", cat: "Kripto", bull: true },
  { symbol: "THYAO", name: "Türk Hava Yolları", price: "₺312.40", change: "-0.91", cat: "BIST", bull: false },
  { symbol: "AAPL", name: "Apple Inc.", price: "$185.20", change: "+0.55", cat: "ABD", bull: true },
  { symbol: "TSLA", name: "Tesla", price: "$172.10", change: "-2.10", cat: "ABD", bull: false },
  { symbol: "GOLD", name: "Altın (XAU/USD)", price: "$2,312", change: "+0.72", cat: "Emtia", bull: true },
  { symbol: "EUR/USD", name: "Euro / Dolar", price: "1.0842", change: "-0.12", cat: "Forex", bull: false },
  { symbol: "SASE", name: "Sasa Polyester", price: "₺48.92", change: "+3.21", cat: "BIST", bull: true },
  { symbol: "NVDA", name: "Nvidia", price: "$887.00", change: "+4.10", cat: "ABD", bull: true },
  { symbol: "OIL", name: "Ham Petrol", price: "$82.40", change: "-0.34", cat: "Enerji", bull: false },
];

export default function MarketScreen() {
  const [activeCategory, setActiveCategory] = useState("Tümü");

  const { data, isLoading, refetch, isError } = useQuery({
    queryKey: ["market-assets", activeCategory],
    queryFn: () =>
      api.get(`/assets?category=${activeCategory}&limit=30`).then((r) => r.data.items),
    retry: 1,
    staleTime: 30000,
  });

  const assets = isError || !data ? MOCK_ASSETS.filter(
    a => activeCategory === "Tümü" || a.cat === activeCategory
  ) : data;

  return (
    <SafeAreaView style={s.root}>
      {/* Category Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catBar} contentContainerStyle={s.catContent}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            onPress={() => setActiveCategory(cat)}
            style={[s.catChip, activeCategory === cat && s.catChipActive]}
          >
            <Text style={[s.catText, activeCategory === cat && s.catTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isError && (
        <View style={s.offlineBanner}>
          <Text style={s.offlineText}>Sunucuya bağlanılamadı — demo veriler gösteriliyor</Text>
        </View>
      )}

      <ScrollView
        style={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={C.primary} />}
      >
        <View style={s.tableHeader}>
          <Text style={[s.col1, s.headerText]}>Sembol</Text>
          <Text style={[s.col2, s.headerText]}>Fiyat</Text>
          <Text style={[s.col3, s.headerText]}>Değişim</Text>
        </View>

        {assets.map((asset: any, i: number) => {
          const isUp = String(asset.change ?? asset.change_24h ?? "0").startsWith("+") ||
                       parseFloat(asset.change ?? asset.change_24h ?? 0) > 0;
          return (
            <TouchableOpacity key={asset.symbol + i} style={s.row} activeOpacity={0.75}>
              <View style={s.col1}>
                <View style={s.symbolBadge}>
                  <Text style={s.symbolText}>{(asset.symbol ?? "").slice(0, 4)}</Text>
                </View>
                <Text style={s.nameText} numberOfLines={1}>{asset.name}</Text>
              </View>
              <Text style={[s.col2, s.priceText]}>
                {asset.price ?? (asset.last_price != null ? Number(asset.last_price).toLocaleString() : "—")}
              </Text>
              <View style={s.col3}>
                <Text style={[s.changeText, { color: isUp ? C.bull : C.bear }]}>
                  {isUp ? "+" : ""}{asset.change ?? asset.change_24h ?? "0"}%
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {isLoading && <ActivityIndicator color={C.primary} style={{ margin: 20 }} />}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  catBar: { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: C.border },
  catContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: "row" },
  catChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  catChipActive: { backgroundColor: C.primary + "22", borderColor: C.primary },
  catText: { color: C.muted, fontSize: 12, fontWeight: "600" },
  catTextActive: { color: C.primary },
  offlineBanner: { backgroundColor: C.bear + "15", borderBottomWidth: 1, borderBottomColor: C.bear + "30", paddingHorizontal: 16, paddingVertical: 8 },
  offlineText: { color: C.bear, fontSize: 11 },
  list: { flex: 1 },
  tableHeader: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  headerText: { color: C.dim, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  row: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border + "88", alignItems: "center" },
  col1: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  col2: { width: 90, textAlign: "right" },
  col3: { width: 80, alignItems: "flex-end" },
  symbolBadge: { width: 36, height: 36, borderRadius: 8, backgroundColor: C.primary + "20", alignItems: "center", justifyContent: "center" },
  symbolText: { color: C.primary, fontSize: 10, fontWeight: "800" },
  nameText: { color: C.muted, fontSize: 12, flex: 1 },
  priceText: { color: C.text, fontSize: 13, fontWeight: "700", fontFamily: "monospace" },
  changeText: { fontSize: 13, fontWeight: "700", fontFamily: "monospace" },
});
