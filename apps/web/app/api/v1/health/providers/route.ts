import { NextResponse } from "next/server";

type ProviderHealth = {
  key: string;
  label: string;
  configured: boolean;
  requiredInProduction: boolean;
  status: "ok" | "missing";
  lastSuccessfulFetchAt: null;
};

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const PROVIDERS: Array<{ key: string; label: string; requiredInProduction?: boolean }> = [
  { key: "COINGECKO_API_KEY", label: "CoinGecko" },
  { key: "FINNHUB_API_KEY", label: "Finnhub" },
  { key: "TWELVEDATA_API_KEY", label: "TwelveData" },
  { key: "ALPHAVANTAGE_API_KEY", label: "AlphaVantage" },
  { key: "OPENAI_API_KEY", label: "OpenAI" },
  { key: "ANTHROPIC_API_KEY", label: "Anthropic" },
  { key: "GEMINI_API_KEY", label: "Gemini" },
  { key: "DATABASE_URL", label: "Database", requiredInProduction: true },
  { key: "REDIS_URL", label: "Redis", requiredInProduction: true },
  { key: "JWT_SECRET", label: "Web JWT Secret", requiredInProduction: true },
  { key: "SECRET_KEY", label: "Gateway Secret Key", requiredInProduction: true },
  { key: "EXCHANGE_CREDENTIALS_KEY", label: "Exchange Credentials Key", requiredInProduction: true },
  { key: "CORS_ORIGINS", label: "CORS Origins", requiredInProduction: true },
];

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const providers: ProviderHealth[] = PROVIDERS.map((provider) => {
    const configured = Boolean((process.env[provider.key] || "").trim());
    const requiredInProduction = Boolean(provider.requiredInProduction);
    return {
      key: provider.key,
      label: provider.label,
      configured,
      requiredInProduction,
      status: configured ? "ok" : "missing",
      lastSuccessfulFetchAt: null,
    };
  });

  const missingRequired = providers
    .filter((item) => IS_PRODUCTION && item.requiredInProduction && !item.configured)
    .map((item) => item.key);

  return NextResponse.json(
    {
      ok: missingRequired.length === 0,
      environment: process.env.NODE_ENV || "development",
      providers,
      missingRequired,
      generatedAt: new Date().toISOString(),
      note:
        "Missing provider keys do not crash build by default; runtime falls back to available sources where possible.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

