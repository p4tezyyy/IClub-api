# iClub API documentation

**`iclub-api` (npm)** and **`iclub_api` (PyPI)** are two community-maintained client libraries for iClub accounts. They use observed ASP.NET SignalR calls, and optionally Playwright for flows that the source application only implemented in the browser.

!!! warning "Unofficial client"
    The SDK is not developed, approved, endorsed or supported by iClub. Private endpoints, login requirements and web selectors can change without warning. It is not an official public API or a hosted REST service.

## Choose your language

| Library | Install after release | Import | Runtime |
|---|---|---|---|
| Python | `pip install iclub_api` | `from iclub_api import IClub` | Python 3.10+ |
| Node.js | `npm install iclub-api` | `import { IClub } from 'iclub-api'` | Node.js 20+ ESM |

## Navigate the docs

- [Getting started](getting-started.md): install, choose gym, sign in, first request.
- [Python](python.md) / [Node.js](nodejs.md): production-shaped examples in each language.
- [API reference](api-reference.md): full public method inventory, arguments and responses.
- [Data models](data-models.md): composite and raw result structure.
- [Architecture](architecture.md) and [browser features](browser-features.md): explain what happens on the wire.
- [Troubleshooting](troubleshooting.md) and [limitations](limitations.md): common failures and expected uncertainty.
- [Security](security.md): protect accounts, sessions, QR codes and personal data.
- [Publishing](publishing.md): release packages to npm/PyPI and automate updates.

## Is this API official?

No. iClub account data is retrieved via endpoints observed in the supplied ModernFITCLUB project. Features listed here reflect the **source implementation**, not a promise that every iClub installation supports them. The SDK does not scrape another user's account, bypass authorization or automate payments without account consent.

## License

[GNU General Public License version 3, only](license.md). The license applies to this SDK's original code; dependencies and iClub itself have separate licenses/terms.
