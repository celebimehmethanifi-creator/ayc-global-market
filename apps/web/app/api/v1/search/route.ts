import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CG_KEY = process.env.COINGECKO_API_KEY || "";
const FH_KEY = process.env.FINNHUB_API_KEY || "";
const TD_KEY = process.env.TWELVEDATA_API_KEY || "";

interface SearchResult {
  symbol: string;
  name: string;
  type: "crypto" | "stock" | "etf" | "forex" | "index" | "commodity";
  price: number | null;
  change24h: number | null;
  marketCap: number | null;
  exchange: string;
  source: string;
}

async function safeFetch(url: string, opts: RequestInit = {}, ms = 6000): Promise<Response | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(t);
    return r;
  } catch { return null; }
}

/* ── CoinGecko search ──────────────────────────────────── */
async function searchCoinGecko(q: string): Promise<SearchResult[]> {
  try {
    const r = await safeFetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`,
      { headers: { "x-cg-demo-api-key": CG_KEY } }
    );
    if (!r?.ok) return [];
    const d = await r.json();
    const coins: any[] = d.coins?.slice(0, 8) ?? [];

    // Get prices for top coins
    const ids = coins.map((c: any) => c.id).join(",");
    let priceData: Record<string, any> = {};
    if (ids) {
      const pr = await safeFetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`,
        { headers: { "x-cg-demo-api-key": CG_KEY } }
      );
      if (pr?.ok) priceData = await pr.json();
    }

    return coins.filter((c: any) => priceData[c.id]?.usd > 0).map((c: any) => {
      const p = priceData[c.id];
      return {
        symbol: (c.symbol || "").toUpperCase(),
        name: c.name || c.symbol,
        type: "crypto" as const,
        price: p?.usd ?? null,
        change24h: p?.usd_24h_change ?? null,
        marketCap: p?.usd_market_cap ?? null,
        exchange: "Binance/CoinGecko",
        source: "coingecko",
      };
    });
  } catch { return []; }
}

/* ── Finnhub symbol search ─────────────────────────────── */
async function searchFinnhub(q: string): Promise<SearchResult[]> {
  if (!FH_KEY) return [];
  try {
    const r = await safeFetch(
      `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${FH_KEY}`
    );
    if (!r?.ok) return [];
    const d = await r.json();
    const items: any[] = d.result?.slice(0, 6) ?? [];
    const results: SearchResult[] = [];

    for (const item of items) {
      if (!item.symbol || item.symbol.includes(".")) continue;
      const type = item.type === "ETP" ? "etf"
                 : item.type === "Common Stock" ? "stock"
                 : "stock";
      // Fetch live quote
      let price: number | null = null;
      let change24h: number | null = null;
      try {
        const qr = await safeFetch(
          `https://finnhub.io/api/v1/quote?symbol=${item.symbol}&token=${FH_KEY}`,
          {}, 4000
        );
        if (qr?.ok) {
          const qd = await qr.json();
          if (qd.c > 0) {
            price = qd.c;
            change24h = qd.pc > 0 ? ((qd.c - qd.pc) / qd.pc) * 100 : 0;
          }
        }
      } catch {}
      results.push({
        symbol: item.symbol,
        name: item.description || item.symbol,
        type,
        price,
        change24h,
        marketCap: null,
        exchange: item.primaryExchange || "US",
        source: "finnhub",
      });
    }
    return results;
  } catch { return []; }
}

/* ── Twelve Data symbol search ──────────────────────────── */
async function searchTwelveData(q: string): Promise<SearchResult[]> {
  if (!TD_KEY) return [];
  try {
    const r = await safeFetch(
      `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(q)}&apikey=${TD_KEY}&outputsize=6`
    );
    if (!r?.ok) return [];
    const d = await r.json();
    const items: any[] = d.data?.slice(0, 6) ?? [];
    return items.map((item: any) => {
      const instType = (item.instrument_type || "").toLowerCase();
      const type: SearchResult["type"] =
        instType.includes("crypto") ? "crypto"
        : instType.includes("etf")  ? "etf"
        : instType.includes("index") || instType.includes("indice") ? "index"
        : instType.includes("forex") ? "forex"
        : "stock";
      return {
        symbol: item.symbol,
        name: item.instrument_name || item.symbol,
        type,
        price: null,
        change24h: null,
        marketCap: null,
        exchange: item.exchange || item.country || "",
        source: "twelvedata",
      };
    });
  } catch { return []; }
}

/* ── Deduplicate results by symbol ─────────────────────── */
function dedupe(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const r of results) {
    const key = r.symbol.toUpperCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(r);
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q || q.length < 1) {
    return NextResponse.json({ results: [], query: q, count: 0 }, { status: 400 });
  }

  // Run CoinGecko + TwelveData in parallel, Finnhub serially after (rate limit)
  const [cgResults, tdResults] = await Promise.all([
    searchCoinGecko(q),
    searchTwelveData(q),
  ]);

  // Only call Finnhub if we have few results so far
  let fhResults: SearchResult[] = [];
  if (cgResults.length < 3) {
    fhResults = await searchFinnhub(q);
  }

  const combined = dedupe([...cgResults, ...fhResults, ...tdResults]).slice(0, 10);

  return NextResponse.json(
    {
      results: combined,
      query: q,
      count: combined.length,
      updated_at: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}
