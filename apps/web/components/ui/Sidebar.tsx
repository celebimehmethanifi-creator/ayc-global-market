"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, TrendingUp, Shield, Briefcase, Bell, MessageSquare,
  Users, LineChart, User, Zap, Link2
} from "lucide-react";
import { clsx } from "clsx";

const NAV_ITEMS = [
  { href: "/dashboard", icon: Home, label: "Ana Ekran" },
  { href: "/market", icon: TrendingUp, label: "Piyasalar" },
  { href: "/signals", icon: Zap, label: "Sinyaller" },
  { href: "/portfolio", icon: Briefcase, label: "Portfoy" },
  { href: "/exchanges", icon: Link2, label: "Borsalar" },
  { href: "/alarms", icon: Bell, label: "Alarmlar" },
  { href: "/copilot", icon: MessageSquare, label: "AI Copilot", pro: true },
  { href: "/social", icon: Users, label: "Sosyal Radar" },
  { href: "/trades", icon: LineChart, label: "Islemlerim" },
  { href: "/profile", icon: User, label: "Profil" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 hidden lg:flex flex-col border-r h-full" style={{background:"linear-gradient(180deg,#0d1f52,#071336)", borderColor:"rgba(201,160,64,0.18)"}}>
      {/* Logo */}
      <div className="px-5 py-5 border-b" style={{borderColor:"rgba(201,160,64,0.18)"}}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-lg" style={{background:"linear-gradient(145deg,#1b3060,#0d1f52 55%,#c9a040)", color:"#e8bc52", letterSpacing:"0.8px"}}>
            AYC
          </div>
          <div>
            <div className="font-black text-sm tracking-wide" style={{color:"#f4f7ff"}}>AYC GLOBAL</div>
            <div className="text-xs font-semibold tracking-wider" style={{color:"#c9a040"}}>MARKET</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label, pro }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                active
                  ? "border"
                  : "hover:bg-white/5"
              )}
              style={active ? {
                background: "rgba(201,160,64,0.15)",
                color: "#e8bc52",
                borderColor: "rgba(201,160,64,0.35)"
              } : { color: "rgba(244,247,255,0.5)" }}
            >
              <Icon size={16} />
              <span>{label}</span>
              {pro && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded font-bold" style={{background:"rgba(201,160,64,0.2)", color:"#e8bc52"}}>PRO</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Upgrade CTA */}
      <div className="px-3 pb-4">
        <Link href="/subscribe">
          <div className="rounded-xl p-3 border text-center cursor-pointer transition-all hover:opacity-90" style={{background:"rgba(201,160,64,0.08)", borderColor:"rgba(201,160,64,0.25)"}}>
            <div className="text-xs font-bold mb-1" style={{color:"#e8bc52"}}>Pro&apos;ya Gec</div>
            <div className="text-[10px]" style={{color:"rgba(244,247,255,0.4)"}}>Sinirsiz sinyal + AI Copilot</div>
          </div>
        </Link>
      </div>
    </aside>
  );
}