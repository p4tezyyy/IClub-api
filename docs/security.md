# Security and privacy

The SDK processes **sensitive credentials and personal account data**. Using it as a hosted backend brings additional security and privacy obligations. Avoid publishing real account responses in issues, commits or example code.

## Rules for application developers

- Use only accounts you own or have explicit permission to access. Respect iClub's terms, privacy requirements and rate limits.
- Keep passwords in a secrets manager or environment; never commit credentials, tokens, cookies, QR codes, or `.env` files.
- Do not run a public proxy that gives any anonymous user access to authenticated iClub methods.
- Use HTTPS to protect any API you build around this SDK. Implement authentication, authorization, per-user session isolation, rate limiting and audit logs.
- Redact complete profiles, payment redirect URLs, QR code data, transaction details, email addresses, session IDs and passwords from logs.
- Do not automatically retry account mutations, top-ups or reservations after timeouts; verify remote state first.
- Check that GPL-3.0-only licensing is compatible with your intended distribution and distribution of combined code.
- Validate private endpoints against provider terms before public deployment. Never attempt to bypass CAPTCHA, MFA, anti-bot or access controls.

## Session handling

Python retains session context and user ID in memory. For browser-enabled clients, the password is retained in process memory to sign into the site's UI. Node.js similarly retains credentials for lazy browser login. Do not persist in process dumps. On process termination, closing the client is recommended where possible.

## QR and payments

Treat a QR data URL as if it were a physical gym membership card. Do not use public image hosting or telemetry for it. A redirect to the official credit top-up page may contain account context. Neither the library nor its logs should expose it to unauthorized users.

## Security reporting

Please avoid posting exploits, leaked tokens, personal data or vulnerabilities in public GitHub issues. Contact the repository maintainer privately through a security advisory or a private channel configured by the owner. This repository does not imply a bug-bounty relationship with iClub.
