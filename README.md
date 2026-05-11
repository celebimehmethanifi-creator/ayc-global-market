# NEURA — AI Finans Asistanı

> Bağımsız, üretim hazır, çok katmanlı AI finans platformu.

## Mimari

```
Frontend (Next.js :3000)
        ↓
FastAPI Gateway (:8000)
        ↓
AI Orchestrator (:8001)
        ↓
LiteLLM → GPT-4o + Claude 3.5 + Gemini 1.5 + OpenRouter
        ↓
Finance API (CoinGecko / Finnhub / TwelveData / yfinance / Binance WS)
        ↓
Kalkan Risk Engine + Final Answer Engine
        ↓
Signal Service (:8002) + Data Service (:8003)
```

## Hızlı Başlangıç (Windows Native)

```powershell
# 1. Proje klasörüne git
cd C:\Users\mhani\OneDrive\Desktop\NEURA

# 2. Tek komutla başlat
.\start-native.ps1
```

## Servisler

| Servis | Port | Açıklama |
|---|---|---|
| Web UI | 3000 | Next.js 14 arayüzü |
| Gateway | 8000 | FastAPI REST API |
| AI Service | 8001 | LiteLLM Orchestrator |
| Signal Service | 8002 | Sinyal üretici + scorer |
| Data Service | 8003 | Binance WS + CoinGecko fetcher |

## Kategoriler

`turkey` `us` `crypto` `precious` `energy` `forex` `index` `etf`

## Veri Kaynakları

- **Crypto**: CoinGecko + Binance WebSocket (gerçek zamanlı)
- **Hisse**: Finnhub + TwelveData + yfinance
- **Forex/Emtia**: TwelveData + yfinance
- **Haber**: NewsAPI + Google RSS

## Güvenlik

`services/gateway/middleware/` → Auth + Rate Limit + Tier Gate
`services/ai-service/kalkan.py` → AI Risk Filtresi (Hard/Soft Block)

---
⚠️ Bu yazılım yatırım tavsiyesi vermez.