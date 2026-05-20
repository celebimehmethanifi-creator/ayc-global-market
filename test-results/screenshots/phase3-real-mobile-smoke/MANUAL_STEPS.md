# Real Mobile Smoke — Manual Steps

## Pre-flight (Windows PC: C:\Users\mhani\Desktop\NEURA)

```powershell
cd C:\Users\mhani\Desktop\NEURA
git fetch origin
git switch fix/live-data-truth-mobile-shell
git pull --ff-only
git rev-parse --short HEAD
# Expected: 207962d (or later)
```

## Start the dev server accessible from phone (same Wi-Fi)

```powershell
$env:JWT_SECRET="local-test-jwt-secret-32chars-minimum"
$env:NEXT_PUBLIC_API_URL="http://localhost:3093"
pnpm --filter neura-web dev -- -H 0.0.0.0 -p 3093
```

## Find PC LAN IP

```powershell
ipconfig
# Look for: IPv4 Address . . . . . . : 192.168.x.x  (or 10.x.x.x)
```

If Windows Firewall blocks phone access:

```powershell
# Run as Administrator
netsh advfirewall firewall add rule name="Next.js 3093" dir=in action=allow protocol=TCP localport=3093
```

## Phone and PC must be on the same Wi-Fi network

Open on phone: `http://<PC_LAN_IP>:3093`

---

## Pages to test on EACH real mobile browser

For each page, take a screenshot and save with the filename shown.

| # | URL | Screenshot filename |
|---|-----|---------------------|
| 1 | `/dashboard` (top) | `dashboard-top.png` |
| 2 | `/dashboard` (scrolled down) | `dashboard-scrolled.png` |
| 3 | `/market` | `market-top.png` |
| 4 | `/market` → tap BTCUSDT or SOLUSDT → modal opens | `asset-detail-modal.png` |
| 5 | `/alarms` | `alarms-empty.png` |
| 6 | `/performance` | `performance-zero-state.png` |
| 7 | `/social` | `social-radar.png` |
| 8 | Copilot / bottom input area if visible | `copilot-bottom-area.png` |
| 9 | `http://<IP>:3093/api/v1/version` in browser | `version-endpoint.png` |

---

## Visual checks — mark each PASS or FAIL

```
[ ] No header/ticker top clipping (ticker visible at very top, not cut off)
[ ] No safe-area overlap (status bar does not cover content on iPhone notch)
[ ] No ticker/header collision (ticker and topbar do not overlap)
[ ] No content hidden behind bottom nav (last item of each page scrolls above nav)
[ ] No horizontal overflow (no sideways scrollbar on any page)
[ ] Hero/demo balance visible on dashboard
[ ] CTA buttons visible and not squeezed into nav
[ ] Copilot bottom area not compressed by keyboard/nav
[ ] Ticker not duplicated or visually crowded
[ ] Asset detail modal header/chart not clipped
[ ] Alarms page shows "Henüz alarm bulunmuyor." — no SİSTEM/demo row
[ ] Performance zero-state bar not misleading
[ ] No "Gerçek zamanlı piyasa istihbarat merkezi" text visible
[ ] No "Binance Canlı" source label visible
[ ] No "Canlı" badge unless real WS data flowing
```

---

## Save screenshots

**iOS Safari:**
```
test-results/screenshots/phase3-real-mobile-smoke/ios-safari/
  dashboard-top.png
  dashboard-scrolled.png
  market-top.png
  asset-detail-modal.png
  alarms-empty.png
  performance-zero-state.png
  social-radar.png
  copilot-bottom-area.png   (if visible)
  version-endpoint.png
```

**iOS Chrome (if available):**
```
test-results/screenshots/phase3-real-mobile-smoke/ios-chrome/
  (same filenames)
```

**Android Chrome (if available):**
```
test-results/screenshots/phase3-real-mobile-smoke/android-chrome/
  (same filenames)
```

---

## Update manifest.json after testing

Fill in `manifest.json` in this directory:

```json
{
  "status": "PASS | PARTIAL_REAL_DEVICE_EVIDENCE | FAIL | NOT_RUN",
  "branch": "fix/live-data-truth-mobile-shell",
  "headCommit": "a878330",
  "testedUrl": "http://192.168.x.x:3093",
  "testedAt": "2026-05-18T...",
  "devices": [
    {
      "device": "iPhone model or unknown",
      "os": "iOS 17.x or unknown",
      "browser": "Safari",
      "result": "PASS",
      "screenshots": [
        "ios-safari/dashboard-top.png",
        "ios-safari/dashboard-scrolled.png",
        "ios-safari/market-top.png",
        "ios-safari/asset-detail-modal.png",
        "ios-safari/alarms-empty.png",
        "ios-safari/performance-zero-state.png",
        "ios-safari/social-radar.png",
        "ios-safari/version-endpoint.png"
      ]
    }
  ],
  "checks": {
    "noHeaderTickerOverlap": true,
    "noBottomNavOverlap": true,
    "noHorizontalOverflow": true,
    "heroVisible": true,
    "copilotSafeAreaOk": true,
    "tickerNotCrowded": true,
    "noFakeLiveClaims": true
  }
}
```

---

## Classification rules

| Evidence | REAL_MOBILE_PASS classification |
|----------|----------------------------------|
| iOS Safari + iOS Chrome screenshots, all checks pass | PASS |
| iOS Safari only, all checks pass | PARTIAL_REAL_DEVICE_EVIDENCE |
| Any layout blocker found | FAIL |
| No real device tested | NOT_RUN |

---

## After testing

1. Copy screenshots to the folders above
2. Update `manifest.json`
3. Commit: `git add test-results/screenshots/phase3-real-mobile-smoke/ reports/`
4. Update `reports/current-agent-report.md` and `.json`
5. Push: `git push -u origin fix/live-data-truth-mobile-shell`
