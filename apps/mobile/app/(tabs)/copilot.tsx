import React, { useState, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../../../src/api/client";

const C = {
  void: "#050508", surface: "#11111f", border: "#1e1e35",
  primary: "#7c3aed", accent: "#06b6d4",
  text: "#ffffff", muted: "#ffffff60", dim: "#ffffff25",
};

type Message = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  "BTC şu an alınır mı?",
  "Bugün hangi sektörler güçlü?",
  "Portföyüm için risk analizi yap",
  "Dolar/TL için görüşün ne?",
];

const OFFLINE_RESPONSE = `Şu an API sunucusuna bağlanılamıyor, ancak NEURA AI Copilot çevrimiçi olduğunda şunları yapabilirsin:

- Piyasa analizi ve yorumları
- Portföy risk değerlendirmesi
- Belirli varlıklar için teknik/temel analiz
- What-if senaryoları simüle etme
- Sabah brifingi ve günlük özet

API sunucusunu başlatmak için:
\`cd services/gateway && uvicorn main:app --reload\``;

export default function CopilotScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Merhaba! Ben NEURA AI Copilot. Piyasalar, portföyün veya herhangi bir varlık hakkında soru sorabilirsin.\n\n⚠️ Bu bilgilendirme amaçlıdır, yatırım tavsiyesi değildir.",
    },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  const { data: briefing } = useQuery({
    queryKey: ["briefing-copilot"],
    queryFn: () => api.get("/copilot/briefing/latest").then((r) => r.data),
    retry: 0,
    staleTime: 1000 * 60 * 30,
  });

  const chatMutation = useMutation({
    mutationFn: (question: string) =>
      api.post("/copilot/chat", { question }).then((r) => r.data.answer),
    onSuccess: (answer) => {
      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    },
    onError: () => {
      setMessages((prev) => [...prev, { role: "assistant", content: OFFLINE_RESPONSE }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    },
  });

  const send = (text?: string) => {
    const q = (text ?? input).trim();
    if (!q) return;
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setInput("");
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    chatMutation.mutate(q);
  };

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.aiBadge}>
            <Text style={s.aiDot}>◉</Text>
          </View>
          <View>
            <Text style={s.title}>AI Copilot</Text>
            <Text style={s.sub}>GPT-4o + Claude 3.5 consensus</Text>
          </View>
        </View>

        {/* Morning briefing */}
        {briefing?.summary && (
          <View style={s.briefingCard}>
            <Text style={s.briefingTitle}>🌅 Sabah Brifing</Text>
            <Text style={s.briefingText} numberOfLines={3}>{briefing.summary}</Text>
          </View>
        )}

        {/* Quick prompts */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.quickBar} contentContainerStyle={s.quickContent}>
          {QUICK_PROMPTS.map((p) => (
            <TouchableOpacity key={p} style={s.quickChip} onPress={() => send(p)}>
              <Text style={s.quickText}>{p}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Messages */}
        <ScrollView ref={scrollRef} style={s.messages} showsVerticalScrollIndicator={false}>
          {messages.map((m, i) => (
            <View key={i} style={[s.bubble, m.role === "user" ? s.userBubble : s.aiBubble]}>
              {m.role === "assistant" && (
                <Text style={s.roleBadge}>NEURA</Text>
              )}
              <Text style={[s.bubbleText, m.role === "user" && s.userText]}>
                {m.content}
              </Text>
            </View>
          ))}
          {chatMutation.isPending && (
            <View style={s.aiBubble}>
              <Text style={s.roleBadge}>NEURA</Text>
              <ActivityIndicator size="small" color={C.primary} />
            </View>
          )}
          <View style={{ height: 16 }} />
        </ScrollView>

        {/* Input */}
        <View style={s.inputRow}>
          <TextInput
            style={s.textInput}
            placeholder="Bir soru sor..."
            placeholderTextColor={C.dim}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            onSubmitEditing={() => send()}
          />
          <TouchableOpacity
            style={[s.sendBtn, !input.trim() && s.sendBtnDisabled]}
            onPress={() => send()}
            disabled={!input.trim() || chatMutation.isPending}
          >
            <Text style={s.sendIcon}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  aiBadge: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.primary + "20", borderWidth: 1, borderColor: C.primary + "40", alignItems: "center", justifyContent: "center" },
  aiDot: { color: C.primary, fontSize: 16 },
  title: { color: C.text, fontSize: 18, fontWeight: "800" },
  sub: { color: C.muted, fontSize: 10 },
  briefingCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: C.surface, borderLeftWidth: 2, borderLeftColor: C.primary, borderRadius: 10, padding: 12 },
  briefingTitle: { color: C.primary, fontSize: 11, fontWeight: "700", marginBottom: 4 },
  briefingText: { color: C.muted, fontSize: 11, lineHeight: 16 },
  quickBar: { maxHeight: 46, marginBottom: 4 },
  quickContent: { paddingHorizontal: 16, gap: 8, flexDirection: "row" },
  quickChip: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  quickText: { color: C.muted, fontSize: 11 },
  messages: { flex: 1, paddingHorizontal: 16 },
  bubble: { maxWidth: "85%", marginVertical: 4, padding: 12, borderRadius: 16 },
  aiBubble: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  userBubble: { backgroundColor: C.primary + "25", borderWidth: 1, borderColor: C.primary + "40", alignSelf: "flex-end", borderBottomRightRadius: 4 },
  roleBadge: { color: C.primary, fontSize: 9, fontWeight: "800", letterSpacing: 1, marginBottom: 4 },
  bubbleText: { color: C.muted, fontSize: 13, lineHeight: 18 },
  userText: { color: C.text },
  inputRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border, alignItems: "flex-end" },
  textInput: { flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: C.text, fontSize: 14, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { backgroundColor: C.border },
  sendIcon: { color: "#fff", fontSize: 18, fontWeight: "800" },
});
