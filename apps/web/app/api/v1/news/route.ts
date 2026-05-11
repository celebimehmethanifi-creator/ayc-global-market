import { NextRequest, NextResponse } from "next/server";

interface NewsItem { title: string; url: string; source: string; publishedAt: string; summary: string; sentiment: string; }

const FALLBACK_NEWS: NewsItem[] = [
  { title: "Bitcoin kurumsal alımlarla 85.000$ direncine yaklaşıyor", url: "#", source: "CoinDesk", publishedAt: new Date().toISOString(), summary: "Büyük kurumsal yatırımcıların BTC alımları hızlandı.", sentiment: "positive" },
  { title: "Fed faiz kararı piyasaları hareketlendirdi", url: "#", source: "Reuters", publishedAt: new Date().toISOString(), summary: "Federal Rezerv faizleri sabit tuttu, piyasalar pozitif tepki verdi.", sentiment: "neutral" },
  { title: "Altın tüm zamanların en yüksek seviyesine ulaştı", url: "#", source: "Bloomberg", publishedAt: new Date().toISOString(), summary: "Jeopolitik gerilimler altın fiyatını rekor seviyelere taşıdı.", sentiment: "positive" },
  { title: "NVIDIA AI chip satışları beklentileri aştı", url: "#", source: "CNBC", publishedAt: new Date().toISOString(), summary: "NVDA hisseleri güçlü kazanç raporunun ardından yükseldi.", sentiment: "positive" },
  { title: "BIST 100 günlük kapanışta artı bölgede", url: "#", source: "Borsa İstanbul", publishedAt: new Date().toISOString(), summary: "Türk borsası bankacılık sektörünün liderliğinde yükseldi.", sentiment: "positive" },
];

async function fetchGoogleNews(query: string): Promise<NewsItem[]> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query + " when:24h")}&hl=tr&gl=TR&ceid=TR:tr`;
    const r = await fetch(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined, headers: { "User-Agent": "Mozilla/5.0" } });
    const xml = await r.text();
    const items: NewsItem[] = [];
    const titleArr = Array.from(xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g)).slice(1);
    const linkArr = Array.from(xml.matchAll(/<link>(.*?)<\/link>/g)).slice(1);
    const dateArr = Array.from(xml.matchAll(/<pubDate>(.*?)<\/pubDate>/g)).slice(1);
    for (let i = 0; i < Math.min(titleArr.length, 8); i++) {
      items.push({
        title: titleArr[i]?.[1] || "",
        url: linkArr[i]?.[1] || "#",
        source: "Google News",
        publishedAt: dateArr[i]?.[1] ? new Date(dateArr[i][1]).toISOString() : new Date().toISOString(),
        summary: "",
        sentiment: "neutral",
      });
    }
    return items.filter(i => i.title);
  } catch { return []; }
}

const CACHE = new Map<string, { data: NewsItem[]; ts: number }>();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") || "finance market";
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20);
  const cacheKey = query;
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < 300000) {
    return NextResponse.json({ items: cached.data.slice(0, limit), source: "cache", count: cached.data.length });
  }
  const live = await fetchGoogleNews(query);
  const items = live.length > 0 ? live : FALLBACK_NEWS;
  CACHE.set(cacheKey, { data: items, ts: Date.now() });
  return NextResponse.json({ items: items.slice(0, limit), source: live.length > 0 ? "live" : "fallback", count: items.length });
}
