# Limitations and compatibility

## Verification status

The SDK is extracted from ModernFITCLUB and tested offline with mock backend data and code-level smoke tests. **No successful live login, class reservation, QR retrieval, password change, registration or payment has been independently verified for the published version.** Treat `0.1.0` as an early unofficial release.

## Known constraints

1. **Private API stability:** There is no official commitment that SignalR hubs or frontend selectors stay unchanged.
2. **Browser fallback:** QR, new account registration, booking submission and top-up preparation need Playwright and Chromium. Text, accessibility roles or language settings may differ by club.
3. **Booking certainty:** Reservation clicks do not prove the backend accepted a booking. Result can say `confirmed: false`. The library intentionally refuses ambiguous calendar matches.
4. **Payment scope:** No card processing or payment confirmation is implemented. Only preparation/redirection to the official iClub flow exists.
5. **Data availability:** Clubs may expose different sets of tickets, rooms, credit accounts and event data. Nullable fields and empty arrays are normal.
6. **Data types:** Raw SignalR results are not a stable documented schema. High-level responses contain formatted date/price strings and must not be treated as normalized accounting data.
7. **Time zones:** Calendar calculations depend partly on local process time zones. Validate DST / UTC handling against your club.
8. **Execution environment:** Node client targets Node.js ESM only. Python client is asynchronous. Browser automation may require additional OS libraries in Docker or Linux.
9. **Authentication:** The underlying protocol uses a SHA-256/Base64 password hash and session identifiers; it is not a modern public OAuth API and cannot be assumed safe against arbitrary exposure.
10. **Distribution:** The project does not claim exclusive rights to iClub trademarks or other third-party intellectual property. GPLv3 covers SDK code only insofar as the project owner can license it.

## Things this SDK does not do

- Provide a hosted public REST API, a web dashboard or universal mobile API.
- Expose iClub member records without user account credentials/authorization.
- Guarantee a seat, complete a credit card payment, or verify QR ownership.
- Promise 100% coverage of unobserved iClub hub methods.
- Offer an official partner integration or SLA.

If you need a production-grade external API, build an opt-in backend with per-user encryption, rate limits, sessions, audit logs and monitoring; also obtain permission from iClub where applicable.
