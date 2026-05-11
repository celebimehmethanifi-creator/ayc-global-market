# AYC Global Market — Yayına Alma Rehberi

## 1. DOMAIN KAYDI

### Önerilen Domain'ler:
- `aycglobalmarket.com` (~$12/yıl)
- `aycmarket.com`
- `ayc-global.com`

### Nereden Al:
| Sağlayıcı | Fiyat | Link |
|-----------|-------|------|
| Namecheap | $9-12/yıl | namecheap.com |
| GoDaddy | $12-15/yıl | godaddy.com |
| Cloudflare | $9-10/yıl (at-cost) | cloudflare.com/registrar |

### Cloudflare DNS (ÜCRETSİZ):
1. Domain al → Cloudflare'e taşı
2. Ücretsiz: SSL, DDoS koruması, CDN
3. Vercel/Railway için CNAME ekle

---

## 2. FRONTEND DEPLOY — VERCEL (ÜCRETSİZ)

### Adımlar:
1. https://vercel.com → GitHub ile giriş
2. "Import Project" → GitHub repo seç
3. Root Directory: `apps/web`
4. Framework: Next.js (otomatik algılanır)
5. Environment Variables ekle:
   ```
   NEXT_PUBLIC_API_URL = https://ayc-api.railway.app   (backend URL)
   ```
6. Deploy

### Custom Domain:
1. Vercel Dashboard → Project → Settings → Domains
2. `aycglobalmarket.com` ekle
3. Cloudflare'de CNAME: `www → cname.vercel-dns.com`

---

## 3. BACKEND DEPLOY — RAILWAY

### Adımlar:
1. https://railway.app → GitHub ile giriş
2. "New Project" → GitHub repo
3. Root Directory: `services/gateway`
4. Environment Variables (Settings → Variables):

```env
OPENAI_API_KEY=sk-proj-QoR4UdMv...
ANTHROPIC_API_KEY=sk-ant-api03...
GEMINI_API_KEY=AIzaSyCz_bN8...
FINNHUB_API_KEY=d7pp429r01...
NEWSAPI_KEY=c8c10ec847...
COINGLASS_API_KEY=b88252135...
BINANCE_API_KEY=XtXyXCMM76...
BYBIT_API_KEY=91kDqh3JRJ...
OKX_API_KEY=099328fb-0c26...
COINMARKETCAP_API_KEY=0bf380...
COINGECKO_API_KEY=CG-MoxLL...
SECRET_KEY=ayc-production-secret-CHANGE-THIS-2026
DATABASE_URL=postgresql://...  (Railway PostgreSQL ekle)
FRONTEND_URL=https://aycmarket.com
CORS_ORIGINS=https://aycmarket.com,https://www.aycmarket.com
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
IYZICO_API_KEY=...
IYZICO_SECRET_KEY=...
IYZICO_BASE_URL=https://api.iyzipay.com
```

5. "Deploy" → URL al: `https://ayc-api-xxx.railway.app`
6. PostgreSQL ekle: Railway → Add Plugin → PostgreSQL

### Maliyet: $5-20/ay (Hobby plan)

---

## 4. STRIPE KURULUMU

### Test Modu:
1. https://stripe.com → Kayıt
2. Dashboard → Developers → API Keys:
   - `STRIPE_SECRET_KEY` = `sk_test_...`
3. Products → Create:
   - "AYC Pro" → $9.99/month → Price ID kopyala → `STRIPE_PRICE_PRO`
   - "AYC Elite" → $24.99/month → Price ID kopyala → `STRIPE_PRICE_ELITE`
4. Webhooks:
   - Endpoint URL: `https://ayc-api.railway.app/api/v1/billing/webhook/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.deleted`
   - Secret: `STRIPE_WEBHOOK_SECRET`

### Canlı Moda Geçiş:
1. Business verification tamamla
2. Live keys kullan: `sk_live_...`
3. Aynı webhook endpoint (live events)

### Test Kartı: `4242 4242 4242 4242` · MM/YY: `12/34` · CVV: `123`

---

## 5. IYZICO KURULUMU (TÜRK KULLANICILAR İÇİN)

1. https://iyzico.com → "Hemen Başla"
2. Sandbox: https://sandbox.iyzipay.com → Test key'leri al
3. Canlı: Firma bilgilerini gir → Onay bek (~1-3 gün)
4. API Keys → `IYZICO_API_KEY` + `IYZICO_SECRET_KEY`
5. Sandbox URL: `https://sandbox-api.iyzipay.com`
6. Production URL: `https://api.iyzipay.com`

---

## 6. GEREKLİ HESAPLAR ÖZETİ

| Servis | Amaç | Maliyet |
|--------|------|---------|
| Vercel | Web hosting | Ücretsiz |
| Railway | Backend API | $5-20/ay |
| Cloudflare | DNS + SSL | Ücretsiz |
| Namecheap | Domain | $9-12/yıl |
| Stripe | Uluslararası ödeme | %2.9+$0.30/işlem |
| iyzico | TR ödeme | %2.35+0.25₺/işlem |

---

## 7. HIZLI BAŞLANGIC (BUGün)

```bash
# 1. Vercel'e deploy (5 dk)
# - vercel.com → import GitHub repo → deploy

# 2. Railway backend (10 dk)  
# - railway.app → import repo → env vars → deploy

# 3. Vercel'de NEXT_PUBLIC_API_URL = Railway URL

# 4. Test: https://aycglobalmarket.vercel.app
```

## 8. STRIPE TEST

```
Kart: 4242 4242 4242 4242
Son kullanma: 12/34
CVV: 123
```
