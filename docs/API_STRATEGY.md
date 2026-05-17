# API Strategy

## Authoritative API
- **FastAPI Gateway (`services/gateway`) authoritative source** for business domains:
  - auth, billing/subscription state, portfolio/account data, risk controls
  - provider webhooks and server-to-server verifications

## Next API Routes (`apps/web/app/api`)
- **BFF/proxy only when needed**:
  - session cookie management for web auth UX
  - frontend-specific aggregation and lightweight normalization
  - secure server wrappers for browser-restricted integrations
- Next API routes should not duplicate core domain ownership from Gateway.

## Production Rule
- New domain endpoints must be added to Gateway first.
- Next routes can expose frontend-tailored facades, but source-of-truth state transitions stay in Gateway.
