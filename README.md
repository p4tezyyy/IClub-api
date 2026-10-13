# iClub API

[![CI](https://github.com/p4tezyyy/IClub-api/actions/workflows/ci.yml/badge.svg)](https://github.com/p4tezyyy/IClub-api/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/iclub-api.svg?label=npm)](https://www.npmjs.com/package/iclub-api)
[![PyPI](https://img.shields.io/pypi/v/iclub-api.svg?label=PyPI)](https://pypi.org/project/iclub-api/)
[![License: GPL-3.0-only](https://img.shields.io/badge/license-GPL--3.0--only-blue.svg)](LICENSE)

**Unofficial iClub SDK for Python and Node.js / TypeScript.** Access an authorized fitness account through observed iClub SignalR endpoints. Optional Playwright supports browser-only operations.

> [!WARNING]
> **Not affiliated with or endorsed by iClub.** This SDK uses private, changeable endpoints at `online.iclub.sk`. Only use accounts you own or have permission to access.

## Install

| Runtime | Package | Installation | Import |
| --- | --- | --- | --- |
| Python 3.10+ | [`iclub_api` on PyPI](https://pypi.org/project/iclub-api/) | `python -m pip install iclub_api` | `from iclub_api import IClub` |
| Node.js 20+ ESM | [`iclub-api` on npm](https://www.npmjs.com/package/iclub-api) | `npm install iclub-api` | `import { IClub } from 'iclub-api'` |

Check the registry for available versions; the table does **not** guarantee a release has been published. See [source installation](docs/getting-started.md#2-install) if you need to use an unpublished version.

## Python example

```python
import asyncio
import os
from iclub_api import IClub

async def main():
    print("Clubs:", [g["name"] for g in await IClub.list_gyms()])
    async with IClub() as api:
        await api.login(
            os.environ["ICLUB_EMAIL"],
            os.environ["ICLUB_PASSWORD"],
            os.environ["ICLUB_GYM"],
        )
        print("Credit:", await api.get_credit())
        print("Memberships:", await api.get_memberships())
        print("Calendar:", await api.get_calendar(view="week"))

asyncio.run(main())
```

## Node.js example

```js
import { IClub } from 'iclub-api';

const { ICLUB_EMAIL: email, ICLUB_PASSWORD: password, ICLUB_GYM: gym } = process.env;
if (!email || !password || !gym) throw new Error('Set ICLUB_EMAIL, ICLUB_PASSWORD and ICLUB_GYM');

const api = new IClub();
try {
  console.log('Clubs:', (await IClub.listGyms()).map((g) => g.name));
  await api.login(email, password, gym);
  console.log('Credit:', await api.getCredit());
  console.log('Memberships:', await api.getMemberships());
  console.log('Calendar:', await api.getCalendar({ view: 'week' }));
} finally {
  await api.close();
}
```

Choose the exact gym name returned by club discovery. Never hardcode your password in source.

## Supported features

- Club discovery, authentication, profile and account statistics.
- Memberships, account credit, visits, transactions and derived dashboards.
- Reservation calendar, rooms and event details.
- Optional browser-based QR code, registration, guarded booking and top-up page preparation.
- Advanced SignalR invocation for authorized users.

**Limits:** Browser reservation submission does not guarantee a confirmed booking. Top-up preparation does not charge a card. Live compatibility has not been independently verified; unit tests use mock data.

## Documentation

[Getting started](docs/getting-started.md) · [Python guide](docs/python.md) · [Node.js guide](docs/nodejs.md) · [API reference](docs/api-reference.md) · [Data models](docs/data-models.md) · [Browser features](docs/browser-features.md) · [Troubleshooting](docs/troubleshooting.md) · [Security](SECURITY.md) · [Publishing](docs/publishing.md)

[Contributing](CONTRIBUTING.md) · [Changelog](docs/changelog.md) · [GitHub Issues](https://github.com/p4tezyyy/IClub-api/issues) · [GitHub Releases](https://github.com/p4tezyyy/IClub-api/releases)

## Development

```sh
python -m pip install -e './python[test]'
python -m pytest python/tests -q
cd nodejs
npm install
npm run check
```

## License

[GNU General Public License version 3 only](LICENSE) (`GPL-3.0-only`). Third-party dependencies and the iClub service remain subject to their own terms. See [license notes](docs/license.md).
