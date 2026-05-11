"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, LayoutDashboard, TrendingUp, Zap,
  BriefcaseBusiness, Bell, Bot, LineChart,
  UserCircle2, Users2, X, DollarSign, BarChart3,
  Fuel, Globe, Gem, Activity
} from "lucide-react";
import { useAssetModal } from "@/lib/AssetModalContext";
import { usePrices } from "@/lib/prices/PriceContext";

const PAGES = [
  {icon:LayoutDashboard,  label:"Komuta Merkezi",  sub:"Ana panel",            href:"/dashboard"},
  {icon:TrendingUp,       label:"Piyasalar",        sub:"Tüm piyasa verileri",  href:"/market"},
  {icon:Zap,              label:"Sinyaller",        sub:"AI sinyal akışı",      href:"/signals"},
  {icon:BriefcaseBusiness,label:"Portföy",          sub:"Varlık takibi",        href:"/portfolio"},
  {icon:Bell,             label:"Alarmlar",         sub:"Fiyat uyarıları",      href:"/alarms"},
  {icon:Bot,              label:"AI Copilot",       sub:"Piyasa analizi sor",   href:"/copilot"},
  {icon:Users2,           label:"Sosyal Radar",     sub:"Topluluk fikirleri",   href:"/social"},
  {icon:LineChart,        label:"İşlemlerim",       sub:"Geçmiş emirler",       href:"/trades"},
  {icon:UserCircle2,      label:"Profil",           sub:"Hesap ayarları",       href:"/profile"},
];

type AssetEntry = {
  label: string; name: string; priceKey: string;
  market: string; cat: string;
};

const ASSET_LIST: AssetEntry[] = [
  // Crypto
  {label:"BTC",   name:"Bitcoin",          priceKey:"BTCUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"ETH",   name:"Ethereum",         priceKey:"ETHUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"SOL",   name:"Solana",           priceKey:"SOLUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"BNB",   name:"BNB Chain",        priceKey:"BNBUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"XRP",   name:"Ripple",           priceKey:"XRPUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"DOGE",  name:"Dogecoin",         priceKey:"DOGEUSDT", market:"crypto",   cat:"Kripto"},
  {label:"ADA",   name:"Cardano",          priceKey:"ADAUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"AVAX",  name:"Avalanche",        priceKey:"AVAXUSDT", market:"crypto",   cat:"Kripto"},
  {label:"DOT",   name:"Polkadot",         priceKey:"DOTUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"MATIC", name:"Polygon",          priceKey:"MATICUSDT",market:"crypto",   cat:"Kripto"},
  {label:"LINK",  name:"Chainlink",        priceKey:"LINKUSDT", market:"crypto",   cat:"Kripto"},
  {label:"LTC",   name:"Litecoin",         priceKey:"LTCUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"UNI",   name:"Uniswap",          priceKey:"UNIUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"ATOM",  name:"Cosmos",           priceKey:"ATOMUSDT", market:"crypto",   cat:"Kripto"},
  {label:"NEAR",  name:"NEAR Protocol",    priceKey:"NEARUSDT", market:"crypto",   cat:"Kripto"},
  {label:"SHIB",  name:"Shiba Inu",        priceKey:"SHIBUSDT", market:"crypto",   cat:"Kripto"},
  {label:"TON",   name:"Toncoin",          priceKey:"TONUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"TRX",   name:"TRON",             priceKey:"TRXUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"OP",    name:"Optimism",         priceKey:"OPUSDT",   market:"crypto",   cat:"Kripto"},
  {label:"ARB",   name:"Arbitrum",         priceKey:"ARBUSDT",  market:"crypto",   cat:"Kripto"},
  // Extended Crypto
  {label:"ONDO",  name:"Ondo Finance",     priceKey:"ONDOUSDT", market:"crypto",   cat:"Kripto"},
  {label:"SUI",   name:"Sui",              priceKey:"SUIUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"APT",   name:"Aptos",            priceKey:"APTUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"PEPE",  name:"Pepe",             priceKey:"PEPEUSDT", market:"crypto",   cat:"Kripto"},
  {label:"WLD",   name:"Worldcoin",        priceKey:"WLDUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"INJ",   name:"Injective",        priceKey:"INJUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"FTM",   name:"Fantom",           priceKey:"FTMUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"SEI",   name:"Sei Network",      priceKey:"SEIUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"RENDER",name:"Render Token",     priceKey:"RENDERUSDT",market:"crypto",  cat:"Kripto"},
  {label:"FET",   name:"Fetch.ai",         priceKey:"FETUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"GRT",   name:"The Graph",        priceKey:"GRTUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"LDO",   name:"Lido DAO",         priceKey:"LDOUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"AAVE",  name:"Aave",             priceKey:"AAVEUSDT", market:"crypto",   cat:"Kripto"},
  {label:"MKR",   name:"Maker",            priceKey:"MKRUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"CRV",   name:"Curve DAO",        priceKey:"CRVUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"PENDLE",name:"Pendle",           priceKey:"PENDLEUSDT",market:"crypto",  cat:"Kripto"},
  {label:"ENA",   name:"Ethena",           priceKey:"ENAUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"EIGEN", name:"EigenLayer",       priceKey:"EIGENUSDT",market:"crypto",   cat:"Kripto"},
  {label:"JUP",   name:"Jupiter",          priceKey:"JUPUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"WIF",   name:"dogwifhat",        priceKey:"WIFUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"BONK",  name:"Bonk",             priceKey:"BONKUSDT", market:"crypto",   cat:"Kripto"},
  {label:"POPCAT",name:"Popcat",           priceKey:"POPCATUSDT",market:"crypto",  cat:"Kripto"},
  {label:"NOT",   name:"Notcoin",          priceKey:"NOTUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"XLM",   name:"Stellar",          priceKey:"XLMUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"VET",   name:"VeChain",          priceKey:"VETUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"ICP",   name:"Internet Computer",priceKey:"ICPUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"FIL",   name:"Filecoin",         priceKey:"FILUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"HBAR",  name:"Hedera",           priceKey:"HBARUSDT", market:"crypto",   cat:"Kripto"},
  {label:"TIA",   name:"Celestia",         priceKey:"TIAUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"STRK",  name:"Starknet",         priceKey:"STRKUSDT", market:"crypto",   cat:"Kripto"},
  {label:"ZK",    name:"ZKsync",           priceKey:"ZKUSDT",   market:"crypto",   cat:"Kripto"},
  {label:"ALGO",  name:"Algorand",         priceKey:"ALGOUSDT", market:"crypto",   cat:"Kripto"},
  {label:"FLOW",  name:"Flow",             priceKey:"FLOWUSDT", market:"crypto",   cat:"Kripto"},
  {label:"KAVA",  name:"Kava",             priceKey:"KAVAUSDT", market:"crypto",   cat:"Kripto"},
  {label:"ROSE",  name:"Oasis Network",    priceKey:"ROSEUSDT", market:"crypto",   cat:"Kripto"},
  {label:"IMX",   name:"Immutable",        priceKey:"IMXUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"BLUR",  name:"Blur",             priceKey:"BLURUSDT", market:"crypto",   cat:"Kripto"},
  {label:"STX",   name:"Stacks",           priceKey:"STXUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"DYM",   name:"Dymension",        priceKey:"DYMUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"MANTA", name:"Manta Network",    priceKey:"MANTAUSDT",market:"crypto",   cat:"Kripto"},
  {label:"MANA",  name:"Decentraland",     priceKey:"MANAUSDT", market:"crypto",   cat:"Kripto"},
  {label:"SAND",  name:"The Sandbox",      priceKey:"SANDUSDT", market:"crypto",   cat:"Kripto"},
  {label:"AXS",   name:"Axie Infinity",    priceKey:"AXSUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"CHZ",   name:"Chiliz",           priceKey:"CHZUSDT",  market:"crypto",   cat:"Kripto"},
  {label:"GALA",  name:"Gala",             priceKey:"GALAUSDT", market:"crypto",   cat:"Kripto"},
  {label:"CELO",  name:"Celo",             priceKey:"CELOUSDT", market:"crypto",   cat:"Kripto"},
  {label:"FLOKI", name:"FLOKI",            priceKey:"FLOKIUSDT",market:"crypto",   cat:"Kripto"},
  // US Stocks
  {label:"AAPL",  name:"Apple Inc.",       priceKey:"AAPL",  market:"us",  cat:"ABD Hisse"},
  {label:"NVDA",  name:"NVIDIA",           priceKey:"NVDA",  market:"us",  cat:"ABD Hisse"},
  {label:"TSLA",  name:"Tesla",            priceKey:"TSLA",  market:"us",  cat:"ABD Hisse"},
  {label:"MSFT",  name:"Microsoft",        priceKey:"MSFT",  market:"us",  cat:"ABD Hisse"},
  {label:"GOOGL", name:"Alphabet",         priceKey:"GOOGL", market:"us",  cat:"ABD Hisse"},
  {label:"AMZN",  name:"Amazon",           priceKey:"AMZN",  market:"us",  cat:"ABD Hisse"},
  {label:"META",  name:"Meta Platforms",   priceKey:"META",  market:"us",  cat:"ABD Hisse"},
  {label:"SPY",   name:"S&P 500 ETF",      priceKey:"SPY",   market:"etf", cat:"ETF"},
  {label:"QQQ",   name:"Nasdaq 100 ETF",   priceKey:"QQQ",   market:"etf", cat:"ETF"},
  {label:"AMD",   name:"AMD",              priceKey:"AMD",   market:"us",  cat:"ABD Hisse"},
  {label:"INTC",  name:"Intel",            priceKey:"INTC",  market:"us",  cat:"ABD Hisse"},
  {label:"NFLX",  name:"Netflix",          priceKey:"NFLX",  market:"us",  cat:"ABD Hisse"},
  {label:"JPM",   name:"JPMorgan Chase",   priceKey:"JPM",   market:"us",  cat:"ABD Hisse"},
  {label:"BABA",  name:"Alibaba",          priceKey:"BABA",  market:"us",  cat:"ABD Hisse"},
  {label:"V",     name:"Visa",             priceKey:"V",     market:"us",  cat:"ABD Hisse"},
  {label:"WMT",   name:"Walmart",          priceKey:"WMT",   market:"us",  cat:"ABD Hisse"},
  // BIST
  {label:"THYAO", name:"Türk Hava Yolları",priceKey:"THYAO", market:"turkey",cat:"BIST"},
  {label:"GARAN", name:"Garanti BBVA",     priceKey:"GARAN", market:"turkey",cat:"BIST"},
  {label:"ASELS", name:"Aselsan",          priceKey:"ASELS", market:"turkey",cat:"BIST"},
  {label:"AKBNK", name:"Akbank",           priceKey:"AKBNK", market:"turkey",cat:"BIST"},
  {label:"EREGL", name:"Ereğli Demir",     priceKey:"EREGL", market:"turkey",cat:"BIST"},
  {label:"KCHOL", name:"Koç Holding",      priceKey:"KCHOL", market:"turkey",cat:"BIST"},
  {label:"SISE",  name:"Şişe Cam",         priceKey:"SISE",  market:"turkey",cat:"BIST"},
  {label:"PGSUS", name:"Pegasus",          priceKey:"PGSUS", market:"turkey",cat:"BIST"},
  {label:"BIMAS", name:"BİM Mağazaları",   priceKey:"BIMAS", market:"turkey",cat:"BIST"},
  {label:"ENKAI", name:"Enka İnşaat",      priceKey:"ENKAI", market:"turkey",cat:"BIST"},
  // Precious / Metals
  {label:"XAUUSD",name:"Altın (Gold)",     priceKey:"XAUUSD",market:"precious",cat:"Değerli Maden"},
  {label:"XAGUSD",name:"Gümüş (Silver)",   priceKey:"XAGUSD",market:"precious",cat:"Değerli Maden"},
  {label:"XPTUSD",name:"Platin",           priceKey:"XPTUSD",market:"precious",cat:"Değerli Maden"},
  // Energy
  {label:"WTI",   name:"Ham Petrol (WTI)", priceKey:"WTIUSD",market:"energy",cat:"Enerji"},
  {label:"BRENT", name:"Brent Petrol",     priceKey:"BRENT", market:"energy",cat:"Enerji"},
  {label:"NATGAS",name:"Doğal Gaz",        priceKey:"NATGAS",market:"energy",cat:"Enerji"},
  // Forex
  {label:"USD/TRY",name:"Dolar/TL",        priceKey:"USDTRY",market:"forex",cat:"Forex"},
  {label:"EUR/USD",name:"Euro/Dolar",      priceKey:"EURUSD",market:"forex",cat:"Forex"},
  {label:"GBP/USD",name:"Sterlin/Dolar",   priceKey:"GBPUSD",market:"forex",cat:"Forex"},
  {label:"USD/JPY",name:"Dolar/Yen",       priceKey:"USDJPY",market:"forex",cat:"Forex"},
  {label:"EUR/TRY",name:"Euro/TL",         priceKey:"EURTRY",market:"forex",cat:"Forex"},
  // Indices
  {label:"S&P 500", name:"S&P 500",        priceKey:"SPX",   market:"index",cat:"Endeks"},
  {label:"NASDAQ",  name:"Nasdaq 100",     priceKey:"NDX",   market:"index",cat:"Endeks"},
  {label:"BIST 100",name:"Borsa İstanbul", priceKey:"BIST100",market:"index",cat:"Endeks"},
  {label:"DAX",     name:"DAX 40",         priceKey:"DAX",   market:"index",cat:"Endeks"},
  {label:"FTSE 100",name:"FTSE 100",       priceKey:"FTSE",  market:"index",cat:"Endeks"},
  {label:"VIX",     name:"Korku Endeksi",  priceKey:"VIX",   market:"index",cat:"Endeks"},
];

const CAT_ICON: Record<string,any> = {
  "Kripto":DollarSign,"ABD Hisse":BarChart3,"BIST":BarChart3,
  "ETF":Activity,"Değerli Maden":Gem,"Enerji":Fuel,
  "Forex":Globe,"Endeks":TrendingUp,
};

interface Props { open: boolean; onClose: () => void; }

export function CommandPalette({ open, onClose }: Props) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { openAsset } = useAssetModal();
  const prices = usePrices();

  const getLive = (priceKey: string) => {
    const e = prices[priceKey] ?? prices[priceKey + "USDT"] ?? prices[priceKey.replace("/","").toUpperCase()];
    if (!e || !e.price) return null;
    return { price: e.price, chg: isNaN(e.chg) ? 0 : e.chg };
  };

  const filteredAssets = q.trim().length < 1 ? ASSET_LIST.slice(0, 8) :
    ASSET_LIST.filter(a => {
      const s = q.toLowerCase().replace("/","").replace(" ","");
      return a.label.toLowerCase().replace("/","").includes(s) ||
             a.name.toLowerCase().replace(" ","").includes(s) ||
             a.cat.toLowerCase().includes(s) ||
             a.priceKey.toLowerCase().replace("usdt","").includes(s.replace("usdt",""));
    }).slice(0, 12);

  // Dynamic fallback: if query looks like a crypto symbol and nothing found, add it
  const dynamicFallback: AssetEntry[] = [];
  if (q.trim().length >= 2 && filteredAssets.length === 0) {
    const sym = q.trim().toUpperCase().replace("/","").replace(" ","");
    // Only add if not already in list
    if (!ASSET_LIST.find(a => a.label === sym || a.priceKey === sym + "USDT")) {
      dynamicFallback.push({
        label: sym,
        name: sym + " (arama)",
        priceKey: sym + "USDT",
        market: "crypto",
        cat: "Kripto",
      });
    }
  }
  const allAssets = filteredAssets.length > 0 ? filteredAssets : dynamicFallback;

  const filteredPages = q.trim().length < 1 ? PAGES :
    PAGES.filter(p => p.label.toLowerCase().includes(q.toLowerCase()) ||
                      p.href.includes(q.toLowerCase())).slice(0, 4);

  const allFiltered = [...filteredPages, ...allAssets];

  useEffect(() => {
    if (open) { setQ(""); setSel(0); setTimeout(() => inputRef.current?.focus(), 60); }
  }, [open]);

  const handleSelect = useCallback((item: any) => {
    if (item.priceKey) {
      // Asset: open modal instead of navigating
      const lp = getLive(item.priceKey);
      openAsset({
        symbol: item.priceKey,
        name: item.name,
        display: item.label,
        price: lp?.price ?? 0,
        chg: lp?.chg ?? 0,
        market: item.market,
      });
    } else {
      router.push(item.href);
    }
    onClose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredAssets, filteredPages, prices]);

  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(s+1, allFiltered.length-1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSel(s => Math.max(s-1, 0)); }
      if (e.key === "Enter" && allFiltered[sel]) handleSelect(allFiltered[sel]);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, allFiltered, sel, onClose, handleSelect]);

  if (!open) return null;

  return (
    <div className="cmd-overlay fade-in" onClick={onClose}>
      <div className="cmd-box" onClick={e => e.stopPropagation()}>
        {/* Input */}
        <div className="cmd-input-wrap">
          <Search size={15} style={{color:"var(--t3)",flexShrink:0}}/>
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder="Varlık, sayfa ara... (BTC, THYAO, AAPL, Altın...)"
            value={q}
            onChange={e => { setQ(e.target.value); setSel(0); }}
          />
          {q && (
            <button onClick={()=>setQ("")}
              style={{color:"var(--t3)",background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center"}}>
              <X size={14}/>
            </button>
          )}
          <kbd style={{
            padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600,
            background:"var(--bg-hover)",border:"1px solid var(--b2)",color:"var(--t3)",flexShrink:0
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div className="cmd-results">
          {/* Pages */}
          {filteredPages.length > 0 && (
            <div>
              <div className="cmd-section-label">Sayfalar</div>
              {filteredPages.map((item, i) => {
                const Icon = item.icon;
                const idx = i;
                return (
                  <div key={item.href} className={`cmd-item${sel===idx?" selected":""}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSel(idx)}>
                    <div className="cmd-item-icon page"><Icon size={14}/></div>
                    <div className="cmd-item-text">
                      <span className="cmd-item-label">{item.label}</span>
                      <span className="cmd-item-sub">{item.sub}</span>
                    </div>
                    <kbd className="cmd-enter">↵</kbd>
                  </div>
                );
              })}
            </div>
          )}

          {/* Assets */}
          {allAssets.length > 0 && (
            <div>
              <div className="cmd-section-label">
                {q.trim() ? `Varlıklar — "${q}"` : "Popüler Varlıklar"}
                {dynamicFallback.length > 0 && (
                  <span style={{marginLeft:8,fontSize:10,color:"rgba(255,165,0,0.7)"}}>• Binance'de ara</span>
                )}
              </div>
              {allAssets.map((item, i) => {
                const idx = filteredPages.length + i;
                const lp = getLive(item.priceKey);
                const up = (lp?.chg ?? 0) >= 0;
                const Icon = CAT_ICON[item.cat] ?? DollarSign;
                return (
                  <div key={item.priceKey} className={`cmd-item${sel===idx?" selected":""}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSel(idx)}>
                    <div className="cmd-item-icon asset"><Icon size={13}/></div>
                    <div className="cmd-item-text">
                      <span className="cmd-item-label">
                        <span style={{fontWeight:800,fontFamily:"var(--font-mono)"}}>{item.label}</span>
                        <span style={{fontWeight:400,color:"var(--t3)",marginLeft:6,fontSize:11}}>{item.name}</span>
                      </span>
                      <span className="cmd-item-sub">{item.cat}</span>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      {lp ? (
                        <>
                          <div style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:700,color:"var(--t1)"}}>
                            {lp.price >= 1000
                              ? `$${lp.price.toLocaleString("en-US",{maximumFractionDigits:2})}`
                              : lp.price < 1
                                ? `$${lp.price.toFixed(4)}`
                                : `$${lp.price.toFixed(2)}`}
                          </div>
                          <div style={{fontSize:10,fontWeight:700,color:up?"var(--up)":"var(--down)"}}>
                            {up?"+":""}{lp.chg.toFixed(2)}%
                          </div>
                        </>
                      ) : (
                        <div style={{fontSize:11,color:"var(--t4)"}}>—</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {allFiltered.length === 0 && (
            <div style={{textAlign:"center",padding:"32px 0",color:"var(--t4)",fontSize:13}}>
              "{q}" için sonuç bulunamadı
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding:"8px 16px",borderTop:"1px solid var(--b1)",
          display:"flex",gap:12,alignItems:"center",fontSize:10,color:"var(--t4)"
        }}>
          <span><kbd style={{padding:"1px 5px",borderRadius:3,background:"var(--bg-hover)",border:"1px solid var(--b2)"}}>↑↓</kbd> Gezin</span>
          <span><kbd style={{padding:"1px 5px",borderRadius:3,background:"var(--bg-hover)",border:"1px solid var(--b2)"}}>↵</kbd> Aç</span>
          <span><kbd style={{padding:"1px 5px",borderRadius:3,background:"var(--bg-hover)",border:"1px solid var(--b2)"}}>Esc</kbd> Kapat</span>
          <span style={{marginLeft:"auto"}}>💡 Varlık seçince detay paneli açılır</span>
        </div>
      </div>
    </div>
  );
}