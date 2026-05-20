"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import type { ConnectedExchange, ExchangeId, BalanceResult } from "./types";

const STORAGE_KEY = "ayc_exchange_connections_v3";

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
  exchanges: [],
  addExchange: () => {},
  removeExchange: () => {},
  getExchange: () => undefined,
  primaryExchange: undefined,
  refreshBalance: async () => {},
  isLoading: false,
});

function safeParseConnections(raw: string | null): ConnectedExchange[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry) =>
        entry &&
        typeof entry.exchange === "string" &&
        typeof entry.connectionId === "string",
    ) as ConnectedExchange[];
  } catch {
    return [];
  }
}

export function ExchangeProvider({ children }: { children: ReactNode }) {
  const [exchanges, setExchanges] = useState<ConnectedExchange[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(STORAGE_KEY);
    setExchanges(safeParseConnections(raw));
  }, []);

  const persist = useCallback((next: ConnectedExchange[]) => {
    setExchanges(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, []);

  const addExchange = useCallback(
    (ex: ConnectedExchange) => {
      setExchanges((prev) => {
        const filtered = prev.filter((item) => item.exchange !== ex.exchange);
        const next = [...filtered, ex];
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
        return next;
      });
    },
    [],
  );

  const removeExchange = useCallback(
    (id: ExchangeId) => {
      setExchanges((prev) => {
        const next = prev.filter((item) => item.exchange !== id);
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
        return next;
      });
    },
    [],
  );

  const getExchange = useCallback(
    (id: ExchangeId) => exchanges.find((entry) => entry.exchange === id),
    [exchanges],
  );

  const refreshBalance = useCallback(
    async (id: ExchangeId) => {
      const connection = exchanges.find((entry) => entry.exchange === id);
      if (!connection) return;
      setIsLoading(true);
      try {
        const res = await fetch("/api/v1/exchange/balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ connectionId: connection.connectionId }),
        });
        const data: BalanceResult = await res.json();
        if (data.ok) {
          const next = exchanges.map((entry) =>
            entry.exchange === id
              ? {
                  ...entry,
                  totalBalance: data.totalBalance,
                  currency: data.currency,
                }
              : entry,
          );
          persist(next);
        }
      } catch {
        // no-op
      } finally {
        setIsLoading(false);
      }
    },
    [exchanges, persist],
  );

  return (
    <ExchangeCtx.Provider
      value={{
        exchanges,
        addExchange,
        removeExchange,
        getExchange,
        primaryExchange: exchanges[0],
        refreshBalance,
        isLoading,
      }}
    >
      {children}
    </ExchangeCtx.Provider>
  );
}

export const useExchange = () => useContext(ExchangeCtx);
