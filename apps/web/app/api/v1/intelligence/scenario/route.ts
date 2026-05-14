import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Direction = "LONG" | "SHORT";

type ScenarioOutcome =
  | "WIN_HIGH"
  | "WIN_MED"
  | "NEUTRAL"
  | "LOSS_MED"
  | "LOSS_HIGH"
  | "LIQUIDATION";

type ScenarioResult = {
  name: string;
  description: string;
  outcome: ScenarioOutcome;
  scenarioName: string;
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
  dataQuality: "live" | "delayed" | "fallback" | "insufficient";
  warning?: string;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function round(value: number, digits = 2): number {
  const m = 10 ** digits;
  return Math.round(value * m) / m;
}

function parseStrictNumericInput(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function computePnlPct(direction: Direction, entry: number, target: number): number | null {
  if (!(entry > 0) || !(target > 0)) return null;
  const raw = direction === "SHORT" ? (entry - target) / entry : (target - entry) / entry;
  if (!Number.isFinite(raw)) return null;
  return round(raw * 100, 2);
}

function computeRiskReward(entry: number, target: number | null, stopLoss: number | null): number | null {
  if (!(entry > 0) || target == null || stopLoss == null) return null;
  const reward = Math.abs(target - entry);
  const risk = Math.abs(entry - stopLoss);
  if (!(risk > 0) || !Number.isFinite(reward) || !Number.isFinite(risk)) return null;
  return round(reward / risk, 2);
}

function computeKelly(probability: number | null, riskReward: number | null): number | null {
  if (probability == null || riskReward == null) return null;
  if (!(riskReward > 0)) return null;
  const p = clamp(probability, 0, 100) / 100;
  const q = 1 - p;
  const b = riskReward;
  const k = (b * p - q) / b;
  if (!Number.isFinite(k)) return null;
  return round(Math.max(0, k), 4);
}

function resultFromPct(pct: number | null): { outcome: ScenarioOutcome; label: string } {
  if (pct == null) return { outcome: "NEUTRAL", label: "Nötr" };
  if (pct >= 3) return { outcome: "WIN_HIGH", label: "Yüksek Kar" };
  if (pct >= 0.5) return { outcome: "WIN_MED", label: "Orta Kar" };
  if (pct <= -15) return { outcome: "LIQUIDATION", label: "Likidasyon" };
  if (pct <= -4) return { outcome: "LOSS_HIGH", label: "Yüksek Kayıp" };
  if (pct < 0) return { outcome: "LOSS_MED", label: "Orta Kayıp" };
  return { outcome: "NEUTRAL", label: "Nötr" };
}

function buildScenario(args: {
  name: string;
  description: string;
  direction: Direction;
  entryPrice: number;
  targetPrice: number | null;
  stopLoss: number | null;
  amount: number;
  leverage: number;
  probability: number | null;
  warning?: string;
  dataQuality?: "live" | "delayed" | "fallback" | "insufficient";
}): ScenarioResult {
  const {
    name,
    description,
    direction,
    entryPrice,
    targetPrice,
    stopLoss,
    amount,
    leverage,
    probability,
    warning,
    dataQuality = "fallback",
  } = args;

  const expectedPnlPct = targetPrice != null ? computePnlPct(direction, entryPrice, targetPrice) : null;
  const maxLossPct = stopLoss != null ? computePnlPct(direction, entryPrice, stopLoss) : null;
  const riskReward = computeRiskReward(entryPrice, targetPrice, stopLoss);
  const kellyFraction = computeKelly(probability, riskReward);

  const notional = entryPrice * amount * Math.max(leverage, 1);
  const expectedPnlAmount = expectedPnlPct == null ? null : round((expectedPnlPct / 100) * notional, 2);
  const maxLossAmount = maxLossPct == null ? null : round((maxLossPct / 100) * notional, 2);

  const { outcome, label } = resultFromPct(expectedPnlPct);

  return {
    name,
    description,
    outcome,
    scenarioName: name,
    direction,
    entryPrice: round(entryPrice, 6),
    targetPrice: targetPrice == null ? null : round(targetPrice, 6),
    stopLoss: stopLoss == null ? null : round(stopLoss, 6),
    amount: round(amount, 8),
    leverage: round(Math.max(1, leverage), 2),
    expectedPnlPct,
    expectedPnlAmount,
    maxLossPct,
    maxLossAmount,
    riskReward,
    probability,
    kellyFraction,
    resultLabel: label,
    dataQuality,
    warning,
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const symbol = String(body?.symbol || "BTCUSDT").toUpperCase();
  const direction = String(body?.direction || "LONG").toUpperCase() === "SHORT" ? "SHORT" : "LONG";

  const rawEntryPrice = parseStrictNumericInput(body?.price ?? body?.entryPrice);
  const rawAmount = parseStrictNumericInput(body?.amount);
  const rawLeverage = parseStrictNumericInput(body?.leverage);
  const rawConfidence = parseStrictNumericInput(body?.confidence_score ?? body?.confidence);
  const rawVolatility = parseStrictNumericInput(body?.volatility_daily ?? body?.volatility);

  if (rawEntryPrice == null || rawEntryPrice <= 0) {
    return NextResponse.json({ ok: false, error: "INVALID_ENTRY_PRICE", message: "Geçerli giriş fiyatı girin." }, { status: 400 });
  }
  if (rawAmount == null || rawAmount <= 0) {
    return NextResponse.json({ ok: false, error: "INVALID_AMOUNT", message: "Geçerli miktar girin." }, { status: 400 });
  }
  if (rawLeverage == null || rawLeverage <= 0) {
    return NextResponse.json({ ok: false, error: "INVALID_LEVERAGE", message: "Kaldıraç geçerli sayı olmalıdır." }, { status: 400 });
  }
  if (rawConfidence == null || rawConfidence < 0 || rawConfidence > 100) {
    return NextResponse.json({ ok: false, error: "INVALID_CONFIDENCE", message: "Güven yüzdesi 0-100 arasında olmalıdır." }, { status: 400 });
  }
  if (rawVolatility == null || rawVolatility < 0) {
    return NextResponse.json({ ok: false, error: "INVALID_VOLATILITY", message: "Volatilite geçerli sayı olmalıdır." }, { status: 400 });
  }

  const entryPrice = Math.max(0.00000001, rawEntryPrice);
  const amount = Math.max(0.0001, rawAmount);
  const leverage = clamp(rawLeverage, 1, 20);
  const confidence = clamp(rawConfidence, 1, 100);
  const volatility = Math.max(0, rawVolatility);

  const stopDistance = entryPrice * clamp(0.007 + volatility / 200, 0.005, 0.08);
  const targetDistance = entryPrice * clamp(0.012 + volatility / 120, 0.008, 0.12);

  const longTarget = entryPrice + targetDistance;
  const longStop = Math.max(0.00000001, entryPrice - stopDistance);
  const shortTarget = Math.max(0.00000001, entryPrice - targetDistance);
  const shortStop = entryPrice + stopDistance;

  const baseTarget = direction === "SHORT" ? shortTarget : longTarget;
  const baseStop = direction === "SHORT" ? shortStop : longStop;

  const scenarios: ScenarioResult[] = [
    buildScenario({
      name: "Şimdi Gir",
      description: "Piyasa fiyatından hemen giriş.",
      direction,
      entryPrice,
      targetPrice: baseTarget,
      stopLoss: baseStop,
      amount,
      leverage,
      probability: clamp(confidence - 5, 1, 99),
      dataQuality: "fallback",
    }),
    buildScenario({
      name: "Tetik Bekle",
      description: "Kırılım/onay bekleyerek daha kontrollü giriş.",
      direction,
      entryPrice: direction === "SHORT" ? entryPrice * 0.998 : entryPrice * 1.002,
      targetPrice: direction === "SHORT" ? shortTarget * 0.995 : longTarget * 1.005,
      stopLoss: direction === "SHORT" ? shortStop * 0.997 : longStop * 1.003,
      amount,
      leverage,
      probability: clamp(confidence + 4, 1, 99),
      dataQuality: "fallback",
    }),
    buildScenario({
      name: "Yarı Pozisyon",
      description: "%50 pozisyon ile kademeli giriş.",
      direction,
      entryPrice,
      targetPrice: direction === "SHORT" ? shortTarget * 0.997 : longTarget * 0.997,
      stopLoss: direction === "SHORT" ? shortStop * 0.998 : longStop * 1.002,
      amount: amount * 0.5,
      leverage,
      probability: clamp(confidence + 2, 1, 99),
      dataQuality: "fallback",
    }),
    buildScenario({
      name: "Stopsuz",
      description: "Stop-loss olmadan pozisyon.",
      direction,
      entryPrice,
      targetPrice: direction === "SHORT" ? shortTarget : longTarget,
      stopLoss: null,
      amount,
      leverage,
      probability: clamp(confidence - 25, 1, 99),
      warning: "Kalkan: Stopsuz işlem risk politikasını ihlal eder.",
      dataQuality: "insufficient",
    }),
    buildScenario({
      name: "3x Kaldıraç",
      description: "Yüksek kaldıraçlı agresif senaryo.",
      direction,
      entryPrice,
      targetPrice: direction === "SHORT" ? shortTarget : longTarget,
      stopLoss: baseStop,
      amount,
      leverage: Math.max(3, leverage),
      probability: clamp(confidence - 10, 1, 99),
      warning: "Kalkan: Yüksek kaldıraçta tasfiye riski artar.",
      dataQuality: "fallback",
    }),
    buildScenario({
      name: "Bekle / Geç",
      description: "İşlem açma, nakitte kal.",
      direction,
      entryPrice,
      targetPrice: entryPrice,
      stopLoss: entryPrice,
      amount: 0,
      leverage: 1,
      probability: 100,
      dataQuality: "live",
    }),
  ];

  const scored = scenarios
    .map((scenario) => {
      const rrScore = scenario.riskReward ?? 0;
      const probScore = (scenario.probability ?? 0) / 100;
      const pnlScore = (scenario.expectedPnlPct ?? 0) / 100;
      const penalty = scenario.warning ? 0.5 : 1;
      const score = (rrScore * 0.5 + probScore * 0.3 + pnlScore * 0.2) * penalty;
      return { scenario, score };
    })
    .sort((a, b) => b.score - a.score);

  const recommended = scored[0]?.scenario?.name || "Bekle / Geç";

  return NextResponse.json({
    symbol,
    price: round(entryPrice, 6),
    direction,
    recommended,
    key_insight:
      "Bu çıktı eğitim amaçlıdır. Teknik ve temel veriler sınırlıysa hedef/stop boş bırakılabilir.",
    generatedAt: new Date().toISOString(),
    disclaimer: "Bu içerik yatırım tavsiyesi değildir.",
    scenarios,
  });
}

