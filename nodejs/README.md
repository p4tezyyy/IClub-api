# iclub-api — Node.js / TypeScript

[![npm](https://img.shields.io/npm/v/iclub-api)](https://www.npmjs.com/package/iclub-api)
[![GitHub](https://img.shields.io/badge/source-GitHub-black)](https://github.com/p4tezyyy/IClub-api)

Unofficial iClub client for **Node.js 20+ (ESM)** with TypeScript declarations and optional Playwright. Licensed under `GPL-3.0-only`. **Not affiliated with iClub.**

## Installation

```sh
npm install iclub-api
```

To enable optional browser features such as QR codes, reservations, registration and top-up preparation:

```sh
npx playwright install chromium
```

If optional npm dependencies were disabled, install `playwright` explicitly.

## Example

Save as `example.mjs`:

```js
import { IClub } from 'iclub-api';

const { ICLUB_EMAIL: email, ICLUB_PASSWORD: password, ICLUB_GYM: gym } = process.env;
if (!email || !password || !gym) throw new Error('Set ICLUB_EMAIL, ICLUB_PASSWORD and ICLUB_GYM');

const api = new IClub();
try {
  console.log('Clubs:', await IClub.listGyms());
  await api.login(email, password, gym);
  console.log('Credit:', await api.getCredit());
  console.log('Calendar:', await api.getCalendar({ view: 'week' }));
} finally {
  await api.close();
}
```

Use the exact gym name returned by `listGyms()`. All network methods are asynchronous. This library does **not** support CommonJS `require()`.

## Build from source

```sh
git clone https://github.com/p4tezyyy/IClub-api.git
cd IClub-api/nodejs
npm install
npm run check
```

For a consuming project, run `npm install /path/to/IClub-api/nodejs` there after building.

## Documentation

[Getting started](https://github.com/p4tezyyy/IClub-api/blob/main/docs/getting-started.md) · [Node.js guide](https://github.com/p4tezyyy/IClub-api/blob/main/docs/nodejs.md) · [API reference](https://github.com/p4tezyyy/IClub-api/blob/main/docs/api-reference.md) · [Browser features](https://github.com/p4tezyyy/IClub-api/blob/main/docs/browser-features.md) · [Security](https://github.com/p4tezyyy/IClub-api/blob/main/docs/security.md) · [Troubleshooting](https://github.com/p4tezyyy/IClub-api/blob/main/docs/troubleshooting.md)

Private endpoints may change. A booking click is not server confirmation. [Report SDK problems](https://github.com/p4tezyyy/IClub-api/issues).
