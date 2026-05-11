// NEURA Shared TypeScript Types
// Generated to match packages/shared-types/src/types/models.py

export type AssetCategory =
  | "ALL" | "BIST" | "US" | "CRYPTO"
  | "COMMODITY" | "ENERGY" | "FOREX" | "INDEX" | "ETF";

export type SignalDirection = "long" | "short" | "neutral";
export type UserTier = "free" | "pro" | "elite";
export type AlarmType = "price" | "signal" | "drawdown" | "contrarian" | "emotional" | "kalkan";
export type VoteDirection = "bullish" | "bearish" | "neutral";

// ── Asset ────────────────────────────────────────────────────────────────────
export interface Asset {
  id: string;
  symbol: string;
  name: string;
  category: AssetCategory;
  exchange?: string;
  currency: string;
  data_source: string[];
  is_active: boolean;
  meta: Record<string, unknown>;
}

export interface PriceData {
  asset_id: string;
  symbol: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  change_pct?: number;
  source: string;
  fetched_at: string;
}

// ── Signal ────────────────────────────────────────────────────────────────────
export interface ModelVote {
  model: string;
  direction: SignalDirection;
  confidence: number;
  entry_price?: number;
  target_price?: number;
  stop_loss?: number;
  reasoning: string;
}

export interface ConsensusData {
  votes: ModelVote[];
  final_direction: SignalDirection;
  final_confidence: number;
  direction_agreement: boolean;
  weights_used: Record<string, number>;
}

export interface KalkanResult {
  blocked: boolean;
  reasons: string[];
  block_level: "hard" | "soft" | "none";
}

export interface Signal {
  id: string;
  asset_id: string;
  direction: SignalDirection;
  confidence: number;
  entry_price?: number;
  target_price?: number;
  stop_loss?: number;
  risk_reward?: number;
  timeframe: string;
  ai_reasoning: string;
  consensus_data?: ConsensusData;
  kalkan_block: boolean;
  kalkan_reasons: string[];
  created_at: string;
  expires_at?: string;
}

export interface StrategyCard {
  signal_id: string;
  asset_id: string;
  symbol: string;
  direction: SignalDirection;
  entry_price: number;
  target1: number;
  target2?: number;
  stop_loss: number;
  risk_reward: number;
  risk_amount_per_100: number;
  reward_amount_per_100: number;
  entry_timing: Record<string, unknown>;
  exit_strategy: Record<string, unknown>;
  disclaimer: string;
}

// ── User ─────────────────────────────────────────────────────────────────────
export interface RiskProfile {
  max_drawdown_pct?: number;
  risk_tolerance: "low" | "medium" | "high";
}

export interface User {
  id: string;
  email: string;
  display_name?: string;
  tier: UserTier;
  language: string;
  timezone: string;
  risk_profile: RiskProfile;
  investor_iq: number;
}

// ── Portfolio ─────────────────────────────────────────────────────────────────
export interface Position {
  id: string;
  portfolio_id: string;
  asset_id: string;
  entry_price: number;
  quantity: number;
  entry_date: string;
  notes?: string;
  is_simulation: boolean;
  current_price?: number;
  pnl?: number;
  pnl_pct?: number;
}

// ── Alarm ─────────────────────────────────────────────────────────────────────
export interface Alarm {
  id: string;
  user_id: string;
  asset_id?: string;
  alarm_type: AlarmType;
  condition: Record<string, unknown>;
  is_active: boolean;
  triggered_at?: string;
  created_at: string;
}

// ── Social ────────────────────────────────────────────────────────────────────
export interface SentimentScore {
  asset_id: string;
  symbol: string;
  overall_score: number;
  news_score?: number;
  social_score?: number;
  onchain_score?: number;
  crowd_bullish_pct: number;
  crowd_bearish_pct: number;
  crowd_neutral_pct: number;
  contrarian_signal: boolean;
  analyzed_at: string;
}

// ── Copilot ───────────────────────────────────────────────────────────────────
export interface CopilotChatOut {
  reply: string;
  referenced_signals: Signal[];
  kalkan_warning?: KalkanResult | null;
  suggested_actions: string[];
  disclaimer: string;
}

// ── Common ────────────────────────────────────────────────────────────────────
export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}

export interface ErrorResponse {
  error: string;
  detail?: string;
  code?: string;
}

// ── WebSocket Events ──────────────────────────────────────────────────────────
export type WSEvent =
  | { type: "price_update"; data: PriceData }
  | { type: "signal_new"; data: Signal }
  | { type: "kalkan_alert"; data: KalkanResult & { asset_id: string } }
  | { type: "alarm_triggered"; data: Alarm };
