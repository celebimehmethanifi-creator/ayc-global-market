"""
AYC Global Market - Contrarian AI (Seytan Avukati)
Konsensus kararinin tam tersini savunur. Kör noktalari, riskleri ve
gizli tehlikeleri ortaya cikarir. Kullaniciya "ne yanlis gidebilir?" sorusunu yanıtlar.
"""
from __future__ import annotations
import os, json
from pathlib import Path

_ENV_LOADED = False
def _load_env():
    global _ENV_LOADED
    if _ENV_LOADED: return
    env = Path(__file__).parent / ".env"
    if env.exists():
        from dotenv import load_dotenv; load_dotenv(env)
    _ENV_LOADED = True


CONTRARIAN_PROMPT = """Sen finansal analizde "seytanin avukati" rolunü uslenen bir uzmansin.
Konsensusun TERSINI savun. Potansiyel riskleri, bor noktalari ve gizli tehlikeleri listele.

GOREV:
1. Konsensus kararina kars arguman uret (3-4 guclu nokta)
2. En buyuk risk faktorlerini sirasindaki listele
3. Hangi senaryoda konsensus yanlis cikabilir?
4. Kontr-senaryo: ters yon icin ne zaman dusunulmeli?

KURAL:
- Net, ozgun ve analitik ol
- Spekuasyon degil, mantiksal gerekceler ver
- Kisa tut (her madde max 1 cumle)

JSON FORMATI:
{
  "counter_direction": "SHORT veya LONG (konsensusun tersi)",
  "arguments": ["arguman1", "arguman2", "arguman3"],
  "biggest_risk": "en kritik tek risk",
  "failure_scenario": "konsensus ne zaman yanlis cikar?",
  "counter_signal_trigger": "hangi kosulda ters pozisyon dusunulmeli?",
  "devil_confidence": 0-100
}"""


async def get_contrarian_view(
    symbol: str,
    consensus_direction: str,
    confidence: float,
    price: float,
    reasoning: str,
    market: str = "crypto"
) -> dict:
    _load_env()
    prompt = f"""Varlik: {symbol} | Market: {market}
Konsensus: {consensus_direction} | Guven: {confidence:.0f}/100
Mevcut Fiyat: {price}
Konsensus Gerekce: {reasoning}

Bu konsensus kararina karsi en guclu argumanlari uret. JSON formatinda yanitla."""

    # GPT-4o mini ile (ekonomik secenek - contrarian hizli olmali)
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return _mock_contrarian(consensus_direction)

    try:
        import aiohttp
        async with aiohttp.ClientSession() as s:
            async with s.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": "gpt-4o-mini",
                      "messages": [{"role":"system","content":CONTRARIAN_PROMPT},
                                   {"role":"user","content":prompt}],
                      "max_tokens": 400, "temperature": 0.4,
                      "response_format": {"type": "json_object"}},
                timeout=aiohttp.ClientTimeout(total=15)
            ) as r:
                d = await r.json()
                text = d["choices"][0]["message"]["content"]
                result = json.loads(text)
                result["source"] = "gpt-4o-mini"
                return result
    except Exception as e:
        return {**_mock_contrarian(consensus_direction), "error": str(e)}


def _mock_contrarian(direction: str) -> dict:
    opp = "SHORT" if direction == "LONG" else "LONG"
    return {
        "counter_direction": opp,
        "arguments": [
            "Mevcut trend tersine donebilir - momentum zayifliyor.",
            "Makroekonomik riskler fiyatlanmamis olabilir.",
            "Hacim onaysiz firlamalar genellikle sahte kirilmaladir."
        ],
        "biggest_risk": "Beklenmedik haber akisi veya whale satis baskisi.",
        "failure_scenario": "Piyasa genelinde satis dalgasi ve korelasyon artisi.",
        "counter_signal_trigger": f"Fiyat kritik destegi (stop seviyesini) kirdiginda {opp} degerlendirilebilir.",
        "devil_confidence": 45,
        "source": "mock"
    }