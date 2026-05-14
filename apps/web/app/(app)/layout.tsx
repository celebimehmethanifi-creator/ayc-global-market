"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, TrendingUp, Zap, BriefcaseBusiness,
  Bell, Bot, LineChart, UserCircle2, Users2,
  Search, Clock, Wifi, Calculator, BarChart3, Menu, X
} from "lucide-react";
import { QueryProvider } from "@/lib/query-provider";
import { MarketTicker } from "@/components/ui/MarketTicker";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { PriceProvider } from "@/lib/prices/PriceContext";
import { DemoProvider, useDemo } from "@/lib/demo/DemoContext";
import { AssetModalProvider } from "@/lib/AssetModalContext";
import { isGuestDemo, clearAuth, exitGuestDemo, getUser, isLoggedIn } from "@/lib/auth";
import { ExchangeProvider } from "@/lib/exchange/ExchangeContext";
import { useI18n } from "@/lib/i18n";

const NAV = [
  { href:"/dashboard",   Icon:LayoutDashboard,   labelKey:"nav.dashboard" },
  { href:"/market",      Icon:TrendingUp,         labelKey:"nav.market" },
  { href:"/signals",     Icon:Zap,                labelKey:"nav.signals" },
  { href:"/portfolio",   Icon:BriefcaseBusiness,  labelKey:"nav.portfolio" },
  { href:"/alarms",      Icon:Bell,               labelKey:"nav.alarms" },
  { href:"/copilot",     Icon:Bot,                labelKey:"nav.copilot", pro:true },
  { href:"/social",      Icon:Users2,             labelKey:"nav.social" },
  { href:"/trades",      Icon:LineChart,          labelKey:"nav.trades" },
  { href:"/scenario",    Icon:Calculator,         labelKey:"nav.scenario" },
  { href:"/performance", Icon:BarChart3,          labelKey:"nav.performance" },
  { href:"/profile",     Icon:UserCircle2,        labelKey:"nav.profile" },
];

const BOTTOM = [
  { href:"/dashboard", Icon:LayoutDashboard, labelKey:"bottom.command" },
  { href:"/market",    Icon:TrendingUp,      labelKey:"bottom.market" },
  { href:"/signals",   Icon:Zap,             labelKey:"bottom.signal" },
  { href:"/alarms",    Icon:Bell,            labelKey:"bottom.alarm"  },
  { href:"/profile",   Icon:UserCircle2,     labelKey:"bottom.profile" },
];

function useClock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const tick = () => setT(new Date().toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit",second:"2-digit"}));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

/* Sidebar (desktop only) */
function Sidebar({ onCmdOpen }: { onCmdOpen: () => void }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  return (
    <aside
      className="sidebar-desktop"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{
        width: open ? 210 : 52,
        flexShrink: 0,
        transition: "width 220ms cubic-bezier(0.4,0,0.2,1)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-panel)",
        borderRight: "1px solid var(--b1)",
        height: "100%",
        position: "relative",
        zIndex: 10,
      }}
    >
      {/* Brand */}
      <Link href="/dashboard" style={{
        textDecoration:"none", display:"flex", alignItems:"center", gap:10,
        height:40, padding:"0 12px", borderBottom:"1px solid var(--b1)",
        overflow:"hidden", whiteSpace:"nowrap", flexShrink:0,
      }}>
        <div className="brand-mark" style={{flexShrink:0}}>AYC</div>
        <div style={{
          overflow:"hidden",
          opacity: open ? 1 : 0,
          transform: open ? "translateX(0)" : "translateX(-8px)",
          transition: "opacity 160ms ease, transform 160ms ease",
          transitionDelay: open ? "70ms" : "0ms",
          whiteSpace:"nowrap",
        }}>
          <div style={{fontFamily:"Syne",fontSize:"12px",fontWeight:800,color:"var(--t1)",lineHeight:1.1}}>AYC</div>
          <div style={{fontFamily:"Syne",fontSize:"9px",fontWeight:700,color:"var(--gold)",letterSpacing:"0.12em"}}>GLOBAL MARKET</div>
        </div>
      </Link>

      {/* Nav */}
      <nav style={{flex:1, padding:"6px", display:"flex", flexDirection:"column", gap:2, overflowY:"auto", overflowX:"hidden"}}>
        {NAV.map(({ href, Icon, labelKey, pro }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link key={href} href={href} style={{
              display:"flex", alignItems:"center", gap:10,
              padding:"0 8px", height:38, borderRadius:9,
              textDecoration:"none", overflow:"hidden", whiteSpace:"nowrap", flexShrink:0,
              background: active ? "var(--gold-dim)" : "transparent",
              borderLeft: `2px solid ${active ? "var(--gold)" : "transparent"}`,
              color: active ? "var(--gold-bright)" : "var(--t3)",
              transition:"background 0.12s, color 0.12s, border-color 0.12s",
              position:"relative",
            }}
            onMouseEnter={e => { if(!active){const el=e.currentTarget as HTMLElement;el.style.background="var(--bg-hover)";el.style.color="var(--t2)";}}}
            onMouseLeave={e => { if(!active){const el=e.currentTarget as HTMLElement;el.style.background="transparent";el.style.color="var(--t3)";}}}
            >
              <div style={{width:20,height:20,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <Icon size={16} strokeWidth={active ? 2.2 : 1.7}/>
              </div>
              <span style={{
                fontFamily:"DM Sans", fontSize:"12px", fontWeight:active?700:500,
                flex:1, overflow:"hidden",
                opacity: open ? 1 : 0,
                transform: open ? "translateX(0)" : "translateX(-6px)",
                transition: "opacity 150ms ease, transform 150ms ease",
                transitionDelay: open ? "80ms" : "0ms",
              }}>{t(labelKey)}</span>
              {pro && (
                <span style={{
                  fontSize:"8px", fontFamily:"IBM Plex Mono", fontWeight:700,
                  background:"var(--gold-dim)", color:"var(--gold)",
                  border:"1px solid var(--gold-border)", padding:"1px 5px", borderRadius:3,
                  flexShrink:0,
                  opacity: open ? 1 : 0,
                  transition:"opacity 150ms ease",
                  transitionDelay: open ? "90ms" : "0ms",
                }}>PRO</span>
              )}
              {active && !open && (
                <div style={{
                  position:"absolute", right:6, top:"50%", transform:"translateY(-50%)",
                  width:4, height:4, borderRadius:"50%",
                  background:"var(--gold)", boxShadow:"0 0 5px var(--gold)",
                }}/>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{flexShrink:0, borderTop:"1px solid var(--b1)", padding:"6px", display:"flex", flexDirection:"column", gap:2}}>
        <button onClick={onCmdOpen} style={{
          display:"flex", alignItems:"center", gap:10,
          padding:"0 8px", height:36, borderRadius:9,
          background:"transparent", border:"none", cursor:"pointer",
          color:"var(--t3)", overflow:"hidden", whiteSpace:"nowrap", width:"100%",
          transition:"background 0.12s, color 0.12s",
        }}
        onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background="var(--bg-hover)";el.style.color="var(--t2)";}}
        onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background="transparent";el.style.color="var(--t3)";}}
        >
          <div style={{width:20,height:20,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <Search size={15} strokeWidth={1.7}/>
          </div>
          <span style={{
            fontFamily:"DM Sans", fontSize:"12px", fontWeight:500, flex:1, textAlign:"left",
            opacity:open?1:0, transform:open?"translateX(0)":"translateX(-6px)",
            transition:"opacity 150ms ease, transform 150ms ease",
            transitionDelay:open?"80ms":"0ms",
          }}>{t("search.assets")}</span>
          {open && (
            <span style={{
              fontFamily:"IBM Plex Mono", fontSize:"9px", color:"var(--t3)",
              background:"var(--bg-hover)", border:"1px solid var(--b1)",
              padding:"1px 5px", borderRadius:3, flexShrink:0,
            }}>^K</span>
          )}
        </button>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"4px 8px",overflow:"hidden",whiteSpace:"nowrap"}}>
          <div style={{width:20,height:20,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{
              width:7, height:7, borderRadius:"50%",
              background:"var(--up)", boxShadow:"0 0 6px var(--up)",
              animation:"pulse-live 2s ease-in-out infinite",
            }}/>
          </div>
          <span style={{
            fontFamily:"DM Sans", fontSize:"11px", color:"var(--up)", fontWeight:600,
            opacity:open?1:0, transform:open?"translateX(0)":"translateX(-6px)",
            transition:"opacity 150ms ease, transform 150ms ease",
            transitionDelay:open?"80ms":"0ms",
          }}>{t("status.liveConnected")}</span>
        </div>
      </div>
    </aside>
  );
}

/* Mobile drawer */
function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const path = usePathname();
  const { t } = useI18n();
  useEffect(() => { if (open) document.body.style.overflow = "hidden"; else document.body.style.overflow = ""; return () => { document.body.style.overflow = ""; }; }, [open]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div onClick={onClose} style={{
          position:"fixed", inset:0, zIndex:300,
          background:"rgba(8,10,16,0.7)", backdropFilter:"blur(4px)",
        }}/>
      )}
      {/* Drawer */}
      <nav style={{
        position:"fixed", top:0, left:0, bottom:0, zIndex:400,
        width:240, background:"var(--bg-panel)",
        borderRight:"1px solid var(--b1)",
        transform: open ? "translateX(0)" : "translateX(-100%)",
        transition:"transform 240ms cubic-bezier(0.4,0,0.2,1)",
        display:"flex", flexDirection:"column",
        overflowY:"auto",
      }}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",borderBottom:"1px solid var(--b1)",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div className="brand-mark">AYC</div>
            <div>
              <div style={{fontFamily:"Syne",fontSize:"13px",fontWeight:800,color:"var(--t1)",lineHeight:1.1}}>AYC</div>
              <div style={{fontFamily:"Syne",fontSize:"9px",fontWeight:700,color:"var(--gold)",letterSpacing:"0.12em"}}>GLOBAL MARKET</div>
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--t3)",cursor:"pointer",padding:4}}>
            <X size={18}/>
          </button>
        </div>
        <div style={{flex:1,padding:"8px",display:"flex",flexDirection:"column",gap:2}}>
          {NAV.map(({ href, Icon, labelKey, pro }) => {
            const active = path === href || path.startsWith(href + "/");
            return (
              <Link key={href} href={href} onClick={onClose} style={{
                display:"flex", alignItems:"center", gap:12,
                padding:"10px 12px", borderRadius:10,
                textDecoration:"none",
                background: active ? "var(--gold-dim)" : "transparent",
                color: active ? "var(--gold-bright)" : "var(--t2)",
                borderLeft: `2px solid ${active ? "var(--gold)" : "transparent"}`,
                fontSize:"13px", fontWeight:active?700:500,
                fontFamily:"DM Sans",
              }}>
                <Icon size={17} strokeWidth={active?2.2:1.7}/>
                <span style={{flex:1}}>{t(labelKey)}</span>
                {pro && <span style={{fontSize:"8px",background:"var(--gold-dim)",color:"var(--gold)",border:"1px solid var(--gold-border)",padding:"1px 5px",borderRadius:3,fontFamily:"IBM Plex Mono",fontWeight:700}}>PRO</span>}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}


/* Demo Mode Banner */
function DemoBanner() {
  const { demo, totalValue, totalPnlUSD, totalPnlPct, openPnlUSD } = useDemo();
  const up = totalPnlUSD >= 0;
  const fmtUSD = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 1000) return `$${(abs/1000).toFixed(1)}K`;
    return `$${abs.toFixed(2)}`;
  };

  return (
    <div style={{
      minHeight:34, flexShrink:0, display:"flex", alignItems:"center",
      justifyContent:"center", gap:10, flexWrap:"wrap",
      background:"linear-gradient(90deg,rgba(212,175,55,0.10),rgba(212,175,55,0.06))",
      borderBottom:"1px solid var(--gold-border)",
      fontSize:11, fontFamily:"var(--font-mono)", padding:"4px 8px",
    }}>
      <span style={{
        background:"var(--gold)", color:"#0C0E16",
        padding:"1px 7px", borderRadius:3, fontWeight:800, fontSize:10, letterSpacing:"0.06em",
      }}>DEMO MOD</span>
      <span style={{color:"var(--t2)", fontWeight:600}}>
        Demo bakiye: <span style={{color:"var(--gold)", fontWeight:800}}>{fmtUSD(demo.balance)}</span>
      </span>
      <span style={{color:"var(--b1)"}}>|</span>
      <span style={{color:"var(--t2)", fontWeight:600}}>
        Equity: <span style={{color:"var(--t1)", fontWeight:800}}>{fmtUSD(totalValue)}</span>
      </span>
      <span style={{color:"var(--b1)"}}>|</span>
      <span style={{color:openPnlUSD>=0?"var(--up)":"var(--down)", fontWeight:700}}>
        Açık K/Z {openPnlUSD>=0?"+":""}{fmtUSD(openPnlUSD)}
      </span>
      <span style={{color:"var(--b1)"}}>|</span>
      <span style={{color:up?"var(--up)":"var(--down)", fontWeight:700}}>
        {up?"+":""}{fmtUSD(totalPnlUSD)} ({up?"+":""}{totalPnlPct.toFixed(2)}%)
      </span>
      <span style={{color:"var(--b1)"}}>|</span>
      <a href="/signup" style={{
        color:"var(--gold)", textDecoration:"none", fontWeight:700, fontSize:10,
        padding:"2px 8px", border:"1px solid var(--gold-border)",
        borderRadius:4, letterSpacing:"0.04em",
        transition:"background 0.15s",
      }}
        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="var(--gold-dim)";}}
        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}
      >
        GERÇEK HESAP AÇ {" >"}
      </a>
    </div>
  );
}

/* TopBar */
function TopBar({ onCmdOpen, onMenuOpen }: { onCmdOpen: () => void; onMenuOpen: () => void }) {
  const path = usePathname();
  const clock = useClock();
  const router = useRouter();
  const { t } = useI18n();
  const [authState, setAuthState] = React.useState<{loggedIn:boolean;name:string;tier:string}>({ loggedIn:false, name:"", tier:"free" });

  React.useEffect(() => {
    const user = getUser();
    const loggedIn = isLoggedIn();
    setAuthState({ loggedIn, name: user?.display_name || user?.email || "", tier: user?.tier || "free" });
  }, [path]);

  function handleLogout() {
    clearAuth();
    exitGuestDemo();
    router.push("/signin");
  }

  const TITLES: Record<string, string> = {
    "/dashboard":"nav.dashboard", "/market":"nav.market", "/signals":"nav.signals",
    "/portfolio":"nav.portfolio", "/alarms":"nav.alarms", "/copilot":"nav.copilot",
    "/social":"nav.social", "/trades":"nav.trades", "/profile":"nav.profile",
    "/scenario":"nav.scenario", "/performance":"nav.performance",
    "/account":"nav.profile", "/subscribe":"profile.subscription",
  };
  const titleKey = Object.entries(TITLES).find(([k]) => path.startsWith(k))?.[1];
  const title = titleKey ? t(titleKey) : "AYC Global Market";
  const tierColor = authState.tier === "elite" ? "var(--gold)" : authState.tier === "pro" ? "#8b5cf6" : "var(--t3)";
  const tierLabel = authState.tier === "elite" ? "ELITE" : authState.tier === "pro" ? "PRO" : "FREE";

  return (
    <header className="app-topbar" style={{
      height:44, display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"0 12px", gap:10,
      background:"var(--bg-panel)", borderBottom:"1px solid var(--b1)",
      flexShrink:0,
    }}>
      <button className="mobile-menu-btn" onClick={onMenuOpen} style={{
        background:"none", border:"none", color:"var(--t2)", cursor:"pointer",
        display:"none", padding:4, borderRadius:6,
      }}>
        <Menu size={20}/>
      </button>
      <span style={{fontFamily:"Syne",fontSize:"13px",fontWeight:700,color:"var(--t1)",whiteSpace:"nowrap",flex:"0 0 auto"}}>
        {title}
      </span>
      <button onClick={onCmdOpen} className="topbar-search" style={{maxWidth:280,flex:1}}>
        <Search size={12} style={{color:"var(--t3)",flexShrink:0}}/>
        <span className="topbar-search-hint">{t("search.placeholder")}</span>
        <span className="topbar-kbd">Ctrl K</span>
      </button>
      <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
        <button className="mobile-search-btn" onClick={onCmdOpen} style={{
          background:"none", border:"1px solid var(--b1)", color:"var(--t3)", cursor:"pointer",
          display:"none", padding:"5px 8px", borderRadius:6, alignItems:"center",
        }}>
          <Search size={14}/>
        </button>
        <div className="topbar-pill pill-time" suppressHydrationWarning>
          <Clock size={11}/>
          <span className="mono" style={{fontSize:"11px"}} suppressHydrationWarning>{clock}</span>
        </div>
        <div className="topbar-pill pill-live">
          <span className="pulse-dot green"/>
          <span>{t("status.live")}</span>
        </div>
        {authState.loggedIn ? (
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <Link href="/profile" style={{textDecoration:"none",display:"flex",alignItems:"center",gap:7}}>
              <div style={{
                width:28, height:28, borderRadius:"50%",
                background:"linear-gradient(135deg,var(--gold),#B88A30)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontFamily:"Syne", fontWeight:800, fontSize:12, color:"#0C0E16", flexShrink:0,
              }}>
                {(authState.name?.charAt(0) || "U").toUpperCase()}
              </div>
              <div style={{display:"flex",flexDirection:"column",lineHeight:1.1}} className="topbar-user-name">
                <span style={{fontSize:11,fontWeight:700,color:"var(--t1)",maxWidth:80,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>
                  {authState.name || "User"}
                </span>
                <span style={{fontSize:9,fontWeight:700,color:tierColor,letterSpacing:"0.08em"}}>{tierLabel}</span>
              </div>
            </Link>
            <button onClick={handleLogout} title={t("auth.logout")} style={{
              background:"none", border:"1px solid var(--b1)", borderRadius:6,
              color:"var(--t3)", cursor:"pointer", padding:"4px 8px", fontSize:11,
              fontFamily:"var(--font-body)", fontWeight:600, display:"flex", alignItems:"center", gap:4,
            }}
              onMouseEnter={e => { const el=e.currentTarget as HTMLElement; el.style.borderColor="rgba(239,68,68,0.5)"; el.style.color="#ef4444"; }}
              onMouseLeave={e => { const el=e.currentTarget as HTMLElement; el.style.borderColor="var(--b1)"; el.style.color="var(--t3)"; }}
            >
              <UserCircle2 size={13}/><span className="topbar-logout-text">{t("auth.logout")}</span>
            </button>
          </div>
        ) : (
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <Link href="/signin" style={{
              textDecoration:"none", padding:"5px 9px",
              border:"1px solid var(--b1)", borderRadius:6,
              fontSize:11, fontWeight:600, color:"var(--t2)",
              fontFamily:"var(--font-body)", whiteSpace:"nowrap",
            }}>
              {t("auth.login")}
            </Link>
            <Link href="/signup" style={{
              textDecoration:"none", padding:"5px 9px",
              background:"linear-gradient(135deg,var(--gold),#B88A30)",
              borderRadius:6, fontSize:11, fontWeight:700, color:"#0C0E16",
              fontFamily:"var(--font-body)", whiteSpace:"nowrap",
              boxShadow:"0 2px 8px rgba(212,175,55,0.25)",
            }}>
              {t("auth.signup")}
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}



/* DemoModeWrapper (shows banner if demo/guest) */
function DemoModeWrapper() {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    // Show banner if guest demo OR if authenticated user with no real investment yet
    if (isGuestDemo() || !getUser()) setShow(true);
  }, []);
  if (!show) return null;
  return <DemoBanner />;
}

/* Root layout */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); setCmdOpen(v => !v); }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  return (
    <QueryProvider>
      <PriceProvider><DemoProvider><AssetModalProvider><ExchangeProvider>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)}/>
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}/>

      <div className="app-root" style={{display:"flex",flexDirection:"column",height:"100dvh",overflow:"hidden"}}>
        {/* Demo mode banner */}
        <div className="app-demo-banner"><DemoModeWrapper/></div>
        {/* Ticker - full width */}
        <div className="app-ticker" style={{height:32,flexShrink:0}}><MarketTicker/></div>

        {/* TopBar */}
        <TopBar onCmdOpen={() => setCmdOpen(true)} onMenuOpen={() => setDrawerOpen(true)}/>

        {/* Sidebar + Main */}
        <div style={{display:"flex",flex:1,overflow:"hidden",minHeight:0}}>
          <Sidebar onCmdOpen={() => setCmdOpen(true)}/>

          <main className="app-main" style={{
            flex:1, overflowY:"auto", overflowX:"hidden",
            padding:"16px",
          }}>
            {children}
          </main>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav" style={{display:"none"}}>
        {BOTTOM.map(({ href, Icon, labelKey }) => {
          // active class handled by CSS but need pathname
          return (
            <BottomNavLink key={href} href={href} Icon={Icon} labelKey={labelKey}/>
          );
        })}
      </nav>
      </ExchangeProvider></AssetModalProvider></DemoProvider></PriceProvider>
    </QueryProvider>
  );
}

function BottomNavLink({ href, Icon, labelKey }: { href:string; Icon:any; labelKey:string }) {
  const path = usePathname();
  const { t } = useI18n();
  const active = path === href || path.startsWith(href + "/");
  return (
    <Link href={href} className={`bn-btn${active ? " active" : ""}`}>
      <Icon size={20} strokeWidth={active ? 2.2 : 1.6}/>
      <span>{t(labelKey)}</span>
    </Link>
  );
}






