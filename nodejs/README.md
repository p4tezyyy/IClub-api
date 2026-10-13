# iclub-api — Node.js / TypeScript

Unofficial iClub client for **Node.js 20+**. Pure ESM with TypeScript declarations, derived from the provided ModernFITCLUB implementation. GPL-3.0-only. No affiliation with iClub.

## Install

When published:

```sh
npm install iclub-api
```

From the source repository:

```sh
cd nodejs
npm install
npm run build
```

For optional browser features (QR, reservations, registration, top-up), install Chromium:

```sh
npx playwright install chromium
```

## JavaScript usage

```js
import { IClub } from 'iclub-api';

const api = new IClub();
try {
  await api.login(process.env.ICLUB_EMAIL, process.env.ICLUB_PASSWORD, process.env.ICLUB_GYM);
  console.log(await api.getCredit());
  console.log(await api.getProfile());
  console.log(await api.getCalendar({ view: 'month' }));
} finally {
  await api.close();
}
```

JavaScript and TypeScript method names use camelCase; Python uses snake_case. Browser operations use the official iClub website UI and can break when the interface changes. `reserveEvent()` returns `confirmed: false` if UI submission has not been verified on the server.

Read the [full Node guide](../docs/nodejs.md), [all method signatures](../docs/api-reference.md), [security](../docs/security.md) and [publishing guide](../docs/publishing.md).
