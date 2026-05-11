"use client";
import React, { createContext, useCallback, useContext, useState } from "react";
import { AssetDetailModal } from "@/components/ui/AssetDetailModal";
import type { AssetInfo } from "@/components/ui/AssetDetailModal";

interface AssetModalCtx { openAsset: (a: AssetInfo) => void; }
const Ctx = createContext<AssetModalCtx>({ openAsset: () => {} });

export function AssetModalProvider({ children }: { children: React.ReactNode }) {
  const [asset, setAsset] = useState<AssetInfo | null>(null);
  const openAsset = useCallback((a: AssetInfo) => setAsset(a), []);
  return (
    <Ctx.Provider value={{ openAsset }}>
      {children}
      {asset && <AssetDetailModal asset={asset} onClose={() => setAsset(null)} />}
    </Ctx.Provider>
  );
}
export const useAssetModal = () => useContext(Ctx);