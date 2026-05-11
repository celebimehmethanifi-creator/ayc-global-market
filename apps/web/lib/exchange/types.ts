export type ExchangeId = 'binance' | 'bybit' | 'okx';

export const EXCHANGE_INFO: Record<ExchangeId, { name: string; logo: string; color: string; fee: string; minOrder: number }> = {
  binance: { name: 'Binance', logo: '🟡', color: '#F0B90B', fee: '0.1%', minOrder: 5 },
  bybit:   { name: 'Bybit',   logo: '🟠', color: '#FF6B35', fee: '0.1%', minOrder: 1 },
  okx:     { name: 'OKX',     logo: '⚫', color: '#FFFFFF', fee: '0.08%', minOrder: 1 },
};

export interface ExchangeCredentials {
  exchange: ExchangeId;
  apiKey: string;
  apiSecret: string;
  passphrase?: string; // OKX only
}

export interface ConnectedExchange extends ExchangeCredentials {
  name: string;
  connectedAt: string;
  totalBalance?: number;
  currency?: string;
}

export interface OrderRequest {
  credentials: ExchangeCredentials;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  quoteAmount?: number; // USD amount
  baseAmount?: number;  // coin amount
  price?: number;       // for limit orders
}

export interface OrderResult {
  ok: boolean;
  orderId?: string;
  exchange: ExchangeId;
  symbol: string;
  side: string;
  executedQty?: string;
  price?: string;
  status: string;
  timestamp: string;
  error?: string;
}

export interface BalanceResult {
  ok: boolean;
  totalBalance: number;
  freeBalance: number;
  currency: string;
  assets: { asset: string; free: number; locked: number }[];
  error?: string;
}
