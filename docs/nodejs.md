# Node.js / TypeScript client

The `iclub-api` package is an **ESM-only** Node.js client (Node.js 20+) with generated TypeScript declaration files. It does not export a CommonJS `require()` entry point. Use a `.mjs` file, or set `"type": "module"` in your application `package.json`.

## Authentication and cleanup

```ts
import { IClub } from 'iclub-api';

const api = new IClub();
try {
  const gyms = await IClub.listGyms();
  console.log(gyms.map((g) => g.name));
  await api.login(process.env.ICLUB_EMAIL!, process.env.ICLUB_PASSWORD!, process.env.ICLUB_GYM!);

  const profile = await api.getProfile();
  const credit = await api.getCredit();
  console.log(profile, credit);
} finally {
  await api.close();
}
```

The client retains credentials in memory for lazy browser sign-in; never put secrets in logs or crash reports. Create **one client per authorized user account**, and always call `close()` / `logout()` when done.

## Member account and visits

```ts
const user = await api.getUser();
const stats = await api.getCustomerStats();
const memberships = await api.getMemberships();
const visits = await api.getVisitHistory();
const sales = await api.getPayments(20);
const dashboard = await api.getDashboard();
```

Raw methods (`getUser`, `getVisitsTransactions`, `getSalesTransactions`) return original backend data; convenience methods (`getProfile`, `getDashboard`, `getVisitHistory`) return SDK-composed objects. Fields are not guaranteed to be present for every gym.

## Calendar

```ts
const cal = await api.getCalendar({ view: 'week' });
for (const event of cal.events) {
  console.log(event.id, event.title, event.startDate, event.booked);
}
const chosen = cal.events[0];
if (chosen) {
  const detail = await api.getEventDetail(chosen.id, {
    start: cal.rangeStart,
    end: cal.rangeEnd,
  });
  console.log(detail);
}
```

`getCustomerEvents()` returns account bookings around a specified time. `getRooms()` and `getRoomsEvents(startIso, endIso)` expose raw reservation hub responses.

## Update contact data

```ts
await api.updateContactInformation({
  gender: 'male', firstName: 'Example', lastName: 'User',
  email: 'example@domain.test', phoneNumber: '', addressLine: '',
  city: '', zipCode: '', country: 'Slovakia', marketingConsent: false
});
```

This writes to the iClub account. Provide a complete desired contact record, not just the one field you wish to change.

## Change password

```ts
await api.changePassword(oldPassword, newPassword, newPassword);
```

## Browser functions

Install a Chromium browser separately with `npx playwright install chromium` after installing the optional `playwright` package. The public API exposes `getLiveQrCode`, `resetQrPage`, `reserveEvent`, `prepareCreditDeposit` and the static `IClub.register(details)`.

```ts
const data = await api.getLiveQrCode();
// data.qrCodeDataUrl is sensitive; display to the member only
```

See [Browser and bookings](browser-features.md) for important limitations and explicit write-operation examples.

## Error handling

```ts
import { IClub, IClubError } from 'iclub-api';
try {
  await api.getCredit();
} catch (error) {
  if (error instanceof IClubError) {
    console.error(error.code, error.retryable, error.status);
  }
}
```

Some validation errors are plain `Error`s. There is no guaranteed retry protocol for mutations. Do not automatically repeat reservations or top-up actions on a timeout.
