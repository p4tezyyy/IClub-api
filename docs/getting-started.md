# Getting started

## 1. Requirements

- Python **3.10+** or Node.js **20+**; internet access to the iClub service.
- A valid, authorized iClub account and an iClub **gym name** (as reported by the clubs endpoint).
- Optional: Playwright and Chromium for QR codes, reservations, registration and top-up UI.

This project provides a **library**, not a local HTTP server. Your application imports `IClub` and calls its async methods. You can build your own REST service on top if needed.

## 2. Install

When published:

```bash
python -m pip install iclub_api
# OR
npm install iclub-api
```

Until publication, clone or extract this repository and install locally:

```bash
python -m pip install -e ./python
# OR
cd nodejs && npm install && npm run build
```

### Optional browser support

```bash
python -m pip install 'iclub_api[browser]'
python -m playwright install chromium
# For Node.js, Playwright is listed as an optional dependency:
npx playwright install chromium
```

For a Python editable install from the repository root, replace the first command with `python -m pip install -e './python[browser]'`.

## 3. Credentials

Use environment variables rather than hardcoding login details:

```bash
export ICLUB_EMAIL='your@email.example'
export ICLUB_PASSWORD='your-account-password'
export ICLUB_GYM='Exact gym name returned by listGyms/list_gyms'
```

PowerShell:

```powershell
$env:ICLUB_EMAIL = 'your@email.example'
$env:ICLUB_PASSWORD = 'your-account-password'
$env:ICLUB_GYM = 'Exact gym name'
```

Do not commit `.env` files or print credentials, session IDs, QR data URLs or complete personal profiles in logs.

## 4. Discover your gym

**Python:**

```python
import asyncio
from iclub_api import IClub

async def main():
    for gym in await IClub.list_gyms():
        print(gym['name'], gym['id'])

asyncio.run(main())
```

**Node.js:**

```js
import { IClub } from 'iclub-api';
console.log(await IClub.listGyms());
```

Choose the exact `name` returned. The library resolves it to a backend `Ident` during login.

## 5. Sign in and fetch data

**Python:**

```python
import asyncio, os
from iclub_api import IClub

async def main():
    async with IClub() as client:
        await client.login(os.environ['ICLUB_EMAIL'], os.environ['ICLUB_PASSWORD'], os.environ['ICLUB_GYM'])
        print(await client.get_credit())
        print(await client.get_available_tickets())

asyncio.run(main())
```

**Node.js:**

```js
import { IClub } from 'iclub-api';
const client = new IClub();
try {
  await client.login(process.env.ICLUB_EMAIL, process.env.ICLUB_PASSWORD, process.env.ICLUB_GYM);
  console.log(await client.getCredit());
  console.log(await client.getAvailableTickets());
} finally {
  await client.close();
}
```

Always close your client. Python provides `async with`; Node.js provides `close()` / `logout()`.

## 6. Continue

Explore [all methods](api-reference.md). For changing contact information, passwords, reservations or credit flows, read [browser features](browser-features.md) and [limitations](limitations.md) first.
