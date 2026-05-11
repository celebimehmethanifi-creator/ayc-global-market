"use client";

import axios from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { "Content-Type": "application/json" },
});

// Attach auth token — supports both ayc_token (our auth) and sb-access-token (legacy Supabase)
if (typeof window !== "undefined") {
  api.interceptors.request.use((config) => {
    const token =
      localStorage.getItem("ayc_access_token") ||
      localStorage.getItem("ayc_token") ||
      localStorage.getItem("sb-access-token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
}

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
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

