# Python client

## Initialize and authenticate

```python
import asyncio, os
from iclub_api import IClub, IClubError, AuthenticationError, TransportError

async def main():
    async with IClub(timeout=20, browser_enabled=False) as api:
        await api.login(os.environ['ICLUB_EMAIL'], os.environ['ICLUB_PASSWORD'], os.environ['ICLUB_GYM'])
        profile = await api.get_profile()
        print(profile['member']['name'])

asyncio.run(main())
```

`IClub(timeout=20, browser_enabled=False, headless=True, transport=None)` creates a client with a SignalR transport. By default, it uses **no browser**, and stores the password only during `login` rather than retaining it for browser login. Pass `browser_enabled=True` **before** login when you need browser operations (this retains credentials in process memory for subsequent browser login). `headless=False` can help diagnose UI changes.

`async with IClub(...) as api` closes the connection, session and browser on exit. You can also call `await api.logout()` then `await api.close()`.

## Accounts, credit and history

```python
async with IClub() as api:
    await api.login(email, password, gym)
    print(await api.get_user())
    print(await api.get_customer_stats())
    print(await api.get_memberships())
    print(await api.get_credit())
    print(await api.get_visit_history())
    print(await api.get_payments(limit=20))
    print(await api.get_visit_detail(123))
    print(await api.get_dashboard())
```

IDs such as `123` are examples, not real transaction IDs. Use IDs returned by the account's own visit records.

## Calendar and reservation preview

```python
async with IClub() as api:
    await api.login(email, password, gym)
    calendar = await api.get_calendar(start='2026-10-11', end='2026-10-18')
    for event in calendar['events']:
        print(event['id'], event['title'], event['time'], event['booked'])
    if calendar['events']:
        event_id = calendar['events'][0]['id']
        print(await api.get_event_detail(event_id, start='2026-10-11', end='2026-10-18'))
```

Dates here are illustrative. Supply current dates when using in production. A weekly calendar starts Sunday by default; you can pass `view='month'` or a custom range. Booking requires `browser_enabled=True` and Chromium; see [browser guide](browser-features.md).

## Contact update (write operation)

```python
await api.update_contact_information(
    gender='male', first_name='Example', last_name='User',
    email='example@domain.test', phone_number='', address_line='',
    city='', zip_code='', country='Slovakia', marketing_consent=False
)
```

Only call with complete, intended values: the SDK submits all listed contact fields. The `country` parameter is currently accepted for compatibility, but the implementation uses the account's existing `Country` field rather than writing the supplied string.

## Change password

```python
await api.change_password(old_password, new_password, new_password)
```

This changes your iClub account credentials. Avoid logging them; reauthenticate if the server invalidates your session.

## Browser operations

```python
async with IClub(browser_enabled=True, headless=True) as api:
    await api.login(email, password, gym)
    qr = await api.get_live_qr_code()
    # qr['qrCodeDataUrl'] contains a *sensitive* PNG data URL
    await api.reset_qr_page()
```

See [QR and browser flows](browser-features.md) for registration, top-up and booking. All browser features require `pip install 'iclub_api[browser]'` and `python -m playwright install chromium`.

## Errors

```python
try:
    await api.get_credit()
except AuthenticationError as error:
    print('Sign-in needed:', error.code)
except TransportError as error:
    print('Connection issue:', error.code, 'retryable?', error.retryable)
except IClubError as error:
    print('iClub error:', error.code)
```

The Python exception hierarchy is `AuthenticationError(IClubError)` and `TransportError(IClubError)`. `ValueError` is raised for some bad local arguments. Don't automatically retry write operations such as reservations, contact updates or top-ups.
