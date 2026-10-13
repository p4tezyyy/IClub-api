# iclub_api — Python

Async, unofficial iClub client for Python 3.10+. Full documentation is in the [source repository's docs](../docs/index.md), with [Python usage](../docs/python.md) and [all method signatures](../docs/api-reference.md).

Not supported by or affiliated with iClub. GPL-3.0-only. Uses private, changeable SignalR endpoints; requires an authorized account.

## Install

When published: `pip install iclub_api`

From this repository:

```sh
python -m pip install -e ./python
```

For QR codes, registration, credit top-up and bookings:

```sh
python -m pip install 'iclub_api[browser]' # after publication
python -m playwright install chromium
```

For source installs, use `python -m pip install -e './python[browser]'` from the repository root.

## Example

```python
import asyncio, os
from iclub_api import IClub

async def main():
    async with IClub() as api:
        await api.login(os.environ['ICLUB_EMAIL'], os.environ['ICLUB_PASSWORD'], os.environ['ICLUB_GYM'])
        print(await api.get_credit())
        print(await api.get_profile())
        print(await api.get_calendar(view='week'))

asyncio.run(main())
```

Methods are `async`; call them with `await`. The client closes its transport on exit. `browser_enabled=False` by default; enable it explicitly for browser-dependent operations. Registration is `await api.register(...)` on a browser-enabled client, even before login.

See [security](../docs/security.md) before using real credentials, and [limitations](../docs/limitations.md) before relying on booking or payment flows.
