import { NextRequest, NextResponse } from 'next/server';

const CG_KEY = process.env.COINGECKO_API_KEY || 'CG-MoxLLAjSA3r2JHXanw9fotD5';
const TD_KEY = process.env.TWELVEDATA_API_KEY || 'c6293bae084a4c0fb46e2cb5df525ef8';
const FH_KEY = process.env.FINNHUB_API_KEY || 'd7pp429r01qosaapdudgd7pp429r01qosaapdue0';

const CRYPTO_CG_IDS = [
  'bitcoin','ethereum','solana','binancecoin','ripple','dogecoin','cardano','avalanche-2',
  'chainlink','matic-network','polkadot','litecoin','uniswap','cosmos','near','shiba-inu',
  'tron','optimism','arbitrum','ondo-finance','sui','aptos','pepe','injective-protocol',
  'fantom','sei-network','render-token','the-graph','lido-dao','stacks','kaspa',
  'mantle','celestia','immutable-x','worldcoin-wld','fetch-ai',
];

const CG_ID_TO_SYM: Record<string, { symbol: string; display: string; name: string }> = {
  'bitcoin': { symbol: 'BTCUSDT', display: 'BTC', name: 'Bitcoin' },
  'ethereum': { symbol: 'ETHUSDT', display: 'ETH', name: 'Ethereum' },
  'solana': { symbol: 'SOLUSDT', display: 'SOL', name: 'Solana' },
  'binancecoin': { symbol: 'BNBUSDT', display: 'BNB', name: 'BNB' },
  'ripple': { symbol: 'XRPUSDT', display: 'XRP', name: 'Ripple' },
  'dogecoin': { symbol: 'DOGEUSDT', display: 'DOGE', name: 'Dogecoin' },
  'cardano': { symbol: 'ADAUSDT', display: 'ADA', name: 'Cardano' },
  'avalanche-2': { symbol: 'AVAXUSDT', display: 'AVAX', name: 'Avalanche' },
  'chainlink': { symbol: 'LINKUSDT', display: 'LINK', name: 'Chainlink' },
  'matic-network': { symbol: 'MATICUSDT', display: 'MATIC', name: 'Polygon' },
  'polkadot': { symbol: 'DOTUSDT', display: 'DOT', name: 'Polkadot' },
  'litecoin': { symbol: 'LTCUSDT', display: 'LTC', name: 'Litecoin' },
  'uniswap': { symbol: 'UNIUSDT', display: 'UNI', name: 'Uniswap' },
  'cosmos': { symbol: 'ATOMUSDT', display: 'ATOM', name: 'Cosmos' },
  'near': { symbol: 'NEARUSDT', display: 'NEAR', name: 'NEAR Protocol' },
  'shiba-inu': { symbol: 'SHIBUSDT', display: 'SHIB', name: 'Shiba Inu' },
  'tron': { symbol: 'TRXUSDT', display: 'TRX', name: 'TRON' },
  'optimism': { symbol: 'OPUSDT', display: 'OP', name: 'Optimism' },
  'arbitrum': { symbol: 'ARBUSDT', display: 'ARB', name: 'Arbitrum' },
  'ondo-finance': { symbol: 'ONDOUSDT', display: 'ONDO', name: 'Ondo Finance' },
  'sui': { symbol: 'SUIUSDT', display: 'SUI', name: 'Sui' },
  'aptos': { symbol: 'APTUSDT', display: 'APT', name: 'Aptos' },
  'pepe': { symbol: 'PEPEUSDT', display: 'PEPE', name: 'Pepe' },
  'injective-protocol': { symbol: 'INJUSDT', display: 'INJ', name: 'Injective' },
  'fantom': { symbol: 'FTMUSDT', display: 'FTM', name: 'Fantom' },
  'sei-network': { symbol: 'SEIUSDT', display: 'SEI', name: 'Sei' },
  'render-token': { symbol: 'RENDERUSDT', display: 'RENDER', name: 'Render' },
  'the-graph': { symbol: 'GRTUSDT', display: 'GRT', name: 'The Graph' },
  'lido-dao': { symbol: 'LDOUSDT', display: 'LDO', name: 'Lido DAO' },
  'stacks': { symbol: 'STXUSDT', display: 'STX', name: 'Stacks' },
  'kaspa': { symbol: 'KASUSDT', display: 'KAS', name: 'Kaspa' },
  'mantle': { symbol: 'MNTUSDT', display: 'MNT', name: 'Mantle' },
  'celestia': { symbol: 'TIAUSDT', display: 'TIA', name: 'Celestia' },
  'immutable-x': { symbol: 'IMXUSDT', display: 'IMX', name: 'Immutable X' },
  'worldcoin-wld': { symbol: 'WLDUSDT', display: 'WLD', name: 'Worldcoin' },
  'fetch-ai': { symbol: 'FETUSDT', display: 'FET', name: 'Fetch.ai' },
};

function formatNum(n: number): string {
  if (n >= 1e12) return (n/1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n/1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
  return n.toFixed(0);
}

async function fetchCryptoData(limit: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${CRYPTO_CG_IDS.join(',')}&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=24h,7d&x_cg_demo_api_key=${CG_KEY}`;
  const r = await fetch(url, { signal: ctrl.signal });
  clearTimeout(t);
  if (!r.ok) throw new Error('CoinGecko failed');
  const coins = await r.json();
  return coins.map((c: any) => {
    const meta = CG_ID_TO_SYM[c.id] || { symbol: c.symbol.toUpperCase() + 'USDT', display: c.symbol.toUpperCase(), name: c.name };
    return {
      symbol: meta.symbol, display: meta.display, name: meta.name,
      price: c.current_price || 0,
      chg: c.price_change_percentage_24h || 0,
      chg7d: c.price_change_percentage_7d_in_currency || 0,
      mcap: formatNum(c.market_cap || 0),
      vol: formatNum(c.total_volume || 0),
      market: 'crypto',
    };
  });
}

const US_STOCKS = [
  { symbol: 'AAPL', name: 'Apple', market: 'us' },
  { symbol: 'NVDA', name: 'NVIDIA', market: 'us' },
  { symbol: 'MSFT', name: 'Microsoft', market: 'us' },
  { symbol: 'AMZN', name: 'Amazon', market: 'us' },
  { symbol: 'META', name: 'Meta', market: 'us' },
  { symbol: 'GOOGL', name: 'Alphabet', market: 'us' },
  { symbol: 'TSLA', name: 'Tesla', market: 'us' },
  { symbol: 'BRK.B', name: 'Berkshire', market: 'us' },
  { symbol: 'JPM', name: 'JPMorgan', market: 'us' },
  { symbol: 'V', name: 'Visa', market: 'us' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', market: 'us' },
  { symbol: 'WMT', name: 'Walmart', market: 'us' },
  { symbol: 'UNH', name: 'UnitedHealth', market: 'us' },
  { symbol: 'XOM', name: 'ExxonMobil', market: 'us' },
  { symbol: 'MA', name: 'Mastercard', market: 'us' },
];

const TURKEY_STOCKS = [
  { symbol: 'THYAO.IS', display: 'THYAO', name: 'Turk Hava Yollari', market: 'turkey' },
  { symbol: 'GARAN.IS', display: 'GARAN', name: 'Garanti BBVA', market: 'turkey' },
  { symbol: 'AKBNK.IS', display: 'AKBNK', name: 'Akbank', market: 'turkey' },
  { symbol: 'ASELS.IS', display: 'ASELS', name: 'Aselsan', market: 'turkey' },
  { symbol: 'EREGL.IS', display: 'EREGL', name: 'Eregli Demir', market: 'turkey' },
  { symbol: 'SISE.IS', display: 'SISE', name: 'Sise Cam', market: 'turkey' },
  { symbol: 'KCHOL.IS', display: 'KCHOL', name: 'Koc Holding', market: 'turkey' },
  { symbol: 'TUPRS.IS', display: 'TUPRS', name: 'Tupras', market: 'turkey' },
  { symbol: 'BIMAS.IS', display: 'BIMAS', name: 'BIM', market: 'turkey' },
  { symbol: 'FROTO.IS', display: 'FROTO', name: 'Ford Otosan', market: 'turkey' },
];

const FOREX_PAIRS = [
  { symbol: 'EURUSD=X', display: 'EUR/USD', name: 'Euro / Dolar', market: 'forex' },
  { symbol: 'USDJPY=X', display: 'USD/JPY', name: 'Dolar / Yen', market: 'forex' },
  { symbol: 'USDTRY=X', display: 'USD/TRY', name: 'Dolar / Lira', market: 'forex' },
  { symbol: 'GBPUSD=X', display: 'GBP/USD', name: 'Sterlin / Dolar', market: 'forex' },
  { symbol: 'USDCHF=X', display: 'USD/CHF', name: 'Dolar / Franc', market: 'forex' },
  { symbol: 'AUDUSD=X', display: 'AUD/USD', name: 'Avustralya / Dolar', market: 'forex' },
  { symbol: 'USDCAD=X', display: 'USD/CAD', name: 'Dolar / Kanada', market: 'forex' },
];

const PRECIOUS = [
  { symbol: 'GC=F', display: 'XAU/USD', name: 'Altin', market: 'precious' },
  { symbol: 'SI=F', display: 'XAG/USD', name: 'Gumus', market: 'precious' },
  { symbol: 'PL=F', display: 'XPT/USD', name: 'Platin', market: 'precious' },
  { symbol: 'PA=F', display: 'XPD/USD', name: 'Paladyum', market: 'precious' },
];

const ENERGY = [
  { symbol: 'CL=F', display: 'WTI', name: 'Ham Petrol', market: 'energy' },
  { symbol: 'BZ=F', display: 'BRENT', name: 'Brent Petrol', market: 'energy' },
  { symbol: 'NG=F', display: 'NAT.GAS', name: 'Dogalgaz', market: 'energy' },
  { symbol: 'HO=F', display: 'HEAT.OIL', name: 'Isinma Yagi', market: 'energy' },
];

const INDICES = [
  { symbol: '^GSPC', display: 'SPX', name: 'S&P 500', market: 'index' },
  { symbol: '^DJI', display: 'DOW', name: 'Dow Jones', market: 'index' },
  { symbol: '^NDX', display: 'NDX', name: 'NASDAQ 100', market: 'index' },
  { symbol: '^GDAXI', display: 'DAX', name: 'DAX 40', market: 'index' },
  { symbol: '^FTSE', display: 'FTSE', name: 'FTSE 100', market: 'index' },
  { symbol: '^VIX', display: 'VIX', name: 'VIX Fear', market: 'index' },
  { symbol: 'XU100.IS', display: 'BIST100', name: 'BIST 100', market: 'index' },
  { symbol: '^N225', display: 'NIKKEI', name: 'Nikkei 225', market: 'index' },
  { symbol: '^HSI', display: 'HANG SENG', name: 'Hang Seng', market: 'index' },
];

async function fetchFinnhubQuotes(symbols: { symbol: string; display?: string; name: string; market: string }[]) {
  const results = await Promise.allSettled(
    symbols.map(async (s) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${s.symbol}&token=${FH_KEY}`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) throw new Error();
      const d = await r.json();
      return {
        symbol: s.symbol, display: s.display || s.symbol, name: s.name,
        price: d.c || 0,
        chg: d.dp || 0,
        chg7d: 0,
        vol: '-',
        mcap: '-',
        market: s.market,
      };
    })
  );
  return results
    .filter(r => r.status === 'fulfilled' && (r as any).value?.price > 0)
    .map(r => (r as any).value);
}

async function fetchTDQuotes(symbols: { symbol: string; display?: string; name: string; market: string }[]) {
  const syms = symbols.map(s => encodeURIComponent(s.symbol)).join(',');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  const r = await fetch(`https://api.twelvedata.com/price?symbol=${syms}&apikey=${TD_KEY}`, { signal: ctrl.signal });
  clearTimeout(t);
  if (!r.ok) throw new Error('TD failed');
  const d = await r.json();
  return symbols.map(s => {
    const pd = d[s.symbol] || d[s.symbol.replace('.IS','')];
    const price = parseFloat(pd?.price || '0');
    return { symbol: s.symbol, display: s.display || s.symbol, name: s.name, price, chg: 0, chg7d: 0, vol: '-', mcap: '-', market: s.market };
  }).filter(x => x.price > 0);
}

export async function GET(req: NextRequest) {
  const market = req.nextUrl.searchParams.get('market') || 'all';
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 100);

  const tasks: Promise<any[]>[] = [];

  if (market === 'crypto' || market === 'all') {
    tasks.push(fetchCryptoData(limit).catch(() => []));
  }
  if (market === 'us' || market === 'all') {
    tasks.push(fetchFinnhubQuotes(US_STOCKS).catch(() => []));
  }
  if (market === 'turkey' || market === 'all') {
    tasks.push(fetchTDQuotes(TURKEY_STOCKS).catch(() => fetchFinnhubQuotes(TURKEY_STOCKS.map(s => ({ ...s, symbol: s.symbol }))).catch(() => [])));
  }
  if (market === 'forex' || market === 'all') {
    tasks.push(fetchFinnhubQuotes(FOREX_PAIRS).catch(() => []));
  }
  if (market === 'precious' || market === 'all') {
    tasks.push(fetchFinnhubQuotes(PRECIOUS).catch(() => []));
  }
  if (market === 'energy' || market === 'all') {
    tasks.push(fetchFinnhubQuotes(ENERGY).catch(() => []));
  }
  if (market === 'index' || market === 'all') {
    tasks.push(fetchFinnhubQuotes(INDICES).catch(() => []));
  }

  const results = await Promise.all(tasks);
  const items = results.flat().filter(item => item && item.price > 0).slice(0, limit);

  return NextResponse.json({ market, count: items.length, items, timestamp: new Date().toISOString() });
}
