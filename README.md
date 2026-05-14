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
- Production web deploy'da `NEXT_PUBLIC_API_URL` bos birakilmasi onerilir; auth/billing/exchange session endpointleri same-origin `/api/v1` kullanir.
- `apps/web/vercel.json` bilincli olarak kaldirildi. Production deploy, Vercel project settings + Vercel CLI ile yapilir; bu dosyayi geri eklemek eski deploy sorunlarini geri getirebilir.
- Refresh token rotation state su an in-memory tutulur. Cold-start/redeploy sonrasinda refresh session kaybi olabilir; production icin kalici store (Redis/DB/Edge) gerekir.
- Exchange credential onboarding production'da kapali kalmali; tekrar acilacaksa filesystem tabanli vault yerine kalici sifreli storage kullanilmali.
- Public olmus olabilecek tum anahtarlar rotate edilmelidir.

