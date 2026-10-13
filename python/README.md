# iclub_api — Python

[![PyPI](https://img.shields.io/pypi/v/iclub-api)](https://pypi.org/project/iclub-api/)
[![GitHub](https://img.shields.io/badge/source-GitHub-black)](https://github.com/p4tezyyy/IClub-api)

Unofficial asynchronous iClub SDK for **Python 3.10+**, with optional Playwright browser support. Licensed under `GPL-3.0-only`. **Not affiliated with iClub.**

## Installation

```sh
python -m pip install iclub_api
```

For optional QR, reservation, registration and top-up-page features:

```sh
python -m pip install 'iclub_api[browser]'
python -m playwright install chromium
```

## Example

```python
import asyncio
import os
from iclub_api import IClub

async def main():
    print('Clubs:', await IClub.list_gyms())
    async with IClub() as api:
        await api.login(
            os.environ['ICLUB_EMAIL'],
            os.environ['ICLUB_PASSWORD'],
            os.environ['ICLUB_GYM'],
        )
        print('Credit:', await api.get_credit())
        print('Calendar:', await api.get_calendar(view='week'))

asyncio.run(main())
```

Use the exact gym name returned by `list_gyms()`. Use `await` for all network operations and `async with` to clean up. Browser support is disabled by default; enable `IClub(browser_enabled=True)` if required.

## Install from source

From the repository root:

```sh
git clone https://github.com/p4tezyyy/IClub-api.git
cd IClub-api
python -m pip install -e './python[test]'
python -m pytest python/tests -q
```

For browser features from source use `python -m pip install -e './python[browser]'`.

## Documentation

[Getting started](https://github.com/p4tezyyy/IClub-api/blob/main/docs/getting-started.md) · [Python guide](https://github.com/p4tezyyy/IClub-api/blob/main/docs/python.md) · [API reference](https://github.com/p4tezyyy/IClub-api/blob/main/docs/api-reference.md) · [Browser features](https://github.com/p4tezyyy/IClub-api/blob/main/docs/browser-features.md) · [Security](https://github.com/p4tezyyy/IClub-api/blob/main/docs/security.md) · [Troubleshooting](https://github.com/p4tezyyy/IClub-api/blob/main/docs/troubleshooting.md)

Private endpoints may change; a booking click is not server confirmation. [Report SDK problems](https://github.com/p4tezyyy/IClub-api/issues).
