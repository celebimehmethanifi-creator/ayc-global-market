import { NextResponse } from 'next/server';

const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const FH_KEY = process.env.FINNHUB_API_KEY || '';

async function getMarketSnapshot() {
  if (!FH_KEY) return {};
  try {
    const makeReq = (url: string) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      return fetch(url, { signal: ctrl.signal })
        .then(r => r.json())
        .finally(() => clearTimeout(t));
    };

    const [btcRes, ethRes, goldRes] = await Promise.allSettled([
      makeReq(`https://finnhub.io/api/v1/quote?symbol=BINANCE:BTCUSDT&token=${FH_KEY}`),
      makeReq(`https://finnhub.io/api/v1/quote?symbol=BINANCE:ETHUSDT&token=${FH_KEY}`),
      makeReq(`https://finnhub.io/api/v1/quote?symbol=GC=F&token=${FH_KEY}`),
    ]);
    return {
      btc: btcRes.status === 'fulfilled' ? btcRes.value?.c : null,
      btcChg: btcRes.status === 'fulfilled' ? btcRes.value?.dp : null,
      eth: ethRes.status === 'fulfilled' ? ethRes.value?.c : null,
      ethChg: ethRes.status === 'fulfilled' ? ethRes.value?.dp : null,
      gold: goldRes.status === 'fulfilled' ? goldRes.value?.c : null,
      goldChg: goldRes.status === 'fulfilled' ? goldRes.value?.dp : null,
    };
  } catch { return {}; }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const snap = await getMarketSnapshot();
    const now = new Date();
    const hour = now.getUTCHours() + 3; // Turkey time
    const period = hour < 12 ? 'sabah' : hour < 17 ? 'ogleden sonra' : 'aksam';

    const btc = snap.btc as number | null;
    const btcChg = snap.btcChg as number | null;
    const eth = snap.eth as number | null;
    const ethChg = snap.ethChg as number | null;
    const gold = snap.gold as number | null;

    const marketInfo = btc
      ? `BTC: $${Number(btc).toLocaleString('en')} (${(btcChg ?? 0) > 0 ? '+' : ''}${Number(btcChg).toFixed(1)}%), ETH: $${Number(eth).toLocaleString('en')} (${(ethChg ?? 0) > 0 ? '+' : ''}${Number(ethChg).toFixed(1)}%), Altin: $${Number(gold).toLocaleString('en')}`
      : 'Piyasa verileri aliniyor';

    const prompt = `Sen AYC Global Market'in uzman AI analisti olarak calis. Bugun ${now.toLocaleDateString('tr-TR')} - ${period} saatleri.

Guncel piyasa durumu: ${marketInfo}

Kullanicilar icin 3-4 cumlelik, kisa ama etkili bir ${period} piyasa brifing yaz. Turkce olsun ama ASCII harflerle (no special chars). Gunun onemli noktalarini, dikkat edilmesi gereken riskleri ve firsat pencerelerini belirt. Samimi ve profesyonel ton.`;

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.6, max_tokens: 200 }),
      signal: ctrl.signal,
    });
    clearTimeout(t);

    if (!r.ok) throw new Error(`GPT ${r.status}`);
    const d = await r.json();
    const summary: string = d.choices?.[0]?.message?.content || 'Piyasalar analiz ediliyor...';

    return NextResponse.json({
      summary: summary.trim(),
      generated_at: now.toISOString(),
      model_used: 'GPT-4o-mini',
      market_data: snap,
    });
  } catch {
    const fallbacks = [
      'Global piyasalar karismik seyir izliyor. BTC kritik destek seviyelerini test ediyor, dolar endeksi baskili. Risk yonetimine onem verin.',
      'Kripto piyasalarda volatilite yukseliyor. Makro veriler yakinda aciklanacak, pozisyonlarinizi gozden gecirin.',
      'Piyasalarda temkinli bir seyir hakim. Major kripto varliklar konsolidasyon asamasinda, bekle-gozle stratejisi one cikiyor.',
    ];
    return NextResponse.json({
      summary: fallbacks[Math.floor(Date.now() / 3600000) % fallbacks.length],
      generated_at: new Date().toISOString(),
      model_used: 'fallback',
    });
  }
}
