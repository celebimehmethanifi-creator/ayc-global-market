import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

const C = {
  void: "#050508", surface: "#11111f", border: "#1e1e35",
  primary: "#7c3aed", accent: "#06b6d4",
  text: "#ffffff", muted: "#ffffff60", dim: "#ffffff25",
  bear: "#ef4444",
};

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignIn = async () => {
    if (!email || !password) {
      setError("E-posta ve şifre gereklidir.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // TODO: Supabase auth.signInWithPassword burada
      await new Promise((r) => setTimeout(r, 1000));
      router.replace("/(tabs)");
    } catch {
      setError("Giriş başarısız. Bilgilerini kontrol et.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView style={s.inner} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Logo */}
        <View style={s.logoWrap}>
          <View style={s.logoCircle}>
            <Text style={s.logoSymbol}>N</Text>
          </View>
          <Text style={s.logoText}>NEURA</Text>
          <Text style={s.logoSub}>AI Market Brain</Text>
        </View>

        {/* Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Giriş Yap</Text>

          {error ? <Text style={s.errorText}>{error}</Text> : null}

          <TextInput
            style={s.input}
            placeholder="E-posta"
            placeholderTextColor={C.dim}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={s.input}
            placeholder="Şifre"
            placeholderTextColor={C.dim}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={s.btn} onPress={handleSignIn} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.btnText}>Giriş Yap</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.linkBtn} onPress={() => router.push("/(auth)/signup" as any)}>
            <Text style={s.linkText}>Hesabın yok mu? <Text style={{ color: C.primary }}>Kayıt ol</Text></Text>
          </TouchableOpacity>
        </View>

        {/* Demo bypass */}
        <TouchableOpacity style={s.demoBtn} onPress={() => router.replace("/(tabs)")}>
          <Text style={s.demoText}>Demo modda devam et →</Text>
        </TouchableOpacity>

        <Text style={s.disclaimer}>
          Giriş yaparak, bilgilendirme amaçlı olduğunu ve yatırım tavsiyesi içermediğini kabul etmiş olursunuz.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  inner: { flex: 1, paddingHorizontal: 24, justifyContent: "center" },
  logoWrap: { alignItems: "center", marginBottom: 40 },
  logoCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.primary + "20", borderWidth: 1, borderColor: C.primary + "50", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  logoSymbol: { color: C.primary, fontSize: 32, fontWeight: "900" },
  logoText: { color: "#fff", fontSize: 28, fontWeight: "900", letterSpacing: 3 },
  logoSub: { color: C.muted, fontSize: 12, marginTop: 4 },
  card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 24 },
  cardTitle: { color: C.text, fontSize: 20, fontWeight: "800", marginBottom: 20 },
  errorText: { color: C.bear, fontSize: 12, marginBottom: 12, backgroundColor: C.bear + "15", padding: 10, borderRadius: 8 },
  input: { backgroundColor: C.void, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, color: C.text, fontSize: 14, marginBottom: 12 },
  btn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  linkBtn: { marginTop: 16, alignItems: "center" },
  linkText: { color: C.muted, fontSize: 13 },
  demoBtn: { marginTop: 20, alignItems: "center", paddingVertical: 10 },
  demoText: { color: C.accent, fontSize: 13 },
  disclaimer: { color: C.dim, fontSize: 10, textAlign: "center", marginTop: 24, lineHeight: 14 },
});
