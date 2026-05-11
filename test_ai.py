import asyncio, os, sys
sys.path.insert(0,'C:/Users/mhani/OneDrive/Desktop/NEURA/services/gateway')
from dotenv import load_dotenv
load_dotenv('C:/Users/mhani/OneDrive/Desktop/NEURA/services/gateway/.env')
key = os.environ.get('OPENAI_API_KEY','')
print("Key set:", bool(key), "prefix:", key[:15] if key else "NONE")
async def run():
    import aiohttp
    async with aiohttp.ClientSession() as s:
        async with s.post("https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json={"model":"gpt-4o","messages":[{"role":"user","content":"Say hello in 5 words"}],"max_tokens":20},
            timeout=aiohttp.ClientTimeout(total=25)
        ) as r:
            d = await r.json()
            if "error" in d: print("ERR:", d["error"])
            else: print("GPT:", d["choices"][0]["message"]["content"])
asyncio.run(run())