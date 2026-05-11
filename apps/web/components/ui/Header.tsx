"use client";

import { Bell, Search } from "lucide-react";
import Link from "next/link";

export function Header() {
  return (
    <header className="h-14 border-b border-border bg-deep/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type="text"
          placeholder="Sembol ara... (THYAO, BTC, AAPL)"
          className="bg-surface border border-border rounded-lg pl-9 pr-4 py-1.5 text-sm text-white/70 placeholder-white/30 w-72 focus:outline-none focus:border-primary/50 transition-colors"
        />
      </div>

      <div className="flex items-center gap-3">
        <Link href="/alarms">
          <button className="relative p-2 rounded-lg hover:bg-surface transition-colors">
            <Bell size={16} className="text-white/50" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
          </button>
        </Link>
        <Link href="/profile">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity">
            <span className="text-white font-bold text-xs">U</span>
          </div>
        </Link>
      </div>
    </header>
  );
}
