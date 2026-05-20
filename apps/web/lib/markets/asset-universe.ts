export type AssetCategory =
  | "crypto"
  | "us"
  | "bist"
  | "commodity"
  | "energy"
  | "forex"
  | "index"
  | "etf"
  | "precious";

export type AssetLang = "tr" | "en";

export interface AssetUniverseItem {
  symbol: string;
  displaySymbol: string;
  name_tr: string;
  name_en: string;
  category: AssetCategory;
  exchange: string;
  providerSymbols: {
    binance?: string;
    coingecko?: string;
    yahoo?: string;
    twelvedata?: string;
    finnhub?: string;
    stooq?: string;
    alphavantage?: string;
  };
  searchAliases: string[];
  quoteCurrency: string;
  precision: number;
  isTradable: boolean;
  isChartable: boolean;
}

const CATEGORY_LABELS_TR: Record<AssetCategory, string> = {
  crypto: "Kripto",
  us: "ABD",
  bist: "BIST",
  commodity: "Emtia",
  energy: "Enerji",
  forex: "Forex",
  index: "Endeks",
  etf: "ETF",
  precious: "Değerli Maden",
};

const CATEGORY_LABELS_EN: Record<AssetCategory, string> = {
  crypto: "Crypto",
  us: "US",
  bist: "BIST",
  commodity: "Commodity",
  energy: "Energy",
  forex: "Forex",
  index: "Index",
  etf: "ETF",
  precious: "Precious Metals",
};

export const ASSET_UNIVERSE: readonly AssetUniverseItem[] = [
  { symbol: "BTCUSDT", displaySymbol: "BTC/USDT", name_tr: "Bitcoin", name_en: "Bitcoin", category: "crypto", exchange: "Binance", providerSymbols: { binance: "BTCUSDT", coingecko: "bitcoin" }, searchAliases: ["btc", "bitcoin"], quoteCurrency: "USDT", precision: 2, isTradable: true, isChartable: true },
  { symbol: "ETHUSDT", displaySymbol: "ETH/USDT", name_tr: "Ethereum", name_en: "Ethereum", category: "crypto", exchange: "Binance", providerSymbols: { binance: "ETHUSDT", coingecko: "ethereum" }, searchAliases: ["eth", "ethereum"], quoteCurrency: "USDT", precision: 2, isTradable: true, isChartable: true },
  { symbol: "SOLUSDT", displaySymbol: "SOL/USDT", name_tr: "Solana", name_en: "Solana", category: "crypto", exchange: "Binance", providerSymbols: { binance: "SOLUSDT", coingecko: "solana" }, searchAliases: ["sol", "solana"], quoteCurrency: "USDT", precision: 2, isTradable: true, isChartable: true },
  { symbol: "BNBUSDT", displaySymbol: "BNB/USDT", name_tr: "BNB", name_en: "BNB", category: "crypto", exchange: "Binance", providerSymbols: { binance: "BNBUSDT", coingecko: "binancecoin" }, searchAliases: ["bnb"], quoteCurrency: "USDT", precision: 2, isTradable: true, isChartable: true },
  { symbol: "XRPUSDT", displaySymbol: "XRP/USDT", name_tr: "XRP", name_en: "XRP", category: "crypto", exchange: "Binance", providerSymbols: { binance: "XRPUSDT", coingecko: "ripple" }, searchAliases: ["xrp", "ripple"], quoteCurrency: "USDT", precision: 4, isTradable: true, isChartable: true },
  { symbol: "ADAUSDT", displaySymbol: "ADA/USDT", name_tr: "Cardano", name_en: "Cardano", category: "crypto", exchange: "Binance", providerSymbols: { binance: "ADAUSDT", coingecko: "cardano" }, searchAliases: ["ada", "cardano"], quoteCurrency: "USDT", precision: 4, isTradable: true, isChartable: true },
  { symbol: "AVAXUSDT", displaySymbol: "AVAX/USDT", name_tr: "Avalanche", name_en: "Avalanche", category: "crypto", exchange: "Binance", providerSymbols: { binance: "AVAXUSDT", coingecko: "avalanche-2" }, searchAliases: ["avax", "avalanche"], quoteCurrency: "USDT", precision: 3, isTradable: true, isChartable: true },
  { symbol: "DOGEUSDT", displaySymbol: "DOGE/USDT", name_tr: "Dogecoin", name_en: "Dogecoin", category: "crypto", exchange: "Binance", providerSymbols: { binance: "DOGEUSDT", coingecko: "dogecoin" }, searchAliases: ["doge", "dogecoin"], quoteCurrency: "USDT", precision: 5, isTradable: true, isChartable: true },
  { symbol: "PEPEUSDT", displaySymbol: "PEPE/USDT", name_tr: "Pepe", name_en: "Pepe", category: "crypto", exchange: "Binance", providerSymbols: { binance: "PEPEUSDT", coingecko: "pepe" }, searchAliases: ["pepe"], quoteCurrency: "USDT", precision: 8, isTradable: true, isChartable: true },
  { symbol: "SHIBUSDT", displaySymbol: "SHIB/USDT", name_tr: "Shiba Inu", name_en: "Shiba Inu", category: "crypto", exchange: "Binance", providerSymbols: { binance: "SHIBUSDT", coingecko: "shiba-inu" }, searchAliases: ["shib", "shiba"], quoteCurrency: "USDT", precision: 8, isTradable: true, isChartable: true },

  { symbol: "AAPL", displaySymbol: "AAPL", name_tr: "Apple", name_en: "Apple", category: "us", exchange: "NASDAQ", providerSymbols: { finnhub: "AAPL", yahoo: "AAPL" }, searchAliases: ["aapl", "apple"], quoteCurrency: "USD", precision: 2, isTradable: true, isChartable: true },
  { symbol: "TSLA", displaySymbol: "TSLA", name_tr: "Tesla", name_en: "Tesla", category: "us", exchange: "NASDAQ", providerSymbols: { finnhub: "TSLA", yahoo: "TSLA" }, searchAliases: ["tsla", "tesla"], quoteCurrency: "USD", precision: 2, isTradable: true, isChartable: true },
  { symbol: "NVDA", displaySymbol: "NVDA", name_tr: "NVIDIA", name_en: "NVIDIA", category: "us", exchange: "NASDAQ", providerSymbols: { finnhub: "NVDA", yahoo: "NVDA" }, searchAliases: ["nvda", "nvidia"], quoteCurrency: "USD", precision: 2, isTradable: true, isChartable: true },
  { symbol: "MSFT", displaySymbol: "MSFT", name_tr: "Microsoft", name_en: "Microsoft", category: "us", exchange: "NASDAQ", providerSymbols: { finnhub: "MSFT", yahoo: "MSFT" }, searchAliases: ["msft", "microsoft"], quoteCurrency: "USD", precision: 2, isTradable: true, isChartable: true },
  { symbol: "AMZN", displaySymbol: "AMZN", name_tr: "Amazon", name_en: "Amazon", category: "us", exchange: "NASDAQ", providerSymbols: { finnhub: "AMZN", yahoo: "AMZN" }, searchAliases: ["amzn", "amazon"], quoteCurrency: "USD", precision: 2, isTradable: true, isChartable: true },
  { symbol: "GOOGL", displaySymbol: "GOOGL", name_tr: "Alphabet", name_en: "Alphabet", category: "us", exchange: "NASDAQ", providerSymbols: { finnhub: "GOOGL", yahoo: "GOOGL" }, searchAliases: ["googl", "alphabet", "google"], quoteCurrency: "USD", precision: 2, isTradable: true, isChartable: true },

  { symbol: "THYAO.IS", displaySymbol: "THYAO", name_tr: "Türk Hava Yolları", name_en: "Turkish Airlines", category: "bist", exchange: "BIST", providerSymbols: { yahoo: "THYAO.IS", twelvedata: "THYAO.IS" }, searchAliases: ["thyao", "thyao.is", "turk hava", "turkish airlines"], quoteCurrency: "TRY", precision: 2, isTradable: true, isChartable: true },
  { symbol: "ASELS.IS", displaySymbol: "ASELS", name_tr: "Aselsan", name_en: "Aselsan", category: "bist", exchange: "BIST", providerSymbols: { yahoo: "ASELS.IS", twelvedata: "ASELS.IS" }, searchAliases: ["asels", "aselsan"], quoteCurrency: "TRY", precision: 2, isTradable: true, isChartable: true },
  { symbol: "GARAN.IS", displaySymbol: "GARAN", name_tr: "Garanti BBVA", name_en: "Garanti BBVA", category: "bist", exchange: "BIST", providerSymbols: { yahoo: "GARAN.IS", twelvedata: "GARAN.IS" }, searchAliases: ["garan", "garanti"], quoteCurrency: "TRY", precision: 2, isTradable: true, isChartable: true },
  { symbol: "AKBNK.IS", displaySymbol: "AKBNK", name_tr: "Akbank", name_en: "Akbank", category: "bist", exchange: "BIST", providerSymbols: { yahoo: "AKBNK.IS", twelvedata: "AKBNK.IS" }, searchAliases: ["akbnk", "akbank"], quoteCurrency: "TRY", precision: 2, isTradable: true, isChartable: true },
  { symbol: "EREGL.IS", displaySymbol: "EREGL", name_tr: "Ereğli Demir Çelik", name_en: "Eregli Iron & Steel", category: "bist", exchange: "BIST", providerSymbols: { yahoo: "EREGL.IS", twelvedata: "EREGL.IS" }, searchAliases: ["eregl", "eregli"], quoteCurrency: "TRY", precision: 2, isTradable: true, isChartable: true },
  { symbol: "KCHOL.IS", displaySymbol: "KCHOL", name_tr: "Koç Holding", name_en: "Koc Holding", category: "bist", exchange: "BIST", providerSymbols: { yahoo: "KCHOL.IS" }, searchAliases: ["kchol", "koc holding"], quoteCurrency: "TRY", precision: 2, isTradable: true, isChartable: true },

  { symbol: "XAUUSD", displaySymbol: "XAU/USD", name_tr: "Altın", name_en: "Gold", category: "precious", exchange: "OTC", providerSymbols: { stooq: "xauusd", twelvedata: "XAU/USD" }, searchAliases: ["xauusd", "altin", "altın", "gold"], quoteCurrency: "USD", precision: 2, isTradable: true, isChartable: true },
  { symbol: "XAGUSD", displaySymbol: "XAG/USD", name_tr: "Gümüş", name_en: "Silver", category: "precious", exchange: "OTC", providerSymbols: { stooq: "xagusd", twelvedata: "XAG/USD" }, searchAliases: ["xagusd", "gumus", "gümüş", "silver"], quoteCurrency: "USD", precision: 2, isTradable: true, isChartable: true },
  { symbol: "XPTUSD", displaySymbol: "XPT/USD", name_tr: "Platin", name_en: "Platinum", category: "precious", exchange: "OTC", providerSymbols: { twelvedata: "XPT/USD" }, searchAliases: ["xptusd", "platin", "platinum"], quoteCurrency: "USD", precision: 2, isTradable: false, isChartable: true },

  { symbol: "WTIUSD", displaySymbol: "WTI", name_tr: "WTI Petrol", name_en: "WTI Crude Oil", category: "energy", exchange: "NYMEX", providerSymbols: { stooq: "cl.f", yahoo: "CL=F" }, searchAliases: ["wti", "wtiusd", "petrol"], quoteCurrency: "USD", precision: 2, isTradable: true, isChartable: true },
  { symbol: "BRENT", displaySymbol: "BRENT", name_tr: "Brent Petrol", name_en: "Brent Crude Oil", category: "energy", exchange: "ICE", providerSymbols: { stooq: "lco.f", yahoo: "BZ=F" }, searchAliases: ["brent", "brent petrol"], quoteCurrency: "USD", precision: 2, isTradable: true, isChartable: true },
  { symbol: "NATGAS", displaySymbol: "NATGAS", name_tr: "Doğal Gaz", name_en: "Natural Gas", category: "energy", exchange: "NYMEX", providerSymbols: { stooq: "ng.f", yahoo: "NG=F" }, searchAliases: ["natgas", "dogal gaz", "doğal gaz", "natural gas"], quoteCurrency: "USD", precision: 3, isTradable: false, isChartable: true },

  { symbol: "USDTRY", displaySymbol: "USD/TRY", name_tr: "Dolar TL", name_en: "US Dollar Turkish Lira", category: "forex", exchange: "FX", providerSymbols: { twelvedata: "USD/TRY", stooq: "usdtry" }, searchAliases: ["usdtry", "dolar tl", "dolar/tl", "dollar lira"], quoteCurrency: "TRY", precision: 4, isTradable: true, isChartable: true },
  { symbol: "EURTRY", displaySymbol: "EUR/TRY", name_tr: "Euro TL", name_en: "Euro Turkish Lira", category: "forex", exchange: "FX", providerSymbols: { twelvedata: "EUR/TRY", stooq: "eurtry" }, searchAliases: ["eurtry", "euro tl", "euro/tl"], quoteCurrency: "TRY", precision: 4, isTradable: true, isChartable: true },
  { symbol: "EURUSD", displaySymbol: "EUR/USD", name_tr: "Euro Dolar", name_en: "Euro Dollar", category: "forex", exchange: "FX", providerSymbols: { twelvedata: "EUR/USD", stooq: "eurusd" }, searchAliases: ["eurusd", "euro dolar", "euro dollar"], quoteCurrency: "USD", precision: 5, isTradable: true, isChartable: true },
  { symbol: "GBPUSD", displaySymbol: "GBP/USD", name_tr: "Sterlin Dolar", name_en: "Pound Dollar", category: "forex", exchange: "FX", providerSymbols: { twelvedata: "GBP/USD", stooq: "gbpusd" }, searchAliases: ["gbpusd", "sterlin dolar", "pound dollar"], quoteCurrency: "USD", precision: 5, isTradable: true, isChartable: true },
  { symbol: "USDJPY", displaySymbol: "USD/JPY", name_tr: "Dolar Yen", name_en: "US Dollar Japanese Yen", category: "forex", exchange: "FX", providerSymbols: { twelvedata: "USD/JPY", stooq: "usdjpy" }, searchAliases: ["usdjpy", "dolar yen", "dollar yen"], quoteCurrency: "JPY", precision: 3, isTradable: true, isChartable: true },

  { symbol: "SPX", displaySymbol: "SPX", name_tr: "S&P 500", name_en: "S&P 500", category: "index", exchange: "CBOE", providerSymbols: { yahoo: "^GSPC", finnhub: "SPY" }, searchAliases: ["spx", "sp500", "s&p500", "s&p 500"], quoteCurrency: "USD", precision: 2, isTradable: false, isChartable: true },
  { symbol: "NDX", displaySymbol: "NDX", name_tr: "Nasdaq 100", name_en: "Nasdaq 100", category: "index", exchange: "NASDAQ", providerSymbols: { yahoo: "^NDX", finnhub: "QQQ" }, searchAliases: ["ndx", "nasdaq", "nasdaq100"], quoteCurrency: "USD", precision: 2, isTradable: false, isChartable: true },
  { symbol: "DJI", displaySymbol: "DJI", name_tr: "Dow Jones", name_en: "Dow Jones", category: "index", exchange: "DJIA", providerSymbols: { yahoo: "^DJI", finnhub: "DIA" }, searchAliases: ["dji", "dow", "dow jones"], quoteCurrency: "USD", precision: 2, isTradable: false, isChartable: true },
  { symbol: "XU100", displaySymbol: "XU100", name_tr: "BIST 100", name_en: "BIST 100", category: "index", exchange: "BIST", providerSymbols: { yahoo: "XU100.IS" }, searchAliases: ["xu100", "bist100", "bist 100"], quoteCurrency: "TRY", precision: 2, isTradable: false, isChartable: true },
  { symbol: "VIX", displaySymbol: "VIX", name_tr: "Korku Endeksi", name_en: "Volatility Index", category: "index", exchange: "CBOE", providerSymbols: { yahoo: "^VIX" }, searchAliases: ["vix", "korku endeksi", "volatility"], quoteCurrency: "USD", precision: 2, isTradable: false, isChartable: true },

  { symbol: "SPY", displaySymbol: "SPY", name_tr: "S&P 500 ETF", name_en: "S&P 500 ETF", category: "etf", exchange: "NYSE Arca", providerSymbols: { finnhub: "SPY", yahoo: "SPY" }, searchAliases: ["spy", "sp500 etf"], quoteCurrency: "USD", precision: 2, isTradable: true, isChartable: true },
  { symbol: "QQQ", displaySymbol: "QQQ", name_tr: "Nasdaq 100 ETF", name_en: "Nasdaq 100 ETF", category: "etf", exchange: "NASDAQ", providerSymbols: { finnhub: "QQQ", yahoo: "QQQ" }, searchAliases: ["qqq", "nasdaq etf"], quoteCurrency: "USD", precision: 2, isTradable: true, isChartable: true },
  { symbol: "GLD", displaySymbol: "GLD", name_tr: "Altın ETF", name_en: "Gold ETF", category: "etf", exchange: "NYSE Arca", providerSymbols: { yahoo: "GLD" }, searchAliases: ["gld", "altin etf", "gold etf"], quoteCurrency: "USD", precision: 2, isTradable: true, isChartable: true },
  { symbol: "SLV", displaySymbol: "SLV", name_tr: "Gümüş ETF", name_en: "Silver ETF", category: "etf", exchange: "NYSE Arca", providerSymbols: { yahoo: "SLV" }, searchAliases: ["slv", "gumus etf", "silver etf"], quoteCurrency: "USD", precision: 2, isTradable: true, isChartable: true },
  { symbol: "VTI", displaySymbol: "VTI", name_tr: "Toplam Piyasa ETF", name_en: "Total Market ETF", category: "etf", exchange: "NYSE Arca", providerSymbols: { yahoo: "VTI" }, searchAliases: ["vti", "total market etf"], quoteCurrency: "USD", precision: 2, isTradable: true, isChartable: true },

  { symbol: "CORN", displaySymbol: "CORN", name_tr: "Mısır Vadeli", name_en: "Corn Futures", category: "commodity", exchange: "CBOT", providerSymbols: { stooq: "zc.f" }, searchAliases: ["corn", "misir", "mısır"], quoteCurrency: "USD", precision: 2, isTradable: false, isChartable: true },
  { symbol: "WHEAT", displaySymbol: "WHEAT", name_tr: "Buğday Vadeli", name_en: "Wheat Futures", category: "commodity", exchange: "CBOT", providerSymbols: { stooq: "zw.f" }, searchAliases: ["wheat", "bugday", "buğday"], quoteCurrency: "USD", precision: 2, isTradable: false, isChartable: true },
  { symbol: "SOYBEAN", displaySymbol: "SOYBEAN", name_tr: "Soya Vadeli", name_en: "Soybean Futures", category: "commodity", exchange: "CBOT", providerSymbols: { stooq: "zs.f" }, searchAliases: ["soybean", "soya"], quoteCurrency: "USD", precision: 2, isTradable: false, isChartable: true },
  { symbol: "COFFEE", displaySymbol: "COFFEE", name_tr: "Kahve Vadeli", name_en: "Coffee Futures", category: "commodity", exchange: "ICE", providerSymbols: { stooq: "kc.f" }, searchAliases: ["coffee", "kahve"], quoteCurrency: "USD", precision: 2, isTradable: false, isChartable: true },
  { symbol: "SUGAR", displaySymbol: "SUGAR", name_tr: "Şeker Vadeli", name_en: "Sugar Futures", category: "commodity", exchange: "ICE", providerSymbols: { stooq: "sb.f" }, searchAliases: ["sugar", "seker", "şeker"], quoteCurrency: "USD", precision: 2, isTradable: false, isChartable: true },
];

const SYMBOL_ALIASES: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
  THYAO: "THYAO.IS",
  ASELS: "ASELS.IS",
  GARAN: "GARAN.IS",
  AKBNK: "AKBNK.IS",
  EREGL: "EREGL.IS",
  USDTL: "USDTRY",
  "USD/TRY": "USDTRY",
  "EUR/TRY": "EURTRY",
  "EUR/USD": "EURUSD",
  XAU: "XAUUSD",
  XAG: "XAGUSD",
  WTI: "WTIUSD",
  BIST100: "XU100",
};

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function canonicalizeSymbol(rawSymbol: string): string {
  const upper = rawSymbol.trim().toUpperCase();
  const compact = upper.replace(/\s+/g, "").replace(/-/g, "");
  return SYMBOL_ALIASES[upper] || SYMBOL_ALIASES[compact] || compact;
}

export function getCategoryLabel(category: AssetCategory, lang: AssetLang = "tr"): string {
  return lang === "en" ? CATEGORY_LABELS_EN[category] : CATEGORY_LABELS_TR[category];
}

export function getAssetBySymbol(symbol: string): AssetUniverseItem | undefined {
  const normalized = canonicalizeSymbol(symbol);
  return ASSET_UNIVERSE.find((item) => item.symbol === normalized || item.displaySymbol.replace("/", "") === normalized);
}

export function getAssetDisplayName(
  asset: Pick<AssetUniverseItem, "name_tr" | "name_en">,
  lang: AssetLang = "tr",
): string {
  return lang === "en" ? asset.name_en : asset.name_tr;
}

export function searchAssets(query: string, lang: AssetLang = "tr", limit = 24): AssetUniverseItem[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [...ASSET_UNIVERSE].slice(0, limit);
  }

  const qCompact = normalizedQuery.replace(/\s+/g, "");
  const scored = ASSET_UNIVERSE.map((asset) => {
    const primaryName = normalizeSearchText(getAssetDisplayName(asset, lang));
    const secondaryName = normalizeSearchText(lang === "en" ? asset.name_tr : asset.name_en);
    const symbol = normalizeSearchText(asset.symbol);
    const displaySymbol = normalizeSearchText(asset.displaySymbol);
    const aliasPool = asset.searchAliases.map(normalizeSearchText);
    const category = normalizeSearchText(getCategoryLabel(asset.category, lang));

    let score = 0;
    if (symbol === qCompact || displaySymbol.replace(/\s+/g, "") === qCompact) score += 200;
    if (symbol.startsWith(qCompact)) score += 120;
    if (displaySymbol.replace(/\s+/g, "").startsWith(qCompact)) score += 110;
    if (primaryName.startsWith(normalizedQuery)) score += 100;
    if (secondaryName.startsWith(normalizedQuery)) score += 95;
    if (primaryName.includes(normalizedQuery)) score += 80;
    if (secondaryName.includes(normalizedQuery)) score += 70;
    if (aliasPool.some((alias) => alias === normalizedQuery)) score += 90;
    if (aliasPool.some((alias) => alias.includes(normalizedQuery))) score += 65;
    if (category.includes(normalizedQuery)) score += 40;

    return { asset, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.asset.symbol.localeCompare(b.asset.symbol));

  return scored.slice(0, limit).map((entry) => entry.asset);
}
