# iClub API

**Unofficial, community-maintained SDK for iClub fitness accounts.** Two independently installable libraries, one Python and one Node.js/TypeScript, built from the supplied ModernFITCLUB project.

[Getting started](docs/getting-started.md) · [Python API](docs/python.md) · [Node.js API](docs/nodejs.md) · [All methods](docs/api-reference.md) · [Publishing](docs/publishing.md) · [Security](docs/security.md)

> **Not affiliated with or endorsed by iClub.** Uses observed private ASP.NET SignalR endpoints at `online.iclub.sk`, plus optional Playwright for certain web UI operations. May break when iClub updates its service. Only use your own account or accounts with explicit permission.

## Installation (once published)

| Environment | Install | Import |
|---|---|---|
| Python 3.10+ | `python -m pip install iclub_api` | `from iclub_api import IClub` |
| Node.js 20+ | `npm install iclub-api` | `import { IClub } from "iclub-api"` |

**These packages are prepared for publishing, not yet published by this project.** Install from the source directories until you publish them. Both packages have version `0.1.0`.

## Example: Python

```python
import os
import asyncio
from iclub_api import IClub

async def main():
    print('Clubs:', (await IClub.list_gyms())[:5])
    async with IClub() as api:
        await api.login(os.environ['ICLUB_EMAIL'], os.environ['ICLUB_PASSWORD'], os.environ['ICLUB_GYM'])
        print('Credit:', await api.get_credit())
        print('Memberships:', await api.get_memberships())
        print('Calendar:', await api.get_calendar(view='week'))

asyncio.run(main())
```

## Example: Node.js

```js
import { IClub } from 'iclub-api';

const api = new IClub();
try {
  console.log('Clubs:', (await IClub.listGyms()).slice(0, 5));
  await api.login(process.env.ICLUB_EMAIL, process.env.ICLUB_PASSWORD, process.env.ICLUB_GYM);
  console.log('Credit:', await api.getCredit());
  console.log('Memberships:', await api.getMemberships());
  console.log('Calendar:', await api.getCalendar({ view: 'week' }));
} finally {
  await api.close();
}
```

## Supported operations

- Club discovery; login and logout; read user profile and customer statistics.
- Memberships/tickets, account balance and credit settings.
- Visit history and details; purchase/sale transaction history.
- Reservation calendar, rooms, customer bookings, event details.
- Dashboard aggregates, contact information changes, password changes.
- Optional browser-based QR retrieval, registration, guarded reservation submission, and opening an official credit top-up flow.
- Explicit advanced/raw SignalR invocations, error handling, and short-lived read caches.

See [the complete API reference](docs/api-reference.md) for every method and parameter. **Read-only operations use SignalR; several browser operations require Playwright and Chromium**. Booking return values do **not** guarantee server confirmation; top-ups do not charge money themselves.

## Docs, tests, releases

- Multi-page Markdown docs in [`docs/`](docs/index.md) with an optional MkDocs Material site.
- Python source: [`python/`](python/README.md); Node.js source: [`nodejs/`](nodejs/README.md).
- Build and release workflows: [`.github/workflows/`](.github/workflows/); publication requires your npm/PyPI account and configured trusted publishing (or manual upload).
- Release instructions: [`docs/publishing.md`](docs/publishing.md).

## License

**GNU General Public License v3.0 only (`GPL-3.0-only`)**. See [LICENSE](LICENSE). License applies to the SDK code distributed in this repository, subject to you holding the rights to license the originating code. Third-party dependencies and the iClub service remain under their own terms. `GPL-3.0-only` is copyleft; applications that distribute derivative/combined works may have to comply with its terms. Consult qualified counsel for specific distribution questions.

## Status

Version 0.1.0 is a **pre-release, source-derived integration**. Unit/smoke tests use mocked or offline data. No real iClub login, live booking, payment, or QR session has been verified for this version. The existence of an npm/PyPI project name is **not guaranteed** until the registries accept publication.
