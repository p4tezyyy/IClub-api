# Security policy

The unofficial iClub API SDK handles login credentials and sensitive membership information. Read the [full security guide](docs/security.md) and [limitations](docs/limitations.md).

## Private vulnerability reports

Do not disclose passwords, cookies, session IDs, account records, payment links or QR codes in public issues.

Use [GitHub private vulnerability reporting](https://github.com/p4tezyyy/IClub-api/security/advisories/new) **if enabled**, or contact the maintainer through an established private channel. Do not publish an exploit before coordinating disclosure.

## Safe usage and support

Only access accounts you are authorized to use. Keep credentials in a secrets manager or environment variables; protect authenticated sessions; redact logs and never blindly retry bookings or other mutating operations.

This is an early community-maintained SDK with no guaranteed security-support period or SLA. The library does not process credit-card charges: its browser top-up feature only prepares the official payment page.
