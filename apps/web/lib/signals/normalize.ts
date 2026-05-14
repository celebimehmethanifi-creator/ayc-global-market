export type SignalDirection = "LONG" | "SHORT" | "NEUTRAL";
export type SignalStage = "TRIGGER" | "SETUP" | "WATCH" | "KALKAN" | "NONE";

export type NormalizedSignal = {
  id: string;
  symbol: string;
  name: string;
  market: string;
  direction: SignalDirection;
  confidence: number;
  price: number;
  change_24h: number;
  reason: string;
  stage: SignalStage;
  scores: {
    opportunity: number;
    risk: number;
    confidence: number;
    trend: number;
    liquidity: number;
    volatility: number;
    composite: number;
  };
  motor_votes: Record<string, string>;
  kalkan_reason: string | null;
  trigger_level?: number | null;
  invalidation?: number | null;
  take_profit?: number | null;
  riskLevel: "low" | "medium" | "high";
  status: "active" | "no_signal";
  updatedAt: string;
  dataSource: string;
  age: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toFinite(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeDirection(value: unknown): SignalDirection {
  const dir = String(value || "").toUpperCase();
  if (dir === "LONG" || dir === "BUY" || dir === "AL") return "LONG";
  if (dir === "SHORT" || dir === "SELL" || dir === "SAT") return "SHORT";
  return "NEUTRAL";
}

function normalizeStage(value: unknown): SignalStage | null {
  const stage = String(value || "").toUpperCase();
  if (stage === "TRIGGER" || stage === "SETUP" || stage === "WATCH" || stage === "KALKAN" || stage === "NONE") {
    return stage;
  }
  return null;
}

function relativeAge(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "şimdi";
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}dk`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}sa`;
  return `${Math.floor(diffHour / 24)}g`;
}

function inferStage(confidence: number, riskScore: number, direction: SignalDirection): SignalStage {
  if (direction === "NEUTRAL" || confidence <= 35) return "NONE";
  if (riskScore >= 68) return "KALKAN";
  if (confidence >= 78 && riskScore <= 45) return "TRIGGER";
  if (confidence >= 60) return "SETUP";
  if (confidence >= 45) return "WATCH";
  return "NONE";
}

function inferRiskLevel(riskScore: number): "low" | "medium" | "high" {
  if (riskScore >= 68) return "high";
  if (riskScore >= 45) return "medium";
  return "low";
}

function computeScores(raw: any, confidence: number, change24h: number, riskScore: number, stage: SignalStage) {
  const baseOpportunity = clamp(Math.round(confidence + Math.max(0, change24h) * 3 - riskScore * 0.18), 0, 100);
  const trend = clamp(Math.round(50 + change24h * 6), 0, 100);
  const liquidity = clamp(Math.round(raw?.price > 0 ? 65 : 35), 0, 100);
  const volatility = clamp(Math.round(Math.abs(change24h) * 10), 0, 100);
  const composite = clamp(
    Math.round((baseOpportunity + confidence + trend + liquidity + (100 - riskScore)) / 5),
    0,
    100,
  );
  const scores = raw?.scores || {};
  return {
    opportunity: clamp(toFinite(scores.opportunity, baseOpportunity), 0, 100),
    risk: clamp(toFinite(scores.risk, riskScore), 0, 100),
    confidence: clamp(toFinite(scores.confidence, confidence), 0, 100),
    trend: clamp(toFinite(scores.trend, trend), 0, 100),
    liquidity: clamp(toFinite(scores.liquidity, liquidity), 0, 100),
    volatility: clamp(toFinite(scores.volatility, volatility), 0, 100),
    composite: clamp(toFinite(scores.composite, composite), 0, 100),
  };
}

function inferMotorVotes(direction: SignalDirection, stage: SignalStage): Record<string, string> {
  if (stage === "NONE") {
    return {
      TrendTakip: "NOTR",
      Momentum: "NOTR",
      Hacim: "NOTR",
      Reversal: "IZLE",
      Breakout: "IZLE",
      Contrarian: "NOTR",
    };
  }
  const bias = direction === "LONG" ? "LONG" : "SHORT";
  return {
    TrendTakip: bias,
    Momentum: bias,
    Hacim: stage === "WATCH" ? "NOTR" : bias,
    Reversal: stage === "KALKAN" ? "UYARI" : "NOTR",
    Breakout: stage === "TRIGGER" ? bias : "IZLE",
    Contrarian: stage === "KALKAN" ? "UYARI" : "NOTR",
  };
}

export function hasMeaningfulSignal(signal: Pick<NormalizedSignal, "stage" | "reason" | "scores">): boolean {
  if (signal.stage === "NONE") return false;
  const hasReason = String(signal.reason || "").trim().length > 0;
  return hasReason || signal.scores.confidence > 0 || signal.scores.opportunity > 0;
}

export function normalizeSignal(raw: any, defaults?: { updatedAt?: string; source?: string }): NormalizedSignal {
  const symbol = String(raw?.symbol || "UNKNOWN").toUpperCase();
  const direction = normalizeDirection(raw?.direction);
  const confidence = clamp(toFinite(raw?.confidence, toFinite(raw?.strength, 50)), 0, 100);
  const change24h = toFinite(raw?.change_24h, toFinite(raw?.chg, 0));
  const price = toFinite(raw?.price, 0);
  const riskScore = clamp(toFinite(raw?.risk_score, toFinite(raw?.scores?.risk, 50)), 0, 100);
  const rawStage = normalizeStage(raw?.stage);
  const stage = rawStage ?? inferStage(confidence, riskScore, direction);
  const updatedAt = String(raw?.updatedAt || raw?.updated_at || defaults?.updatedAt || new Date().toISOString());
  const dataSource = String(raw?.dataSource || raw?.source || defaults?.source || "signal-engine");
  const reason = String(raw?.reason || raw?.ai_hint || "").trim();
  const scores = computeScores(raw, confidence, change24h, riskScore, stage);
  const kalkanReason =
    stage === "KALKAN"
      ? String(raw?.kalkan_reason || raw?.kalkanReason || "Kalkan filtresi yüksek risk tespit etti.")
      : null;

  return {
    id: String(raw?.id || `${symbol}-${stage}`),
    symbol,
    name: String(raw?.name || symbol),
    market: String(raw?.market || raw?.category || "market"),
    direction,
    confidence,
    price,
    change_24h: change24h,
    reason,
    stage,
    scores,
    motor_votes: raw?.motor_votes || inferMotorVotes(direction, stage),
    kalkan_reason: kalkanReason,
    trigger_level: Number.isFinite(Number(raw?.trigger_level)) ? Number(raw.trigger_level) : null,
    invalidation: Number.isFinite(Number(raw?.invalidation)) ? Number(raw.invalidation) : null,
    take_profit: Number.isFinite(Number(raw?.take_profit)) ? Number(raw.take_profit) : null,
    riskLevel: inferRiskLevel(riskScore),
    status: stage === "NONE" ? "no_signal" : "active",
    updatedAt,
    dataSource,
    age: relativeAge(updatedAt),
  };
}

export function buildStageCounts(signals: NormalizedSignal[]): Record<SignalStage, number> {
  const counts: Record<SignalStage, number> = {
    TRIGGER: 0,
    SETUP: 0,
    WATCH: 0,
    KALKAN: 0,
    NONE: 0,
  };
  for (const signal of signals) {
    counts[signal.stage] += 1;
  }
  return counts;
}

export function normalizeSignalsPayload(payload: any, fallbackSignals: any[] = []): {
  signals: NormalizedSignal[];
  stageCounts: Record<SignalStage, number>;
  updatedAt: string;
  source: string;
  isLiveFeed: boolean;
} {
  const source = String(payload?.source || "signal-engine");
  const updatedAt = String(payload?.updated_at || new Date().toISOString());
  const rawSignals = Array.isArray(payload?.signals) && payload.signals.length ? payload.signals : fallbackSignals;
  const signals = rawSignals.map((signal: any) => normalizeSignal(signal, { updatedAt, source }));
  return {
    signals,
    stageCounts: buildStageCounts(signals),
    updatedAt,
    source,
    isLiveFeed: Boolean(payload?.prices_live),
  };
}
