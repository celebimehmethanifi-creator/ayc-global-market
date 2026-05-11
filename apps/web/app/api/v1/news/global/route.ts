import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NEWSAPI_KEY = process.env.NEWSAPI_KEY || "c8c10ec84736411da833d7ee21bfadd4";

async function fetchNewsAPI(query: string, pageSize: number = 5) {
  try {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&pageSize=${pageSize}&sortBy=publishedAt&language=en&apiKey=${NEWSAPI_KEY}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { signal: ctrl.signal } as RequestInit);
    clearTimeout(t);
    if (!r.ok) return [];
    const data = await r.json();
    return (data.articles || []).map((a: any) => ({
      title: a.title,
      summary: a.description || "",
      url: a.url,
      source: a.source?.name || "NewsAPI",
      publishedAt: a.publishedAt,
      sentiment: "neutral",
      category: query,
    }));
  } catch { return []; }
}

async function fetchGoogleRSS(feedUrl: string, category: string, limit: number = 5) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(feedUrl, { signal: ctrl.signal } as RequestInit);
    clearTimeout(t);
    if (!r.ok) return [];
    const text = await r.text();
    const items = text.match(/<item>([\s\S]*?)<\/item>/g) || [];
    return items.slice(0, limit).map(item => {
      const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
                    item.match(/<title>(.*?)<\/title>/)?.[1] || "";
      const link = item.match(/<link>(.*?)<\/link>/)?.[1] || "";
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || new Date().toISOString();
      const source = item.match(/<source[^>]*>(.*?)<\/source>/)?.[1] || "Google News";
      return { title, summary: "", url: link, source, publishedAt: new Date(pubDate).toISOString(), sentiment: "neutral", category };
    }).filter(i => i.title);
  } catch { return []; }
}

const FALLBACK_NEWS = {
  crypto: [
    { title: "Bitcoin güçlü momentum ile kritik direnç seviyesine yaklaşıyor", summary: "BTC, teknik göstergelerin güçlü sinyal verdiği eşiğe dayandı.", url: "https://coindesk.com", source: "CoinDesk", publishedAt: new Date().toISOString(), sentiment: "positive", category: "crypto" },
    { title: "Ethereum yükseltmesi sonrası işlem hacmi rekor kırdı", summary: "ETH ekosisteminde L2 gelişmeleri ivme kazanıyor.", url: "https://cointelegraph.com", source: "CoinTelegraph", publishedAt: new Date().toISOString(), sentiment: "positive", category: "crypto" },
    { title: "Kripto piyasaları küresel makro verilere duyarlılık artıyor", summary: "Fed faiz kararları ve enflasyon verileri piyasaları etkiliyor.", url: "https://decrypt.co", source: "Decrypt", publishedAt: new Date().toISOString(), sentiment: "neutral", category: "crypto" },
  ],
  bist: [
    { title: "BIST 100 güçlü destek bölgesinden sıçrama yaptı", summary: "Türk hisse senetleri yabancı yatırımcı ilgisiyle yükseldi.", url: "https://borsa.doviz.com", source: "Borsa Doviz", publishedAt: new Date().toISOString(), sentiment: "positive", category: "bist" },
    { title: "THYAO güçlü yaz sezonu beklentisiyle öne çıktı", summary: "Türk Hava Yolları turizm rakamları beklentileri aştı.", url: "https://investing.com/tr", source: "Investing TR", publishedAt: new Date().toISOString(), sentiment: "positive", category: "bist" },
    { title: "TCMB faiz kararı piyasalar tarafından olumlu karşılandı", summary: "Merkez Bankası kararı öncesi TL pozitif ayrışıyor.", url: "https://haberturk.com/ekonomi", source: "Haberturk Ekonomi", publishedAt: new Date().toISOString(), sentiment: "positive", category: "bist" },
  ],
  global: [
    { title: "Fed faiz kararı öncesi küresel piyasalar temkinli", summary: "ABD Merkez Bankası'nın toplantısı yatırımcıların radarında.", url: "https://bloomberg.com", source: "Bloomberg", publishedAt: new Date().toISOString(), sentiment: "neutral", category: "global" },
    { title: "NVIDIA AI çip gelir tahminlerini yukarı revize etti", summary: "Data center büyümesi tüm beklentileri aştı.", url: "https://reuters.com", source: "Reuters", publishedAt: new Date().toISOString(), sentiment: "positive", category: "global" },
    { title: "Altın jeopolitik risklerle güvenli liman talebini koruyor", summary: "XAU/USD kritik seviyeleri test ediyor.", url: "https://wsj.com", source: "WSJ", publishedAt: new Date().toISOString(), sentiment: "neutral", category: "global" },
  ],
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || "all";
  const limit = Math.min(parseInt(searchParams.get("limit") || "6"), 15);

  let items: any[] = [];

  try {
    if (category === "crypto" || category === "all") {
      const [newsItems, rssItems] = await Promise.allSettled([
        fetchNewsAPI("bitcoin OR ethereum OR crypto OR cryptocurrency", 4),
        fetchGoogleRSS("https://www.coindesk.com/arc/outboundfeeds/rss/", "crypto", 3),
      ]);
      const ns = newsItems.status === "fulfilled" ? newsItems.value : [];
      const rs = rssItems.status === "fulfilled" ? rssItems.value : [];
      if (ns.length + rs.length === 0) items.push(...FALLBACK_NEWS.crypto);
      else items.push(...ns.slice(0, 3), ...rs.slice(0, 2));
    }

    if (category === "bist" || category === "all") {
      const rss = await fetchGoogleRSS(
        "https://news.google.com/rss/search?q=BIST+OR+borsa+istanbul+OR+THYAO+OR+GARAN+when:24h&hl=tr&gl=TR&ceid=TR:tr",
        "bist", 4
      );
      if (rss.length === 0) items.push(...FALLBACK_NEWS.bist);
      else items.push(...rss);
    }

    if (category === "global" || category === "all") {
      const [newsItems, rssItems] = await Promise.allSettled([
        fetchNewsAPI("stock market OR fed OR inflation OR gold OR oil", 4),
        fetchGoogleRSS("https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en", "global", 3),
      ]);
      const ns = newsItems.status === "fulfilled" ? newsItems.value : [];
      const rs = rssItems.status === "fulfilled" ? rssItems.value : [];
      if (ns.length + rs.length === 0) items.push(...FALLBACK_NEWS.global);
      else items.push(...ns.slice(0, 3), ...rs.slice(0, 2));
    }

    // Deduplicate by title
    const seen = new Set<string>();
    items = items.filter(item => {
      const key = item.title.substring(0, 50).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json({
      items: items.slice(0, limit),
      count: items.length,
      category,
      updated_at: new Date().toISOString(),
      source: "ayc-news-engine-v1",
    });
  } catch {
    const fallback = [...FALLBACK_NEWS.crypto, ...FALLBACK_NEWS.bist, ...FALLBACK_NEWS.global];
    return NextResponse.json({
      items: fallback.slice(0, limit),
      count: fallback.length,
      category,
      updated_at: new Date().toISOString(),
      source: "fallback",
    });
  }
}
