# NEURA - AI Finans Platformu

Cok katmanli piyasa verisi, sinyal ve AI destekli karar altyapisi.

## Mimari

```text
Frontend (Next.js :3000)
        ->
FastAPI Gateway (:8000)  [authoritative API]
        ->
AI Service (:8001) + Signal Service (:8002) + Data Service (:8003)
```

## API Sahipligi

- Gateway authoritative API'dir.
- Next API routes BFF/proxy amacli kullanilir.
- Detayli dokuman: [docs/API_STRATEGY.md](docs/API_STRATEGY.md)

## Hizli Baslangic (Windows)

```powershell
cd C:\Users\mhani\OneDrive\Desktop\NEURA
.\start-native.ps1
```

## Guvenlik Notlari

- Production ortaminda test/demo login kapali olmalidir.
- `JWT_SECRET`, `SECRET_KEY`, `EXCHANGE_CREDENTIALS_KEY` min 32 karakter olmali.
- Public olmus olabilecek tum anahtarlar rotate edilmelidir.
