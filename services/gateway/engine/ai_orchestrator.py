from .config import API_KEYS

def ai_overlay(asset):
    available = {
        "openai": bool(API_KEYS.get("openai")),
        "gemini": bool(API_KEYS.get("gemini")),
        "claude": bool(API_KEYS.get("claude")),
    }
    enabled_count = sum(1 for v in available.values() if v)
    return {
        "aiAvailable": available,
        "aiConfidenceBoost": min(10, enabled_count * 3),
        "policy": "Maliyet kontrolü için toplu taramada LLM çağrısı kapalı; kritik analiz moduna bağlanabilir.",
    }
