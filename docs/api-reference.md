# Complete public API reference

Methods here are from the current source code, **not** inferred iClub backend capabilities. All network methods are asynchronous. The JavaScript class is `IClub` (camelCase); Python is `IClub` (snake_case).

## Club discovery and authentication

| Python signature | Node.js / TypeScript | Returns / behavior |
|---|---|---|
| `await IClub.list_gyms()` | `await IClub.listGyms()` | `[{id, name}, ...]` gym choices, no session required |
| `await api.login(email, password, gym_name)` | `await api.login(email, password, gymName)` | Authenticates; Python returns backend user, Node returns login result / void |
| `await api.logout()` | `await api.logout()` | Logs out and closes session (Node also disposes its connection) |
| `await api.close()` | `await api.close()` | Releases resources; both languages support this |
| `api.clear_cache()` | — | Python-only manual cache invalidation |

Python constructor: `IClub(*, timeout=20, browser_enabled=False, headless=True, transport=None)`.

Node constructor: `new IClub()` (no public constructor options).

Python also has `await api.list_gyms()` through the classmethod. Node supports `await api.listGyms()` as an instance alias.

## Account and membership (read-only)

| Python | Node.js | Returns / notes |
|---|---|---|
| `get_user()` | `getUser()` | Raw backend user account object |
| `get_customer_stats()` | `getCustomerStats()` | Raw stats |
| `get_available_tickets()` | `getAvailableTickets()` | Raw available tickets / memberships |
| `get_memberships()` | `getMemberships()` | Alias of available tickets |
| `get_home_page_text()` | `getHomePageText()` | Configured club notice / homepage text |
| `get_credit()` | `getCredit()` | Account balance, bonus balance, total, top-up eligibility and minimum |
| `get_profile()` | `getProfile()` | Composite member, contact info, metrics, memberships, visits, payments, credit settings |
| `get_dashboard()` | `getDashboard()` | Composite dashboard: active session, metrics, trends and recent activities |

## Visits and transactions (read-only)

| Python | Node.js | Returns / notes |
|---|---|---|
| `get_visits_transactions(limit=20)` | `getVisitsTransactions(limit = 20)` | Raw visit transactions, bounded in Python to 1–1000 |
| `get_sales_transactions(limit=20)` | `getSalesTransactions(limit = 20)` | Raw sales/purchase transactions |
| `get_payments(limit=20)` | `getPayments(limit = 20)` | Alias of sales transactions, **not a payment gateway** |
| `get_transaction(transaction_id)` | `getTransaction(id)` | Raw transaction detail |
| `get_visit_history()` | `getVisitHistory()` | `{visits: [...mapped records]}` |
| `get_visit_detail(transaction_id)` | `getVisitDetail(id)` | Composite visit detail, durations, charges, lines and rental lines |

Transaction IDs come from your own response data. Never guess another member's transaction IDs.

## Calendar and room data (read-only)

| Python | Node.js | Returns / notes |
|---|---|---|
| `get_customer_events(at=None)` | `getCustomerEvents(at = new Date())` | Raw user reservations for a point in time |
| `get_rooms()` | `getRooms()` | Raw list of gym rooms |
| `get_rooms_events(start, end)` | `getRoomsEvents(startIso, endIso)` | Raw events in time window |
| `get_calendar(*, start=None, end=None, view='week')` | `getCalendar({start?, end?, view?})` | Composite calendar with `events`, `rangeStart`/`rangeEnd`, `view` |
| `get_event_detail(id, *, start=None, end=None, view='week')` | `getEventDetail(id, {start?, end?, view?})` | Event detail from selected calendar range |

`view` is `week` or `month`. Defaults to the current week starting Sunday. For a specific class in another week, pass explicit `start` and `end`. Python accepts ISO 8601 string or timezone-aware `datetime`; Node expects date strings for start/end.

**Date boundary note:** The library serializes internal ranges to UTC. Timezones, DST changes and local clock output depend on the process/system timezone; test with your gym's time zone.

## User writes (changes data)

| Python | Node.js | Effect |
|---|---|---|
| `update_contact_information(*, gender, first_name, last_name, email, phone_number='', address_line='', city='', zip_code='', country='Slovakia', marketing_consent=False)` | `updateContactInformation({gender, firstName, lastName, email, phoneNumber, addressLine, city, zipCode, country, marketingConsent})` | Submits contact record to iClub |
| `change_password(old_password, new_password, confirmation)` | `changePassword(oldPassword, newPassword, confirmation)` | Changes password |
| `reserve_event(event_id, *, start=None, end=None, view='week')` | `reserveEvent(eventId, {start?, end?, view?})` | Attempts UI reservation after unique event check; **not confirmed** |
| `prepare_credit_deposit(amount)` | `prepareCreditDeposit(amount)` | Opens/prepares official payment page, **no payment executed** |
| `register(*, gym_name, gender, first_name, last_name, phone, email, accept_privacy_policy, accept_terms, agree_newsletter=False)` | `IClub.register({gymName, gender, firstName, lastName, phone, email, acceptPrivacyPolicy, acceptTerms, agreeNewsletter?})` | Submits sign-up through web UI |

Python `register` requires an `IClub(browser_enabled=True)` instance but does not require prior login; Node `register` is a **static class method**. Python contact `gender`: `male`/`female`; Python registration `gender`: `man`/`woman`; Node registration: `man`/`woman`; Node contact: `male`/`female`.

**These write methods have real account effects and are not safe for indiscriminate retries.** Booking can be submitted successfully even if no final confirmation has been observed.

## QR and browser helpers

| Python | Node.js | Notes |
|---|---|---|
| `get_live_qr_code()` | `getLiveQrCode()` | Returns `{qrCodeDataUrl: 'data:image/png;base64,...'}`; highly sensitive |
| `reset_qr_page()` | `resetQrPage()` | Clears/reinitializes QR browser page |

Browser methods need Playwright and Chromium. Python requires `browser_enabled=True` when constructing the client. The QR image is **not** a signed API access token; do not publish it.

## Advanced SignalR API

| Python | Node.js | Purpose |
|---|---|---|
| `raw_invoke(hub, method, args=None, *, with_context=True)` | `rawInvoke(hub, method, args = [], withContext = true)` | Invoke named SignalR method and return unmodified backend result |

When `with_context=True`, the SDK adds the currently authenticated context **as the first argument**. Include only method-specific arguments in `args`. Setting it to false skips the context; supply any necessary context yourself. These calls can mutate account state. Undocumented method signatures may be unsafe and are not guaranteed.

For the precise implemented SignalR method names see [architecture](architecture.md). For response models see [data models](data-models.md).
