from .config import API_KEYS

def flow_overlay(asset):
    notes = []
    score = 50
    confidence = 20
    if API_KEYS.get("cryptoquant") and asset.get("assetClass") == "crypto":
        notes.append("CryptoQuant key mevcut; flow adapter alanı hazır.")
        confidence += 10
    if API_KEYS.get("santiment") and asset.get("assetClass") == "crypto":
        notes.append("Santiment key mevcut; on-chain/sentiment adapter alanı hazır.")
        confidence += 10
    if API_KEYS.get("dune"):
        notes.append("Dune key mevcut; query result adapter alanı hazır.")
        confidence += 10
    if not notes:
        notes.append("Flow API key yok veya varlık için aktif flow kaynağı yok; nötr fallback.")
    return {"flowScore": score, "flowConfidence": min(100, confidence), "notes": notes}
