export type ExchangeId = "binance" | "bybit" | "okx";

export const EXCHANGE_INFO: Record<
  ExchangeId,
  { name: string; logo: string; color: string; fee: string; minOrder: number }
> = {
  binance: { name: "Binance", logo: "B", color: "#F0B90B", fee: "0.1%", minOrder: 5 },
  bybit: { name: "Bybit", logo: "Y", color: "#FF6B35", fee: "0.1%", minOrder: 1 },
  okx: { name: "OKX", logo: "O", color: "#FFFFFF", fee: "0.08%", minOrder: 1 },
};

export interface ConnectedExchange {
  exchange: ExchangeId;
  connectionId: string;
  name: string;
  connectedAt: string;
  totalBalance?: number;
  currency?: string;
}

export interface OrderRequest {
  connectionId: string;
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  quoteAmount?: number;
  baseAmount?: number;
  price?: number;
}

export interface OrderResult {
  ok: boolean;
  orderId?: string;
  exchange?: ExchangeId;
  symbol?: string;
  side?: string;
  executedQty?: string;
  price?: string;
  status?: string;
  timestamp?: string;
  error?: string;
  mode?: "paper" | "live-dev-only";
}

export interface BalanceResult {
  ok: boolean;
  totalBalance: number;
  freeBalance: number;
  currency: string;
  assets: { asset: string; free: number; locked: number }[];
  error?: string;
}
