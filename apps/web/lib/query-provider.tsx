"use client";

import axios from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

const SAME_ORIGIN_API_BASE = "/api/v1";
const EXTERNAL_API_URL = (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");

const AXIOS_DEFAULTS = {
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
};

export const webApi = axios.create({
  baseURL: SAME_ORIGIN_API_BASE,
  ...AXIOS_DEFAULTS,
});

export const externalApi = axios.create({
  baseURL: EXTERNAL_API_URL ? `${EXTERNAL_API_URL}/api/v1` : SAME_ORIGIN_API_BASE,
  ...AXIOS_DEFAULTS,
});

// Backward compatibility: default client is same-origin for cookie/session endpoints.
export const api = webApi;

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
