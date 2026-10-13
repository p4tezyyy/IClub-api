# Changelog

## 0.1.0 — initial public-release candidate (2026-10-13)

- Extracted/ported supported iClub workflows from ModernFITCLUB.
- Python async client with SignalR transport and optional Playwright browser.
- Node.js ESM/TypeScript client using original SignalR implementation and optional browser flows.
- API methods for account, tickets, visits, transactions, calendar and profile/dashboard composites.
- Optional live QR retrieval, registration, credit top-up preparation, guarded reservation submission.
- Offline tests and README plus multi-page usage/API/publishing documentation.
- Distribution names finalized as `iclub_api` (PyPI) and `iclub-api` (npm); Python import renamed `iclub_api`.
- Adopted `GPL-3.0-only`, including full license files in both source package roots.

**Release note:** This is a local release candidate, not proof of publication or live service compatibility. Publish only after verifying both registries and performing authorized live tests.
