# Browser features, bookings, registration and QR

The source app uses a real browser for these operations. They are **experimental**, selector-dependent and should be manually verified against a test account after any iClub website update.

## Setup

Python:

```bash
python -m pip install 'iclub_api[browser]'
python -m playwright install chromium
```

Node.js:

```bash
npm install iclub-api
npx playwright install chromium
```

The npm package lists Playwright as an optional dependency; if you installed using `--omit=optional`, install `playwright` explicitly first.

## QR (sensitive)

**Python**:

```python
async with IClub(browser_enabled=True) as api:
    await api.login(email, password, gym)
    qr = await api.get_live_qr_code()
    # qr['qrCodeDataUrl'] -> data:image/png;base64,...
    await api.reset_qr_page()
```

**Node.js**:

```js
const qr = await api.getLiveQrCode();
await api.resetQrPage();
```

These QR images may grant entry or identify a member. Do not store them in analytics logs, CDN caches, public dashboards or third-party image hosts. Limit their exposure to the authorized member and keep them fresh.

## Reserve a class (write operation)

**Python**:

```python
async with IClub(browser_enabled=True) as api:
    await api.login(email, password, gym)
    cal = await api.get_calendar(view='week')
    chosen = next((event for event in cal['events'] if not event['booked'] and not event['ended']), None)
    if chosen:
        result = await api.reserve_event(
            chosen['id'], start=cal['rangeStart'], end=cal['rangeEnd']
        )
        print(result)  # likely confirmed: False
```

**Node.js**:

```js
const cal = await api.getCalendar({ view: 'week' });
const chosen = cal.events.find((event) => !event.booked && !event.ended);
if (chosen) {
  const result = await api.reserveEvent(chosen.id, {
    start: cal.rangeStart, end: cal.rangeEnd
  });
  console.log(result); // UI submission is not server confirmation
}
```

The SDK identifies the event from the SignalR calendar, then searches the site for **one unique visible event matching title, start time and trainer**. If ambiguous, it stops. This avoids a prior source bug in which the backend's `EventId` was incorrectly treated as a browser element index.

**Important:** `confirmed: false` means only that the UI action was attempted. Verify actual booking with an independent fresh calendar/account fetch or directly in the gym app before assuming you have a reservation. Do not build unattended bulk bookings or automatic retries from this version.

## Prepare credit top-up

**Python:** `await api.prepare_credit_deposit(10.0)`

**Node:** `await api.prepareCreditDeposit(10.0)`

This attempts to open an official iClub payment/top-up flow, subject to account eligibility and minimum amount. It does **not** charge money or authorize a card transaction by itself. The returned `redirectUrl` is for the authorized user. Do not post this URL publicly.

## Registration

**Python (no login required):**

```python
async with IClub(browser_enabled=True) as api:
    await api.register(
        gym_name='Exact gym name', gender='man',
        first_name='Example', last_name='User', phone='0900000000',
        email='example@domain.test',
        accept_privacy_policy=True, accept_terms=True,
        agree_newsletter=False,
    )
```

**Node.js (static):**

```js
await IClub.register({
  gymName: 'Exact gym name', gender: 'man',
  firstName: 'Example', lastName: 'User',
  phone: '0900000000', email: 'example@domain.test',
  acceptPrivacyPolicy: true, acceptTerms: true,
  agreeNewsletter: false,
});
```

These examples show signatures only: never register fictional people or accept consent for someone who has not consented. The flow submits the site's visible form and may require email verification.

## Changing contact information or password

These are **direct SignalR writes** and do not require a browser, but can modify real account records. Do not automatically replay requests on network timeouts.
