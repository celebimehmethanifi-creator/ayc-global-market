# AYC Global Market - Yayina Alma Rehberi

## 1. Frontend (Vercel)
1. Vercel'de projeyi import et.
2. Root Directory olarak `apps/web` sec.
3. Framework `Next.js` olmali.
4. Asagidaki env degiskenlerini gir:
5. apps/web/vercel.json kullanilmiyor; bu dosya deployment sorunlari nedeniyle bilincli olarak kaldirildi.
6. Production deploy, Vercel project-level ayarlar + Vercel CLI akisi ile yapilmalidir.
7. Git-triggered deploy su an guvenilir degilse production yayininda Verdent/Vercel CLI akisini kullan.

```env
NEXT_PUBLIC_API_URL=<optional-public-api-url-or-empty>
NEXT_PUBLIC_SITE_URL=<https://app.example.com>
JWT_SECRET=<minimum-32-char-secret>
EXCHANGE_CREDENTIALS_KEY=<minimum-32-char-secret>
LEMON_API_KEY=<provider-key>
LEMON_STORE_ID=<provider-store-id>
LEMON_PRO_VARIANT_ID=<provider-variant-id>
LEMON_ELITE_VARIANT_ID=<provider-variant-id>
```

## 2. Backend (Railway veya benzeri)
1. `services/gateway` servis olarak deploy et.
2. PostgreSQL ve Redis baglantilarini tanimla.
3. Asagidaki env degiskenlerini zorunlu olarak tanimla:

```env
ENVIRONMENT=production
DATABASE_URL=<postgres-connection-url>
REDIS_URL=<redis-connection-url>
SECRET_KEY=<minimum-32-char-secret>
CORS_ORIGINS=<https://app.example.com,https://www.app.example.com>
FRONTEND_URL=<https://app.example.com>
STRIPE_SECRET_KEY=<stripe-secret-key>
STRIPE_WEBHOOK_SECRET=<stripe-webhook-secret>
LEMON_API_KEY=<lemon-api-key>
LEMON_WEBHOOK_SECRET=<lemon-webhook-secret>
LEMON_STORE_ID=<lemon-store-id>
LEMON_PRO_VARIANT_ID=<lemon-variant-id-pro>
LEMON_ELITE_VARIANT_ID=<lemon-variant-id-elite>
```

## 3. Odeme Webhooklari
- Stripe webhook: `/api/v1/billing/webhook/stripe`
- Lemon webhook: `/api/v1/billing/webhook/lemonsqueezy`
- Production ortaminda webhook secret olmadan plan aktivasyonu yapilmaz.

## 4. Guvenlik Kontrol Listesi
- Production'da test/demo login kapali olmalidir.
- `JWT_SECRET`, `SECRET_KEY`, `EXCHANGE_CREDENTIALS_KEY` minimum 32 karakter olmalidir.
- `NEXT_PUBLIC_API_URL` dolu olsa bile auth/billing/exchange session endpointleri same-origin `/api/v1` kullanacak sekilde kalmalidir.
- Borsa credential onboarding production'da client tarafindan kapali olmalidir.
- Gercek exchange onboarding acilacaksa filesystem vault yerine kalici sifreli backend storage zorunlu olmalidir.
- Gercek trade endpoint'i production'da dry-run modunda kalmalidir.
- CORS yalnizca izinli origin listesi ile sinirlanmalidir.
- Refresh token rotation state in-memory tutuluyorsa cold-start/redeploy kaybi riski dokumante edilmelidir.

## 5. Zorunlu Operasyon Notu
- Gecmiste repo veya dokumanda gecmis olabilecek tum anahtarlar/public key benzeri degerler **rotate edilmelidir**.
- Rotation tamamlanmadan production rollout onermeyin.


