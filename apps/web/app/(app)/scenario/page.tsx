"use client";

import { useMemo, useState } from "react";
import { Calculator, AlertTriangle, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Direction = "LONG" | "SHORT";
type DataQuality = "live" | "delayed" | "fallback" | "insufficient";

type ScenarioResult = {
  scenarioName: string;
  name: string;
  description: string;
  direction: Direction;
  entryPrice: number;
  targetPrice: number | null;
  stopLoss: number | null;
  amount: number;
  leverage: number;
  expectedPnlPct: number | null;
  expectedPnlAmount: number | null;
  maxLossPct: number | null;
  maxLossAmount: number | null;
  riskReward: number | null;
  probability: number | null;
  kellyFraction: number | null;
  resultLabel: string;
  dataQuality: DataQuality;
  warning?: string;
};

type SimulationReport = {
  symbol: string;
  price: number;
  direction: Direction;
  recommended: string;
  dataQuality: DataQuality;
  keyInsight: string;
  generatedAt: string;
  disclaimer: string;
  scenarios: ScenarioResult[];
};

function toNum(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseStrictNumberInput(value: string): number | null {
  const normalized = String(value || "").trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function safeText(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeScenario(raw: Record<string, unknown>, fallbackDirection: Direction): ScenarioResult {
  const direction = String(raw.direction || fallbackDirection).toUpperCase() === "SHORT" ? "SHORT" : "LONG";
  const entryPrice = toNum(raw.entryPrice ?? raw.entry_price) ?? 0;
  const targetPrice = toNum(raw.targetPrice ?? raw.target_price);
  const stopLoss = toNum(raw.stopLoss ?? raw.stop_loss);
  const amount = Math.max(0, toNum(raw.amount) ?? 0);
  const leverage = Math.max(1, toNum(raw.leverage) ?? 1);

  const expectedPnlPct = toNum(raw.expectedPnlPct ?? raw.expected_pnl_pct);
  const expectedPnlAmount = toNum(raw.expectedPnlAmount ?? raw.expected_pnl_amount);
  const maxLossPct = toNum(raw.maxLossPct ?? raw.max_loss_pct);
  const maxLossAmount = toNum(raw.maxLossAmount ?? raw.max_loss_amount);
  const riskReward = toNum(raw.riskReward ?? raw.risk_reward);
  const probability = toNum(raw.probability);
  const kellyFraction = toNum(raw.kellyFraction ?? raw.kelly_size);

  return {
    scenarioName: safeText(raw.scenarioName ?? raw.name, "Senaryo"),
    name: safeText(raw.name, "Senaryo"),
    description: safeText(raw.description, "Açıklama yok"),
    direction,
    entryPrice,
    targetPrice,
    stopLoss,
    amount,
    leverage,
    expectedPnlPct,
    expectedPnlAmount,
    maxLossPct,
    maxLossAmount,
    riskReward,
    probability,
    kellyFraction,
    resultLabel: safeText(raw.resultLabel ?? raw.outcome, "Nötr"),
    dataQuality: ["live", "delayed", "fallback", "insufficient"].includes(String(raw.dataQuality))
      ? (raw.dataQuality as DataQuality)
      : "insufficient",
    warning: raw.warning ? String(raw.warning) : undefined,
  };
}

function normalizeReport(rawInput: unknown, fallbackSymbol: string, fallbackDirection: Direction): SimulationReport {
  const raw = (typeof rawInput === "object" && rawInput !== null ? rawInput : {}) as Record<string, unknown>;
  const scenarios = Array.isArray(raw.scenarios)
    ? raw.scenarios
        .map((item) => (typeof item === "object" && item !== null ? normalizeScenario(item as Record<string, unknown>, fallbackDirection) : null))
        .filter((item): item is ScenarioResult => item !== null)
    : [];
  return {
    symbol: safeText(raw.symbol, fallbackSymbol),
    price: toNum(raw.price) ?? 0,
    direction: String(raw.direction || fallbackDirection).toUpperCase() === "SHORT" ? "SHORT" : "LONG",
    recommended: safeText(raw.recommended, scenarios[0]?.name || "Bekle / Geç"),
    dataQuality: ["live", "delayed", "fallback", "insufficient"].includes(String(raw.dataQuality))
      ? (raw.dataQuality as DataQuality)
      : (scenarios[0]?.dataQuality || "insufficient"),
    keyInsight: safeText(raw.key_insight ?? raw.keyInsight, "Veri sınırlı, analiz güveni düşebilir."),
    generatedAt: typeof raw.generatedAt === "string" && raw.generatedAt.trim() !== "" ? raw.generatedAt : "",
    disclaimer: safeText(raw.disclaimer, "Bu içerik yatırım tavsiyesi değildir."),
    scenarios,
  };
}

function formatPercent(value: number | null, fallback = "Hesaplanamadı"): string {
  if (value == null || !Number.isFinite(value)) return fallback;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatMoney(value: number | null, fallback = "Hesaplanamadı"): string {
  if (value == null || !Number.isFinite(value)) return fallback;
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  if (abs >= 1) return value.toFixed(2);
  return value.toFixed(6);
}

function formatRatio(value: number | null, fallback = "Hesaplanamadı"): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return fallback;
  return `${value.toFixed(2)}x`;
}

function formatKelly(value: number | null, fallback = "Veri yetersiz"): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return fallback;
  return `${(value * 100).toFixed(1)}%`;
}

function formatLossPercent(value: number | null, fallback = "Hesaplanamadı"): string {
  if (value == null || !Number.isFinite(value)) return fallback;
  return `${value.toFixed(2)}%`;
}

function scoreScenario(s: ScenarioResult): number {
  const rr = s.riskReward ?? 0;
  const p = (s.probability ?? 0) / 100;
  const pnl = (s.expectedPnlPct ?? 0) / 100;
  const qualityPenalty = s.dataQuality === "live" ? 1 : s.dataQuality === "delayed" ? 0.9 : s.dataQuality === "fallback" ? 0.7 : 0.2;
  const penalty = s.warning ? 0.5 : 1;
  return (rr * 0.5 + p * 0.3 + pnl * 0.2) * penalty * qualityPenalty;
}

function qualityLabel(q: DataQuality, locale: "tr" | "en"): string {
  const tr: Record<DataQuality, string> = {
    live: "Canlı",
    delayed: "Gecikmeli",
    fallback: "Eğitim modu",
    insufficient: "Veri yetersiz",
  };
  const en: Record<DataQuality, string> = {
    live: "Live",
    delayed: "Delayed",
    fallback: "Fallback",
    insufficient: "Insufficient",
  };
  return locale === "en" ? en[q] : tr[q];
}

function qualityBannerText(q: DataQuality, locale: "tr" | "en"): string {
  if (locale === "en") {
    if (q === "live") return "Live-data scenario";
    if (q === "delayed") return "Delayed-data estimated scenario";
    if (q === "fallback") return "Educational estimated scenario";
    return "Insufficient data";
  }
  if (q === "live") return "Canlı veri senaryosu";
  if (q === "delayed") return "Gecikmeli veriyle tahmini senaryo";
  if (q === "fallback") return "Eğitim amaçlı tahmini senaryo";
  return "Veri yetersiz";
}

function ScenarioCard({
  scenario,
  recommended,
  locale,
  reportQuality,
}: {
  scenario: ScenarioResult;
  recommended: boolean;
  locale: "tr" | "en";
  reportQuality: DataQuality;
}) {
  const insufficient = scenario.dataQuality === "insufficient" || reportQuality === "insufficient";
  const fallbackMode = scenario.dataQuality === "fallback" || reportQuality === "fallback";
  const delayedMode = scenario.dataQuality === "delayed" || reportQuality === "delayed";
  const noDataText = locale === "en" ? "Insufficient data" : "Veri yetersiz";
  const estimatedText = locale === "en" ? "Estimated" : "Tahmini";
  const expectedPnlPct = insufficient ? noDataText : (fallbackMode ? `~${formatPercent(scenario.expectedPnlPct, estimatedText)}` : formatPercent(scenario.expectedPnlPct));
  const maxLossPct = insufficient ? noDataText : formatLossPercent(scenario.maxLossPct);
  const recommendationLabel = fallbackMode
    ? (locale === "en" ? "EDU RECOMMENDED" : "EĞİTİM ÖNERİSİ")
    : (locale === "en" ? "RECOMMENDED" : "ÖNERİLEN");
  // "Yüksek Kar" and profit labels only show when data is reliable and all values are finite
  const canShowResultLabel =
    !insufficient && !fallbackMode &&
    scenario.targetPrice != null && scenario.stopLoss != null &&
    scenario.riskReward != null && scenario.probability != null;
  const resultValue = canShowResultLabel
    ? (scenario.resultLabel || "Nötr")
    : insufficient
      ? noDataText
      : estimatedText;

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${recommended ? "var(--gold-border)" : "var(--b1)"}`,
        borderRadius: "var(--r-lg)",
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--t1)" }}>{scenario.name}</div>
          <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>{scenario.description}</div>
        </div>
        {recommended && !insufficient && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.06em",
              color: "var(--gold)",
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(245,158,11,0.35)",
              borderRadius: 6,
              padding: "2px 8px",
              whiteSpace: "nowrap",
            }}
          >
            {recommendationLabel}
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        <Metric label={locale === "en" ? "Expected PnL" : "Beklenen PnL"} value={expectedPnlPct} />
        <Metric label={locale === "en" ? "Max Loss" : "Maks Kayıp"} value={maxLossPct} />
        <Metric label={locale === "en" ? "Risk/Reward" : "Risk/Ödül"} value={insufficient ? noDataText : formatRatio(scenario.riskReward)} />
        <Metric label={locale === "en" ? "Kelly" : "Kelly"} value={insufficient || fallbackMode ? noDataText : formatKelly(scenario.kellyFraction)} />
        <Metric label={locale === "en" ? "Probability" : "Olasılık"} value={insufficient ? noDataText : (fallbackMode ? estimatedText : formatPercent(scenario.probability))} />
        <Metric label={locale === "en" ? "Result" : "Sonuç"} value={resultValue} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: "var(--t3)" }}>
          {locale === "en" ? "Entry" : "Giriş"}: {formatMoney(scenario.entryPrice, "—")}
        </span>
        <span style={{ fontSize: 10, color: "var(--t3)" }}>
          {locale === "en" ? "Target" : "Hedef"}: {formatMoney(scenario.targetPrice, noDataText)}
        </span>
        <span style={{ fontSize: 10, color: "var(--t3)" }}>
          Stop: {formatMoney(scenario.stopLoss, noDataText)}
        </span>
      </div>

      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 9, color: "var(--t4)" }}>{locale === "en" ? "Data quality:" : "Veri kalitesi:"}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--t2)" }}>{qualityLabel(scenario.dataQuality, locale)}</span>
        {(fallbackMode || delayedMode) && (
          <span style={{ fontSize: 10, color: "var(--warn)" }}>
            {fallbackMode ? (locale === "en" ? "Educational estimate" : "Eğitim amaçlı tahmin") : (locale === "en" ? "Estimated" : "Tahmini")}
          </span>
        )}
      </div>

      {scenario.warning && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 6,
            borderRadius: 8,
            border: "1px solid rgba(239,68,68,0.28)",
            background: "rgba(239,68,68,0.1)",
            padding: "8px 10px",
          }}
        >
          <AlertTriangle size={12} color="var(--down)" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 11, color: "#fca5a5", lineHeight: 1.4 }}>{scenario.warning}</span>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--bg-hover)", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 9, letterSpacing: "0.04em", color: "var(--t4)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--t1)", fontWeight: 700 }}>{value}</div>
    </div>
  );
}

export default function ScenarioPage() {
  const { locale } = useI18n();
  const lang = locale === "en" ? "en" : "tr";

  const [form, setForm] = useState({
    symbol: "BTCUSDT",
    entryPrice: "81000",
    direction: "LONG" as Direction,
    confidence: "72",
    volatility: "3",
    leverage: "1",
    amount: "0.1",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isFetching, setIsFetching] = useState(false);
  const [reportData, setReportData] = useState<SimulationReport | null>(null);

  const validateForm = (): Record<string, string> => {
    const next: Record<string, string> = {};
    const entryPrice = parseStrictNumberInput(form.entryPrice);
    const amount = parseStrictNumberInput(form.amount);
    const leverage = parseStrictNumberInput(form.leverage);
    const confidence = parseStrictNumberInput(form.confidence);
    const volatility = parseStrictNumberInput(form.volatility);

    if (entryPrice == null || !Number.isFinite(entryPrice) || entryPrice <= 0) {
      next.entryPrice = lang === "en" ? "Enter a valid entry price." : "Geçerli giriş fiyatı girin.";
    }
    if (amount == null || !Number.isFinite(amount) || amount <= 0) {
      next.amount = lang === "en" ? "Enter a valid amount" : "Geçerli miktar girin";
    }
    // Leverage: must be finite and within 1..20 (matches typical exchange retail limit)
    if (leverage == null || !Number.isFinite(leverage) || leverage < 1 || leverage > 20) {
      next.leverage = lang === "en"
        ? "Leverage must be between 1 and 20."
        : "Kaldıraç 1 ile 20 arasında olmalıdır.";
    }
    if (confidence == null || !Number.isFinite(confidence) || confidence < 0 || confidence > 100) {
      next.confidence = lang === "en" ? "Confidence must be between 0 and 100." : "Güven yüzdesi 0-100 arasında olmalıdır.";
    }
    // Volatility: must be finite and within 0..100 (percent)
    if (volatility == null || !Number.isFinite(volatility) || volatility < 0 || volatility > 100) {
      next.volatility = lang === "en"
        ? "Volatility must be between 0 and 100."
        : "Volatilite 0 ile 100 arasında olmalıdır.";
    }
    return next;
  };

  const runSimulation = async () => {
    const nextErrors = validateForm();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setReportData(null);
      return;
    }
    const entry = parseStrictNumberInput(form.entryPrice);
    const amount = parseStrictNumberInput(form.amount);
    const leverage = parseStrictNumberInput(form.leverage);
    const confidence = parseStrictNumberInput(form.confidence);
    const volatility = parseStrictNumberInput(form.volatility);
    if (entry == null || amount == null || leverage == null || confidence == null || volatility == null) {
      setReportData(null);
      return;
    }
    setIsFetching(true);
    try {
      const response = await api.post("/intelligence/scenario", {
        symbol: form.symbol,
        price: entry,
        direction: form.direction,
        confidence_score: confidence,
        volatility_daily: volatility,
        leverage,
        amount,
      });
      setReportData(normalizeReport(response.data, form.symbol, form.direction));
    } catch {
      setReportData(null);
    } finally {
      setIsFetching(false);
    }
  };

  const report = useMemo<SimulationReport>(() => {
    if (reportData) return reportData;
    return {
      symbol: form.symbol,
      price: parseStrictNumberInput(form.entryPrice) || 0,
      direction: form.direction,
      recommended: "Bekle / Geç",
      dataQuality: "insufficient",
      keyInsight: lang === "en"
        ? "Run simulation to see realistic PnL, drawdown and Kelly outputs."
        : "Gerçekçi PnL, drawdown ve Kelly çıktıları için simülasyonu çalıştırın.",
      generatedAt: "",
      disclaimer: lang === "en"
        ? "This content is not investment advice."
        : "Bu içerik yatırım tavsiyesi değildir.",
      scenarios: [],
    };
  }, [form.direction, form.entryPrice, form.symbol, lang, reportData]);

  const normalizedScenarios = useMemo<Array<ScenarioResult & { _recommended: boolean }>>(() => {
    const scenarios = [...report.scenarios];
    if (!scenarios.length) return [];

    const valid = scenarios.filter((item) => Number.isFinite(scoreScenario(item)));
    const highest = valid.sort((a, b) => scoreScenario(b) - scoreScenario(a))[0];
    const recommendedName = report.recommended || highest?.name || scenarios[0].name;
    const allowRecommended = report.dataQuality !== "insufficient";

    return scenarios.map((scenario) => ({
      ...scenario,
      _recommended: allowRecommended && scenario.name === recommendedName,
    }));
  }, [report.dataQuality, report.recommended, report.scenarios]);

  const generatedAtLabel = (() => {
    if (!report.generatedAt) return "—";
    const date = new Date(report.generatedAt);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString(lang === "en" ? "en-US" : "tr-TR");
  })();

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Calculator size={18} color="var(--info)" />
          <div>
            <h1 style={{ margin: 0, fontSize: 20, color: "var(--t1)", fontFamily: "var(--font-head)" }}>
              {lang === "en" ? "Scenario Simulator" : "Senaryo Simülatörü"}
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--t3)" }}>
              {lang === "en" ? "Kelly, drawdown and risk/reward comparison" : "Kelly, drawdown ve risk/ödül karşılaştırması"}
            </p>
          </div>
        </div>

        <button
          onClick={runSimulation}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            border: "1px solid var(--b1)",
            background: "var(--bg-hover)",
            color: "var(--t1)",
            borderRadius: 8,
            padding: "8px 14px",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          <RefreshCw size={14} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
          {lang === "en" ? "Run Simulation" : "Simülasyonu Çalıştır"}
        </button>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--b1)", borderRadius: "var(--r-lg)", padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          <Input label={lang === "en" ? "Symbol" : "Sembol"} value={form.symbol} onChange={(value) => setForm((prev) => ({ ...prev, symbol: value.toUpperCase() }))} />
          <Input label={lang === "en" ? "Entry Price" : "Giriş Fiyatı"} value={form.entryPrice} error={errors.entryPrice} inputMode="decimal" onChange={(value) => setForm((prev) => ({ ...prev, entryPrice: value }))} />
          <Input label={lang === "en" ? "Amount" : "Miktar"} value={form.amount} error={errors.amount} inputMode="decimal" onChange={(value) => setForm((prev) => ({ ...prev, amount: value }))} />
          <Input label={lang === "en" ? "Leverage" : "Kaldıraç"} value={form.leverage} error={errors.leverage} inputMode="numeric" onChange={(value) => setForm((prev) => ({ ...prev, leverage: value }))} />
          <Input label={lang === "en" ? "Confidence %" : "Güven %"} value={form.confidence} error={errors.confidence} inputMode="numeric" onChange={(value) => setForm((prev) => ({ ...prev, confidence: value }))} />
          <Input label={lang === "en" ? "Volatility %" : "Volatilite %"} value={form.volatility} error={errors.volatility} inputMode="decimal" onChange={(value) => setForm((prev) => ({ ...prev, volatility: value }))} />

          <div>
            <div style={{ fontSize: 10, color: "var(--t4)", marginBottom: 6, letterSpacing: "0.04em" }}>
              {lang === "en" ? "Direction" : "Yön"}
            </div>
            <select
              value={form.direction}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, direction: event.target.value === "SHORT" ? "SHORT" : "LONG" }))
              }
              style={{
                width: "100%",
                borderRadius: 8,
                border: "1px solid var(--b1)",
                background: "var(--bg-hover)",
                color: "var(--t1)",
                padding: "9px 10px",
              }}
            >
              <option value="LONG">LONG</option>
              <option value="SHORT">SHORT</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{
        border: "1px solid rgba(96,165,250,0.28)",
        background: "rgba(96,165,250,0.08)",
        borderRadius: "var(--r-lg)",
        padding: "12px 14px",
      }}>
        <div style={{ fontSize: 11, color: "var(--t1)", marginBottom: 4 }}>{report.keyInsight}</div>
        <div style={{ fontSize: 11, color: "var(--warn)", fontWeight: 700, marginBottom: 4 }}>
          {qualityBannerText(report.dataQuality, lang)}
        </div>
        <div style={{ fontSize: 10, color: "var(--t3)" }} suppressHydrationWarning>
          {lang === "en" ? "Generated" : "Üretim zamanı"}: <span suppressHydrationWarning>{generatedAtLabel}</span>
        </div>
      </div>

      {normalizedScenarios.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 12 }}>
          {normalizedScenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.name}
              scenario={scenario}
              recommended={Boolean(scenario._recommended)}
              locale={lang}
              reportQuality={report.dataQuality}
            />
          ))}
        </div>
      ) : (
        <div style={{ padding: 24, textAlign: "center", color: "var(--t3)", border: "1px dashed var(--b1)", borderRadius: "var(--r-lg)" }}>
          {report.dataQuality === "insufficient"
            ? (lang === "en" ? "Reliable scenario could not be generated for this asset." : "Bu varlık için güvenilir senaryo üretilemedi.")
            : (lang === "en" ? "Run simulation to generate scenarios." : "Senaryoları görmek için simülasyonu çalıştırın.")}
        </div>
      )}

      <div style={{ fontSize: 11, color: "var(--t4)" }}>{report.disclaimer}</div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  error,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  inputMode?: "text" | "numeric" | "decimal";
}) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--t4)", marginBottom: 6, letterSpacing: "0.04em" }}>{label}</div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={inputMode}
        style={{
          width: "100%",
          borderRadius: 8,
          border: error ? "1px solid rgba(239,68,68,0.55)" : "1px solid var(--b1)",
          background: "var(--bg-hover)",
          color: "var(--t1)",
          padding: "9px 10px",
          fontFamily: "var(--font-mono)",
          boxSizing: "border-box",
        }}
      />
      {error && <div style={{ marginTop: 5, fontSize: 11, color: "#fca5a5" }}>{error}</div>}
    </div>
  );
}

