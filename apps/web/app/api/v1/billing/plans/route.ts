import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const plans = [
    {
      id: "free",
      name: "Ücretsiz",
      price: 0,
      currency: "TRY",
      period: "month",
      features: [
        "10 sinyal/gün",
        "Temel piyasa verileri",
        "3 varlık takibi",
        "Günlük haber özeti",
      ],
      limits: { signals_per_day: 10, watchlist: 3, ai_queries: 0 },
      popular: false,
      cta: "Mevcut Plan",
    },
    {
      id: "pro",
      name: "Pro",
      price: 299,
      currency: "TRY",
      period: "month",
      features: [
        "Sınırsız sinyal",
        "Gerçek zamanlı fiyatlar",
        "50 varlık takibi",
        "AI Copilot (günlük 20 sorgu)",
        "Gelişmiş grafik & analiz",
        "Anlık alarm bildirimleri",
        "Portföy takibi",
      ],
      limits: { signals_per_day: -1, watchlist: 50, ai_queries: 20 },
      popular: true,
      cta: "Pro'ya Geç",
      lemon_variant_id: process.env.LEMON_PRO_VARIANT_ID || null,
    },
    {
      id: "elite",
      name: "Elite",
      price: 799,
      currency: "TRY",
      period: "month",
      features: [
        "Pro'nun tüm özellikleri",
        "Sınırsız AI Copilot",
        "On-chain veri erişimi",
        "Özel risk analizi",
        "Kurumsal kalitede raporlar",
        "API erişimi",
        "Öncelikli destek",
        "Erken erişim özellikleri",
      ],
      limits: { signals_per_day: -1, watchlist: -1, ai_queries: -1 },
      popular: false,
      cta: "Elite'e Geç",
      lemon_variant_id: process.env.LEMON_ELITE_VARIANT_ID || null,
    },
  ];

  return NextResponse.json({ plans, currency: "TRY", updated_at: new Date().toISOString() });
}
