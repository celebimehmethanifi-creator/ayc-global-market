"use client";
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { ConnectedExchange, ExchangeId, BalanceResult } from './types';

const STORAGE_KEY = 'ayc_ex_v2';

function enc(s: string): string {
  try { return btoa(encodeURIComponent(s)); } catch { return s; }
}
function dec(s: string): string {
  try { return decodeURIComponent(atob(s)); } catch { return s; }
}

interface ExchangeContextType {
  exchanges: ConnectedExchange[];
  addExchange: (ex: ConnectedExchange) => void;
  removeExchange: (id: ExchangeId) => void;
  getExchange: (id: ExchangeId) => ConnectedExchange | undefined;
  primaryExchange: ConnectedExchange | undefined;
  refreshBalance: (id: ExchangeId) => Promise<void>;
  isLoading: boolean;
}

const ExchangeCtx = createContext<ExchangeContextType>({
  exchanges: [], addExchange: () => {}, removeExchange: () => {},
  getExchange: () => undefined, primaryExchange: undefined,
  refreshBalance: async () => {}, isLoading: false,
});

export function ExchangeProvider({ children }: { children: ReactNode }) {
  const [exchanges, setExchanges] = useState<ConnectedExchange[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setExchanges(JSON.parse(dec(raw)));
    } catch {}
  }, []);

  const save = useCallback((exs: ConnectedExchange[]) => {
    setExchanges(exs);
    try { localStorage.setItem(STORAGE_KEY, enc(JSON.stringify(exs))); } catch {}
  }, []);

  const addExchange = useCallback((ex: ConnectedExchange) => {
    setExchanges(prev => {
      const filtered = prev.filter(e => e.exchange !== ex.exchange);
      const next = [...filtered, ex];
      try { localStorage.setItem(STORAGE_KEY, enc(JSON.stringify(next))); } catch {}
      return next;
    });
  }, []);

  const removeExchange = useCallback((id: ExchangeId) => {
    setExchanges(prev => {
      const next = prev.filter(e => e.exchange !== id);
      try { localStorage.setItem(STORAGE_KEY, enc(JSON.stringify(next))); } catch {}
      return next;
    });
  }, []);

  const getExchange = useCallback((id: ExchangeId) => {
    return exchanges.find(e => e.exchange === id);
  }, [exchanges]);

  const refreshBalance = useCallback(async (id: ExchangeId) => {
    const ex = exchanges.find(e => e.exchange === id);
    if (!ex) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/exchange/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchange: ex.exchange, apiKey: ex.apiKey, apiSecret: ex.apiSecret, passphrase: ex.passphrase }),
      });
      const data: BalanceResult = await res.json();
      if (data.ok) {
        setExchanges(prev => {
          const next = prev.map(e => e.exchange === id ? { ...e, totalBalance: data.totalBalance, currency: data.currency } : e);
          try { localStorage.setItem(STORAGE_KEY, enc(JSON.stringify(next))); } catch {}
          return next;
        });
      }
    } catch {} finally { setIsLoading(false); }
  }, [exchanges]);

  return (
    <ExchangeCtx.Provider value={{ exchanges, addExchange, removeExchange, getExchange, primaryExchange: exchanges[0], refreshBalance, isLoading }}>
      {children}
    </ExchangeCtx.Provider>
  );
}

export const useExchange = () => useContext(ExchangeCtx);
