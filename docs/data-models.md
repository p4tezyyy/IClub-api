# Data and response models

Private iClub responses are **not versioned as a public contract**. Treat all remote fields as optional, and be resilient to unknown fields or `null` values. Shapes below are based on SDK transformation code, not measured production fixtures.

## Gyms

```json
[{"id":"client-ident", "name":"Example Fitness Center"}]
```

`id` is the iClub internal client ident. Supply the `name` to `login`/`login()`; don't assume IDs from one service deployment work on another.

## Credit

`get_credit()` / `getCredit()` produces a summary based on `GetUser.Account`:

```json
{
  "balance": 25.0,
  "bonusBalance": 0.0,
  "totalBalance": 25.0,
  "topUpAllowed": true,
  "minTopUp": 5.0
}
```

All numbers above are **illustrative**; actual values may be null and are not guaranteed to be euros in every iClub deployment.

## Visit history

```json
{
  "visits": [
    {
      "transactionId": 123,
      "entryDate": "13.10.2026 10:00",
      "exitDate": "13.10.2026 11:30",
      "employee": "Reception",
      "status": "Closed"
    }
  ]
}
```

SDK status labels are `Open`, `Closed`, `Cancelled`, `Unknown` or `Status N`. Dates are displayed in the machine's local timezone, formatted `DD.MM.YYYY HH:MM`. They are presentation strings, **not** ISO timestamps. For proper calculations prefer the raw backend timestamps from `get_visits_transactions()` / `getVisitsTransactions()`.

## Calendar

```json
{
  "view": "week",
  "rangeStart": "2026-10-11T00:00:00.000Z",
  "rangeEnd": "2026-10-18T00:00:00.000Z",
  "rangeLabel": "11/10/2026 - 17/10/2026",
  "roomLabel": "All rooms",
  "upcomingMessage": "You are not assigned to any event.",
  "events": [
    {
      "id": 42,
      "title": "Example training",
      "trainer": "Example trainer",
      "time": "18:00 - 19:00",
      "startDate": "2026-10-13T18:00:00Z",
      "endDate": "2026-10-13T19:00:00Z",
      "occupancy": "5/15",
      "attendeesCount": 5,
      "capacity": 15,
      "ended": false,
      "booked": false,
      "room": "Studio",
      "day": "13.10.2026"
    }
  ]
}
```

All values are illustrative. Exact date/time formatting differs by runtime and locale. An event being shown in the calendar does not imply it is currently reservable.

## Visit detail

`get_visit_detail()` / `getVisitDetail()` maps fields including `transactionId`, `ticketType`, `billingType`, `transactionStatus`, `entryDate`, `exitDate`, `totalTime`, `loggedInBy`, `loggedOutBy`, `appliedCredit`, `totalWithVat`, `goodsServices`, and `rented`. Prices are formatted strings; use raw transaction data for financial calculations.

## Profile and dashboard

`get_profile()` / `getProfile()` includes `member`, `metrics`, `contactInfo`, `memberships`, `history`, `payments`, `creditText`, `creditDeposit`.

`get_dashboard()` / `getDashboard()` includes `title`, `member`, `hero`, `activeSession`, `metrics`, `overviewMessage`, `streakDays`, `visitsLast7Days`, `visitsLast30Days`, `insightStats`, `attendanceSeries`, `weekdayDistribution`, `occupancySeries`, `upcomingClasses`, `recentVisits`, `recentBookings`, `activityTimeline`.

The dashboard is a derived representation and may include empty placeholder arrays. **Do not claim occupancy data is live** just because the field `occupancySeries` exists.

## Raw responses

Methods named `get_user`, `get_customer_stats`, `get_available_tickets`, `get_visits_transactions`, `get_sales_transactions`, `get_transaction`, `get_customer_events`, `get_rooms` and `get_rooms_events` return backend structures rather than stable SDK DTOs. Field names use PascalCase such as `UserId`, `TransactionId`, `TotalBalance`, `EventId`.

## QR codes and write responses

`get_live_qr_code()` / `getLiveQrCode()` returns a PNG data URL. Treat it as access-sensitive material.

`reserve_event()` / `reserveEvent()` reports a UI submission, typically `{message, action, confirmed: false}`. `confirmed: false` means **no positive server-side confirmation was checked**. Never interpret it as a successfully booked class.

`prepare_credit_deposit()` / `prepareCreditDeposit()` may return `{message, redirectUrl}` for the official payment page. No payment is made by the SDK.
