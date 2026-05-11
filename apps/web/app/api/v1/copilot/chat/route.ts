import { NextRequest, NextResponse } from 'next/server';

export const dynamic = "force-dynamic";
export const revalidate = 0;

const OPENAI_KEY    = process.env.OPENAI_API_KEY || "";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const GEMINI_KEY    = process.env.GEMINI_API_KEY || "";

type Tier = 'guest' | 'free' | 'pro' | 'premium' | 'elite';

interface TierConfig {
  maxTokens: number;
  model: string;
  useMultiAI: boolean;
  canTrade: boolean;
  dailyMessages: number;
}

const TIER_LIMITS: Record<string, TierConfig> = {
  guest:   { maxTokens: 200,  model: 'gpt-4o-mini', useMultiAI: false, canTrade: false, dailyMessages: 5 },
  free:    { maxTokens: 400,  model: 'gpt-4o-mini', useMultiAI: false, canTrade: false, dailyMessages: 20 },
  pro:     { maxTokens: 800,  model: 'gpt-4o',      useMultiAI: false, canTrade: true,  dailyMessages: 100 },
  premium: { maxTokens: 1500, model: 'gpt-4o',      useMultiAI: true,  canTrade: true,  dailyMessages: -1 },
  elite:   { maxTokens: 1500, model: 'gpt-4o',      useMultiAI: true,  canTrade: true,  dailyMessages: -1 },
};

const SYSTEM_PROMPT = `Sen AYC Global Market'in AI yatirim copilot'usin. Finansal piyasalarda uzman bir rehbersin.

TEMEL KURALLAR:
- Kesinlikle kazandirmayi vaat etme. Riskten bahset.
- Teknik analiz, fundamental analiz ve makro ekonomiyi birlestir.
- Psikolojik kalkan aktif: FOMO, panik, intikam islemi tespitinde uyar.
- Turkce yaz. ASCII harfleri kullan (g,s,i,u,o,c).
- Kisa, net, actionable cevaplar ver.
- Her cevabin sonuna uyari ekle: Bu yatirim tavsiyesi degildir.`;

interface EmotionResult {
  dominant: string;
  kalkan_warning: string;
}

function detectEmotion(msg: string): EmotionResult {
  const m = msg.toLowerCase();
  if (/fomo|kaciriyorum|uziyor|herkes.*aliyor|hizla yukseliyor.*al|atlayalim|son tren|firsat kacti/.test(m))
    return { dominant: 'fomo', kalkan_warning: 'FOMO algilandi. Bu his sizi yanlis zamanda piyasaya cekmek icin en tehlikeli his. Birkac dakika bekleyin.' };
  if (/panik|korktum|hepsini sat|hemen sat|batiyorum|mahvoldum|ne yapacam|zarar/.test(m))
    return { dominant: 'panic', kalkan_warning: 'Panik kararlar kalici zarara yol acar. Derin nefes alin, pozisyonunuzu degerlendirin.' };
  if (/zarar ettim.*al|batirdim.*cikmasin|intikam|kayip.*kapamak|kaybimi geri al/.test(m))
    return { dominant: 'revenge', kalkan_warning: 'KALKAN: Intikam islemi tespiti. Kaybinizi hemen geri almaya calismayin — bu en tehlikeli psikoloji.' };
  if (/kaldırac|leverage|10x|20x|100x|tum param|hepsini koy|yuksek lot/.test(m))
    return { dominant: 'overrisk', kalkan_warning: 'Asiri risk sinyali. Toplam sermayenizin %2-5inden fazlasini tek islemde riske atmayin.' };
  return { dominant: 'neutral', kalkan_warning: '' };
}

interface TradeIntent {
  wantsTrade: boolean;
  symbols: string[];
  side: 'buy' | 'sell' | null;
  amount: number | null;
}

function detectTradeIntent(msg: string): TradeIntent {
  const m = msg.toLowerCase();
  const wantsTrade = /\b(al|sat|islem yap|trade yap|benim icin|adima|satin al|satisi yap|buy|sell)\b/.test(m) &&
    /\b(\d+|\btumunu\b|\bhepsini\b|miktar|dolar|usd|\$|btc|eth|sol|bnb)\b/.test(m);
  const symbolPatterns = ['btc', 'eth', 'sol', 'bnb', 'xrp', 'doge', 'ada', 'avax', 'link', 'ondo', 'pepe', 'shib', 'aapl', 'tsla', 'nvda'];
  const symbols = symbolPatterns.filter(s => m.includes(s)).map(s => s.toUpperCase());
  const side: 'buy' | 'sell' | null = m.includes('sat') || m.includes('sell') ? 'sell'
    : m.includes('al') || m.includes('buy') ? 'buy'
    : null;
  const amtMatch = m.match(/\$?([\d,]+)\s*(dolar|usd|usdt|\$)?/);
  const amount = amtMatch ? parseFloat(amtMatch[1].replace(',', '')) : null;
  return { wantsTrade, symbols, side, amount };
}

async function callGPT(messages: Array<{ role: string; content: string }>, maxTokens: number, model = 'gpt-4o-mini'): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model, messages, temperature: 0.5, max_tokens: maxTokens }),
    signal: ctrl.signal,
  });
  clearTimeout(t);
  if (!r.ok) throw new Error(`GPT error ${r.status}`);
  const d = await r.json();
  return (d.choices?.[0]?.message?.content as string) || '';
}

async function callClaude(systemPrompt: string, userMessage: string, maxTokens: number): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
    signal: ctrl.signal,
  });
  clearTimeout(t);
  if (!r.ok) throw new Error(`Claude ${r.status}`);
  const d = await r.json();
  return (d.content?.[0]?.text as string) || '';
}

async function callGemini(prompt: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\nKullanici: ${prompt}` }] }],
        generationConfig: { maxOutputTokens: 600, temperature: 0.7 },
      }),
      signal: ctrl.signal,
    }
  );
  clearTimeout(t);
  if (!r.ok) throw new Error(`Gemini ${r.status}`);
  const d = await r.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function syntheticResponse(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('btc') || m.includes('bitcoin')) {
    return `**Bitcoin (BTC) Analizi**\n\nBitcoin, kripto para piyasasinin lider varligi olarak kuresel makro kosullardan onemli olcude etkilenmektedir.\n\n**Teknik Gorunum:**\n- Fiyat kritik destek/direnc bolgelerini test ediyor\n- RSI gostergesi mevcut momentum hakkinda ipuclari veriyor\n- Hacim analizi trend gucunu teyit etmeli\n\n**Risk Faktorleri:**\n- Yuksek volatilite her zaman mevcut\n- Duzenleyici haberler ani hareketler yaratabilir\n- Makro ekonomik kosullar (Fed kararlari, dolar endeksi) kritik\n\n⚠️ Bu yatirim tavsiyesi degildir. Kendi arastirmanizi yapin.`;
  }
  if (m.includes('altin') || m.includes('gold') || m.includes('xau')) {
    return `**Altin (XAU/USD) Analizi**\n\nAltin, jeopolitik belirsizlik ve enflasyon endiselerinin yuksek oldugu donemlerde guvenli liman olarak one cikmaktadir.\n\n**Temel Gorunum:**\n- Fed faiz kararlari altini dogrudan etkiliyor\n- Dolar endeksi (DXY) ile ters korelasyon guclu\n- Merkez bankasi alimlari talep tarafini destekliyor\n\n⚠️ Bu yatirim tavsiyesi degildir. Portfoy cesitlendirmesi icin bir uzmana danisin.`;
  }
  if (m.includes('bist') || m.includes('thyao') || m.includes('turk') || m.includes('borsa')) {
    return `**BIST / Turk Hisse Senetleri Analizi**\n\nTurk borsasi, enflasyon dinamikleri, TCMB kararlari ve kuresel risk istahından etkilenmektedir.\n\n**Makro Faktorler:**\n- TCMB faiz politikasi kritik belirleyici\n- Enflasyon verileri sirket karliligini etkiliyor\n- Yabanci yatirimci akislari izlenmeli\n\n⚠️ Bu yatirim tavsiyesi degildir. BIST yatirimlarinda vergi ve duzenleyici konulara dikkat edin.`;
  }
  return `**AYC Global Market AI Copilot**\n\nPiyasa degerlendirilmesi:\n- Kuresel piyasalar makro ekonomik gelismelere duyarliligini korumaktadir\n- Teknik analiz ve temel analizi birlestiren yaklasim en saglikli sonuclari verir\n- Risk yonetimi her yatirim stratejisinin temel unsurudur\n\n**Dikkat edilmesi gereken faktorler:**\n1. Merkez bankasi kararlari ve faiz politikalari\n2. Jeopolitik gelismeler\n3. Sirket/sektor bazli haberler\n4. Teknik destek/direnc seviyeleri\n\nDaha spesifik bir varlik veya piyasa hakkinda analiz yapmami ister misiniz?\n\n⚠️ Bu yatirim tavsiyesi degildir. Lisansli bir finansal danismana basvurun.`;
}

async function getSymbolPrice(symbol: string): Promise<{ price: number; chg: number }> {
  try {
    const sym = symbol.endsWith('USDT') ? symbol : symbol + 'USDT';
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error('Binance failed');
    const d = await r.json();
    return { price: parseFloat(d.lastPrice), chg: parseFloat(d.priceChangePercent) };
  } catch {
    return { price: 0, chg: 0 };
  }
}

interface AnalysisResult {
  approved: boolean;
  reason: string;
  riskScore: number;
  targetPrice: number;
  stopLoss: number;
  summary: string;
}

async function deepAnalysis(symbol: string, side: 'buy' | 'sell', amount: number): Promise<AnalysisResult> {
  const { price, chg } = await getSymbolPrice(symbol);
  if (price === 0) return { approved: false, reason: 'Fiyat verisi alinamadi', riskScore: 100, targetPrice: 0, stopLoss: 0, summary: 'Veri hatasi' };

  const prompt = `Analyze ${symbol} for ${side} order. Current price: $${price}, 24h change: ${chg > 0 ? '+' : ''}${chg.toFixed(2)}%, Amount: $${amount}

Respond ONLY with JSON:
{
  "approved": true or false,
  "riskScore": 0-100,
  "reason": "1-2 sentence explanation",
  "targetPrice": number,
  "stopLoss": number,
  "summary": "3-4 sentence analysis"
}`;

  try {
    const messages = [{ role: 'user', content: prompt }];
    const gptText = await callGPT(messages, 300, 'gpt-4o-mini').catch(() => '');
    const parseJSON = (txt: string) => {
      try { return JSON.parse(txt.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()); } catch { return null; }
    };
    const parsed = parseJSON(gptText);
    if (parsed) {
      return {
        approved: parsed.approved && (parsed.riskScore || 50) < 70,
        riskScore: parsed.riskScore || 50,
        reason: parsed.reason || '',
        targetPrice: parsed.targetPrice || price * 1.05,
        stopLoss: parsed.stopLoss || price * 0.97,
        summary: parsed.summary || '',
      };
    }
  } catch {}

  return {
    approved: false,
    reason: 'AI analiz hatasi',
    riskScore: 80,
    targetPrice: price * (side === 'buy' ? 1.05 : 0.95),
    stopLoss: price * (side === 'buy' ? 0.97 : 1.03),
    summary: 'Analiz tamamlanamadi',
  };
}

interface ExchangeCredentials {
  exchange: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
}

interface ChatHistoryItem {
  role: string;
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      message?: unknown;
      chat_history?: ChatHistoryItem[];
      history?: ChatHistoryItem[];
      tier?: string;
      userPlan?: string;
      exchange_credentials?: ExchangeCredentials;
    };

    const { message, exchange_credentials } = body;
    const chat_history = body.chat_history || body.history || [];
    const rawTier = body.tier || body.userPlan || 'free';

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Mesaj gerekli', reply: 'Mesaj bos olamaz.', response: 'Mesaj bos olamaz.' }, { status: 400 });
    }

    // Normalize tier
    const tierMap: Record<string, string> = { elite: 'elite', pro: 'pro', premium: 'premium', free: 'free', guest: 'guest' };
    const tier = tierMap[rawTier.toLowerCase()] || 'free';
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;

    const emotion = detectEmotion(message);
    const tradeIntent = detectTradeIntent(message);

    // --- TRADE EXECUTION PATH ---
    if (tradeIntent.wantsTrade && limits.canTrade && exchange_credentials) {
      if (tradeIntent.symbols.length === 0 || !tradeIntent.side || !tradeIntent.amount) {
        const txt = 'Islem yapmak icin lutfen sembol (BTC, ETH vb.), yon (al/sat) ve miktar (USD) belirtin. Ornek: "BTC icin 100 dolar al"';
        return NextResponse.json({ reply: txt, response: txt, model_used: 'system', emotion, trade_status: 'incomplete_request' });
      }
      const symbol = tradeIntent.symbols[0];
      const amount = tradeIntent.amount;
      const analysis = await deepAnalysis(symbol, tradeIntent.side, amount);
      if (!analysis.approved) {
        const txt = `KALKAN ISLEMI ENGELLEDI\n\nDerin analiz sonucu: Risk skoru ${analysis.riskScore}/100\n\n${analysis.reason}\n\n${analysis.summary}\n\nBu islem su an yuksek risk tasimaktadir.`;
        return NextResponse.json({ reply: txt, response: txt, model_used: 'kalkan', emotion, trade_status: 'blocked', analysis });
      }
      try {
        const origin = req.nextUrl.origin;
        const orderRes = await fetch(`${origin}/api/v1/exchange/order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exchange: exchange_credentials.exchange,
            apiKey: exchange_credentials.apiKey,
            apiSecret: exchange_credentials.apiSecret,
            passphrase: exchange_credentials.passphrase,
            symbol: symbol + 'USDT',
            side: tradeIntent.side,
            quoteAmount: amount,
          }),
        });
        const orderData = await orderRes.json() as { ok?: boolean; orderId?: string; status?: string; error?: string };
        const txt = orderData.ok
          ? `ISLEM GERCEKLESTI\n\n${symbol} icin $${amount} ${tradeIntent.side === 'buy' ? 'ALIS' : 'SATIS'} islemi gonderildi.\nEmir ID: ${orderData.orderId}\n\nRisk: ${analysis.riskScore}/100\nHedef: $${analysis.targetPrice.toFixed(4)}\nStop: $${analysis.stopLoss.toFixed(4)}\n\n${analysis.summary}`
          : `Islem analizi tamamlandi ancak emir gonderilemedi: ${orderData.error}\n\n${analysis.summary}`;
        return NextResponse.json({ reply: txt, response: txt, model_used: 'copilot+kalkan', emotion, trade_status: orderData.ok ? 'executed' : 'failed', analysis });
      } catch (orderErr) {
        const err = orderErr as Error;
        const txt = `Analiz tamamlandi ancak borsa baglantisi kurulamadi: ${err.message}`;
        return NextResponse.json({ reply: txt, response: txt, model_used: 'copilot', emotion, trade_status: 'error' });
      }
    }

    // --- ANALYSIS-ONLY TRADE REQUEST ---
    if (tradeIntent.wantsTrade && !exchange_credentials) {
      const tradeSymbol = tradeIntent.symbols[0];
      if (tradeSymbol) {
        const analysis = await deepAnalysis(tradeSymbol, tradeIntent.side || 'buy', tradeIntent.amount || 100).catch(() => null);
        const analysisText = analysis
          ? `\n\nDerin Analiz:\n- Risk Skoru: ${analysis.riskScore}/100\n- Durum: ${analysis.reason}\n- ${analysis.summary}`
          : '';
        const txt = `${tradeSymbol} icin islem analizi yapildi.${analysisText}\n\nOtomatik islem icin lutfen /brokers sayfasindan borsanizi baglayin.`;
        return NextResponse.json({ reply: txt, response: txt, model_used: 'copilot', emotion, trade_status: 'no_exchange', analysis });
      }
    }

    // --- NORMAL CHAT PATH ---
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...chat_history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    let reply = '';
    let model_used = '';

    if (tier === 'elite' || tier === 'premium') {
      // Elite/Premium: GPT-4o + Claude consensus
      try {
        const [gptRes, claudeRes] = await Promise.allSettled([
          callGPT(messages, limits.maxTokens, 'gpt-4o'),
          callClaude(SYSTEM_PROMPT, message, Math.floor(limits.maxTokens / 2)),
        ]);
        const gptText = gptRes.status === 'fulfilled' ? gptRes.value : '';
        const claudeText = claudeRes.status === 'fulfilled' ? claudeRes.value : '';
        if (gptText && claudeText) {
          const consensusMsg = [{ role: 'user', content: `GPT analizi:\n${gptText}\n\nClaude analizi:\n${claudeText}\n\nBu iki analize dayanarak ozlu bir konsensus ozeti yaz (Turkce, ASCII).` }];
          const consensus = await callGPT(consensusMsg, 400, 'gpt-4o-mini').catch(() => gptText);
          reply = `[GPT-4o + Claude Konsensus]\n\n${consensus}`;
          model_used = 'GPT-4o+Claude';
        } else if (gptText) {
          reply = gptText; model_used = 'gpt-4o';
        } else if (claudeText) {
          reply = claudeText; model_used = 'claude-3-haiku';
        }
      } catch {}
      if (!reply) {
        try { reply = await callGemini(message); model_used = 'gemini-1.5-flash'; } catch {}
      }
    } else if (tier === 'pro') {
      // Pro: GPT-4o first
      try { reply = await callGPT(messages, limits.maxTokens, 'gpt-4o'); model_used = 'gpt-4o'; } catch {}
      if (!reply) {
        try { reply = await callGemini(message); model_used = 'gemini-1.5-flash'; } catch {}
      }
    } else {
      // Free/Guest: Gemini first (cheapest), then GPT-4o-mini
      try { reply = await callGemini(message); model_used = 'gemini-1.5-flash'; } catch {}
      if (!reply) {
        try { reply = await callGPT(messages, limits.maxTokens, 'gpt-4o-mini'); model_used = 'gpt-4o-mini'; } catch {}
      }
    }

    // Synthetic fallback — always responds
    if (!reply) {
      reply = syntheticResponse(message);
      model_used = 'synthetic';
    }

    // Tier upsell for guest/free
    if ((tier === 'guest' || tier === 'free') && reply && model_used !== 'synthetic') {
      if (tier === 'guest') reply += '\n\n[Daha derin analiz icin Pro/Premium plana gecin]';
    }

    return NextResponse.json({
      reply: reply.trim(),
      response: reply.trim(),
      model_used,
      emotion,
      tier,
      timestamp: new Date().toISOString(),
      features_used: limits,
    });
  } catch (e) {
    const err = e as Error;
    const fallbackReply = syntheticResponse('genel piyasa analizi');
    return NextResponse.json({
      reply: fallbackReply,
      response: fallbackReply,
      model_used: 'synthetic',
      emotion: { dominant: 'neutral', kalkan_warning: '' },
      error: err.message || 'Bilinmeyen hata',
      timestamp: new Date().toISOString(),
    }, { status: 200 });
  }
}
