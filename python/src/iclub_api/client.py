"""Async Python facade for observed iClub workflows."""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any
import unicodedata

from .transport import SignalRTransport, IClubError, AuthenticationError, guid, hash_password


def _norm(s: str) -> str:
    return " ".join("".join(c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn").split())


def _fmt_date(value: Any) -> str:
    if not value:
        return ""
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone().strftime("%d.%m.%Y %H:%M")
    except ValueError:
        return ""


def _money(value: Any) -> str:
    return f"{float(value or 0):.2f}".replace(".", ",")


def _status(value: Any) -> str:
    return {1: "Open", 2: "Closed", 3: "Cancelled"}.get(value, "Unknown" if value is None else f"Status {value}")


def _rows(raw: Any) -> list[dict]:
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        return raw.get("Transactions", []) or []
    return []


def _visit(r: dict) -> dict:
    return {"transactionId": int(r.get("TransactionId") or 0), "entryDate": _fmt_date(r.get("EntryDate")),
            "exitDate": _fmt_date(r.get("ExitDate")), "employee": str(r.get("EmployeeName") or r.get("ClosedByEmployeeName") or "Unknown"),
            "status": _status(r.get("TransactionStatus"))}


def _transaction_lines(lines: Any) -> list[dict]:
    return [{"name": str(x.get("Name") or ""), "price": _money(x["Price"]) if x.get("Price") is not None else None,
             "discount": _money(x["Discount"]) if x.get("Discount") is not None else None,
             "quantity": str(x["Quantity"]) if x.get("Quantity") is not None else None,
             "totalUnitPrice": _money(x["TotalUnitPrice"]) if x.get("TotalUnitPrice") is not None else None} for x in (lines or [])]


def _duration(raw: Any) -> str | None:
    if raw is None or raw == "":
        return None
    value = str(raw)
    if value.replace(".", "", 1).isdigit() and ":" not in value:
        seconds = max(0, int(float(value)))
        return f"{seconds // 3600:02d}:{seconds % 3600 // 60:02d}:{seconds % 60:02d}"
    if "." in value and ":" in value:
        days, time = value.split(".", 1)
        try:
            h, m, s = map(int, time.split(":"))
            return f"{int(days) * 24 + h:02d}:{m:02d}:{s:02d}"
        except ValueError:
            pass
    return value


def _date_obj(value: str | datetime | None) -> datetime:
    if isinstance(value, datetime):
        parsed = value
    elif value:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    else:
        parsed = datetime.now().astimezone()
    return parsed if parsed.tzinfo else parsed.astimezone()


def _utciso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _calendar_range(*, start: str | datetime | None = None, end: str | datetime | None = None, view: str = "week") -> tuple[datetime, datetime]:
    if view not in {"week", "month"}:
        raise ValueError("view must be 'week' or 'month'")
    d = _date_obj(start).replace(hour=0, minute=0, second=0, microsecond=0)
    if end is not None:
        e = _date_obj(end).replace(hour=0, minute=0, second=0, microsecond=0)
    elif view == "week":
        # Source app starts the week on Sunday.
        d -= timedelta(days=(d.weekday() + 1) % 7)
        e = d + timedelta(days=7)
    else:
        d = d.replace(day=1)
        d -= timedelta(days=(d.weekday() + 1) % 7)
        n = _date_obj(start)
        next_month = n.replace(day=28) + timedelta(days=4)
        month_end = next_month.replace(day=1).replace(hour=0, minute=0, second=0, microsecond=0)
        last_day = month_end - timedelta(days=1)
        e = month_end + timedelta(days=6 - ((last_day.weekday() + 1) % 7))
    if e <= d:
        raise ValueError("end must be after start")
    return d, e


class IClub:
    """One authorized account per client. All methods async; close clients when done.

    browser_enabled=True allows optional QR, registration, reservation and top-up operations.
    Browser operations re-login with the account's own credentials on first use.
    """

    def __init__(self, *, timeout: float = 20, browser_enabled: bool = False, headless: bool = True,
                 transport: SignalRTransport | None = None):
        self._transport = transport or SignalRTransport(timeout=timeout)
        self._context: dict | None = None
        self._user_id: int | None = None
        self._email = ""
        self._gym = ""
        self._password = ""  # only retained when browser fallback enabled
        self._browser_enabled = browser_enabled
        self._headless = headless
        self._browser: Any = None
        self._browser_lock = asyncio.Lock()
        self._cache: dict[str, tuple[float, Any]] = {}

    async def __aenter__(self) -> "IClub":
        return self

    async def __aexit__(self, *_):
        await self.close()

    @classmethod
    async def list_gyms(cls) -> list[dict]:
        transport = SignalRTransport()
        try:
            response = await transport.invoke("settingworkflowhub", "GetClients", [None, guid()])
            seen: set[str] = set()
            gyms: list[dict] = []

            def collect(obj: Any):
                if isinstance(obj, list):
                    for item in obj:
                        collect(item)
                elif isinstance(obj, dict):
                    ident = obj.get("ClientIdentAlias") or obj.get("Ident")
                    name = next((obj[k] for k in ("Name", "ShopName", "CompanyName", "FullDetail") if isinstance(obj.get(k), str) and obj[k].strip()), None)
                    if isinstance(ident, str) and isinstance(name, str) and ident not in seen:
                        seen.add(ident)
                        gyms.append({"id": ident.strip(), "name": name.strip()})
                    for value in obj.values():
                        collect(value)
            collect(response)
            return sorted(gyms, key=lambda item: item["name"].lower())
        finally:
            await transport.close()

    async def login(self, email: str, password: str, gym_name: str) -> dict:
        if not all([email, password, gym_name]):
            raise ValueError("email, password and gym_name are required")
        gyms = await self.list_gyms()
        gym = next((g for g in gyms if _norm(g["name"]) == _norm(gym_name)), None)
        if gym is None:
            raise IClubError("Gym not found", code="GYM_NOT_FOUND")
        ctx = {"Ident": gym["id"], "SessionId": guid(), "DefaultCulture": "en-GB"}
        user = await self._transport.invoke("authenticationworkflowhub", "Login", [ctx, guid(), email, hash_password(password), False], timeout=25)
        if not isinstance(user, dict) or not user.get("UserId"):
            raise AuthenticationError("iClub rejected credentials", code="INVALID_CREDENTIALS")
        if user.get("SessionId"):
            ctx["SessionId"] = user["SessionId"]
        self._context = ctx
        self._user_id = int(user["UserId"])
        self._email = email
        self._gym = gym_name
        self._password = password if self._browser_enabled else ""
        self.clear_cache()
        return user

    async def raw_invoke(self, hub: str, method: str, args: list[Any] | None = None, *, with_context: bool = True) -> Any:
        """Advanced escape hatch; may invoke mutating methods. Use only on your own account."""
        arguments = list(args or [])
        if with_context:
            if self._context is None:
                raise AuthenticationError("Not logged in", code="SESSION_REQUIRED")
            arguments.insert(0, self._context)
        return await self._transport.invoke(hub, method, arguments)

    async def _call(self, hub: str, method: str, *args: Any):
        return await self.raw_invoke(hub, method, [guid(), *args])

    def _id(self) -> int:
        if self._user_id is None:
            raise AuthenticationError("Not logged in", code="SESSION_REQUIRED")
        return self._user_id

    def clear_cache(self):
        self._cache.clear()

    async def _cached(self, key: str, ttl: float, make):
        import time
        old = self._cache.get(key)
        if old and old[0] > time.monotonic():
            return old[1]
        result = await make()
        self._cache[key] = (time.monotonic() + ttl, result)
        return result

    # Direct, unmodified SignalR entities
    async def get_user(self) -> dict:
        return await self._call("personworkflowhub", "GetUser", self._id())

    async def get_customer_stats(self) -> dict:
        return await self._call("personworkflowhub", "GetCustomerStats", self._id())

    async def get_available_tickets(self) -> list[dict]:
        return await self._call("ticketworkflowhub", "GetCustomerAvailableTickets", self._id(), 0, 0, False) or []

    async def get_home_page_text(self) -> str:
        value = await self._call("settingworkflowhub", "GetHomePageText")
        return str(value[0] or "") if isinstance(value, list) else str(value or "")

    async def get_visits_transactions(self, limit: int = 20) -> list[dict]:
        if not 1 <= limit <= 1000:
            raise ValueError("limit must be 1..1000")
        return _rows(await self._call("transactionworkflowhub", "GetVisitsTransactions", self._id(), 0, limit))

    async def get_sales_transactions(self, limit: int = 20) -> list[dict]:
        if not 1 <= limit <= 1000:
            raise ValueError("limit must be 1..1000")
        return _rows(await self._call("transactionworkflowhub", "GetSalesTransactions", self._id(), 0, limit))

    async def get_transaction(self, transaction_id: int | str) -> dict:
        if not str(transaction_id).isdigit() or int(transaction_id) <= 0:
            raise ValueError("transaction_id must be positive")
        return await self._call("transactionworkflowhub", "GetTransaction", str(transaction_id))

    async def get_customer_events(self, at: str | datetime | None = None) -> list[dict]:
        value = await self._call("reservationworkflowhub", "GetCustomerEvents", self._id(), _utciso(_date_obj(at)))
        return value if isinstance(value, list) else []

    async def get_rooms(self) -> list[dict]:
        value = await self._call("reservationworkflowhub", "GetRooms", 1, 0)
        return value if isinstance(value, list) else []

    async def get_rooms_events(self, start: str | datetime, end: str | datetime) -> list[dict]:
        value = await self._call("reservationworkflowhub", "GetRoomsEvents", 0, _utciso(_date_obj(start)), _utciso(_date_obj(end)))
        return value if isinstance(value, list) else []

    async def get_memberships(self) -> list[dict]:
        return await self.get_available_tickets()

    async def get_payments(self, limit: int = 20) -> list[dict]:
        return await self.get_sales_transactions(limit)

    async def get_credit(self) -> dict:
        user = await self.get_user()
        account = user.get("Account") or {}
        return {"balance": account.get("Balance"), "bonusBalance": account.get("BonusBalance"),
                "totalBalance": account.get("TotalBalance", user.get("CreditBalance")),
                "topUpAllowed": bool(user.get("CreditAccountAllowed")),
                "minTopUp": (account.get("AccountType") or {}).get("MinChargeAmount")}

    async def get_visit_history(self) -> dict:
        async def load():
            return {"visits": [v for row in await self.get_visits_transactions(20) if (v := _visit(row))["transactionId"] > 0]}
        return await self._cached("visits", 10, load)

    async def get_visit_detail(self, transaction_id: int) -> dict:
        async def load():
            tx = await self.get_transaction(transaction_id)
            ticket = tx.get("Ticket")
            return {"transactionId": int(tx.get("TransactionId") or transaction_id),
                    "ticketType": ticket if isinstance(ticket, str) else (ticket or {}).get("Name"),
                    "billingType": tx.get("Note"), "transactionStatus": _status(tx.get("TransactionStatus")),
                    "entryDate": _fmt_date(tx.get("EntryDate")), "exitDate": _fmt_date(tx.get("ExitDate")),
                    "totalTime": _duration(tx.get("Duration")), "loggedInBy": tx.get("EmployeeName"),
                    "loggedOutBy": tx.get("ClosedByEmployeeName"),
                    "appliedCredit": _money(abs(tx["CreditChange"])) if tx.get("CreditChange") is not None else None,
                    "totalWithVat": _money(tx["TotalWithVat"]) + " €" if tx.get("TotalWithVat") is not None else None,
                    "goodsServices": _transaction_lines(tx.get("GoodsList")), "rented": _transaction_lines(tx.get("RentsList"))}
        return await self._cached(f"visit-detail:{transaction_id}", 60, load)

    async def get_calendar(self, *, start: str | datetime | None = None, end: str | datetime | None = None,
                           view: str = "week") -> dict:
        d, e = _calendar_range(start=start, end=end, view=view)
        cache_key = f"calendar:{view}:{_utciso(d)}:{_utciso(e)}"

        async def load():
            booked, rooms, events = await asyncio.gather(self.get_customer_events(d), self.get_rooms(), self.get_rooms_events(d, e))
            booked_ids = {int(ev.get("EventId") or 0) for ev in booked}
            out = []
            for ev in sorted(events, key=lambda obj: obj.get("StartDate") or ""):
                start_formatted = _fmt_date(ev.get("StartDate"))
                end_formatted = _fmt_date(ev.get("EndDate"))
                out.append({"id": int(ev.get("EventId") or 0), "title": str(ev.get("Name") or "Class"),
                            "trainer": str(ev.get("TrainerName") or "Unknown trainer"),
                            "time": f"{start_formatted[-5:]} - {end_formatted[-5:]}" if start_formatted and end_formatted else "-",
                            "startDate": ev.get("StartDate"), "endDate": ev.get("EndDate"),
                            "occupancy": f"{ev.get('AttendeesCount') or 0}/{ev.get('Capacity') or 0}",
                            "attendeesCount": int(ev.get("AttendeesCount") or 0), "capacity": int(ev.get("Capacity") or 0),
                            "ended": bool(ev.get("Ended")), "booked": bool(ev.get("CurrentUserLoggedIn")) or int(ev.get("EventId") or 0) in booked_ids,
                            "color": ev.get("Color"), "fontColor": ev.get("FontColor"),
                            "room": ev.get("RoomName"), "day": start_formatted[:10]})
            return {"view": view, "rangeStart": _utciso(d), "rangeEnd": _utciso(e),
                    "rangeLabel": d.strftime("%B %Y") if view == "month" else f"{d:%d/%m/%Y} - {(e-timedelta(days=1)):%d/%m/%Y}",
                    "roomLabel": f"All rooms · {len(rooms)} available" if rooms else "All rooms", "events": out,
                    "upcomingMessage": f"You have {len(booked)} booked events in the current schedule." if booked else "You are not assigned to any event."}
        return await self._cached(cache_key, 15, load)

    async def get_event_detail(self, event_id: int, *, start: str | datetime | None = None,
                               end: str | datetime | None = None, view: str = "week") -> dict:
        d, e = _calendar_range(start=start, end=end, view=view)
        cal = await self.get_calendar(start=d, end=e, view=view)
        ev = next((x for x in cal["events"] if x["id"] == event_id), None)
        if not ev:
            raise IClubError("Event not found in supplied calendar range", code="EVENT_NOT_FOUND")
        raw = next((r for r in await self.get_rooms_events(d, e) if int(r.get("EventId") or 0) == event_id), {})
        return {"title": ev["title"], "fields": [
            {"label": "Trainer", "value": ev["trainer"]}, {"label": "Room", "value": ev["room"] or "-"},
            {"label": "Time", "value": ev["time"]}, {"label": "Day", "value": ev["day"]},
            {"label": "Occupancy", "value": ev["occupancy"]}, {"label": "Status", "value": "Ended" if ev["ended"] else "Upcoming"}
        ], "primaryActionLabel": "Reserve class" if raw.get("AddingAttendeesAllowed") and not ev["ended"] and not ev["booked"] else None}

    async def get_dashboard(self) -> dict:
        async def load():
            user, stats, tickets, home, visit_rows, sales = await asyncio.gather(
                self.get_user(), self.get_customer_stats(), self.get_available_tickets(), self.get_home_page_text(),
                self.get_visits_transactions(20), self.get_sales_transactions(10))
            visits = [_visit(v) for v in visit_rows if int(v.get("TransactionId") or 0) > 0]
            recent = [{"transactionId": v["transactionId"], "date": v["entryDate"][:10], "time": v["entryDate"][11:],
                       "employee": v["employee"], "status": v["status"], "description": v["status"]} for v in visits[:4]]
            name = user.get("FullName") or " ".join(filter(None, (user.get("FirstName"), user.get("LastName")))) or "Member"
            balance = (user.get("Account") or {}).get("TotalBalance", user.get("CreditBalance", 0))
            metrics = self._metrics(user, stats)
            latest = visits[0] if visits else None
            active = latest is not None and latest["status"] == "Open"
            recent_dates = []
            for v in visits:
                try:
                    recent_dates.append(datetime.strptime(v["entryDate"][:10], "%d.%m.%Y").date())
                except ValueError:
                    continue
            today = datetime.now().date()
            streak = 0
            unique_days = set(recent_dates)
            cursor = today if today in unique_days else today - timedelta(days=1)
            while cursor in unique_days:
                streak += 1
                cursor -= timedelta(days=1)
            return {"title": "Main panel", "member": {"name": name, "location": str(user.get("Country") or "Club member"), "loyalty": []},
                    "hero": {"heading": f"Welcome back, {str(user.get('FirstName') or name).split(' ')[0]}",
                             "subheading": "Live iClub account data", "badge": "Live Member Dashboard"},
                    "activeSession": {"isActive": active, "transactionId": latest["transactionId"] if latest else None,
                                      "entryDate": latest["entryDate"] if latest else None, "status": latest["status"] if latest else None},
                    "metrics": metrics, "overviewMessage": home.strip() or f"Live sync: {len(visits)} visits, {len(sales)} payments, {len(tickets)} memberships.",
                    "streakDays": streak,
                    "visitsLast7Days": sum(0 <= (today-d).days <= 7 for d in recent_dates),
                    "visitsLast30Days": sum(0 <= (today-d).days <= 30 for d in recent_dates),
                    "insightStats": [{"label": "Visits this month", "value": str(stats.get("CurrentMonthVisitsCount") or 0)},
                                     {"label": "Total sessions", "value": str(stats.get("TotalVisitsCount") or 0)},
                                     {"label": "Wallet credit", "value": _money(balance)},
                                     {"label": "Last check-in", "value": _fmt_date(stats.get("LastVisitDate"))}],
                    "attendanceSeries": [{"label": f"Week {i+1}", "value": sum(7*(3-i) <= (today - d).days < 7*(4-i) for d in recent_dates)} for i in range(4)],
                    "weekdayDistribution": [{"label": label, "value": sum(d.weekday() == (i-1)%7 for d in recent_dates)} for i, label in enumerate(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])],
                    "occupancySeries": [], "upcomingClasses": [],
                    "recentVisits": recent, "recentBookings": [],
                    "activityTimeline": [{"title": "Gym visit", "subtitle": v["description"], "dateLabel": v["date"], "kind": "visit"} for v in recent]}
        return await self._cached("dashboard", 10, load)

    @staticmethod
    def _metrics(user: dict, stats: dict) -> list[dict]:
        balance = (user.get("Account") or {}).get("TotalBalance", user.get("CreditBalance", 0))
        return [{"label": "valid memberships", "value": str(stats.get("ValidTicketsCount") or 0)},
                {"label": "remaining credit", "value": _money(balance)},
                {"label": "exercises this month", "value": str(stats.get("CurrentMonthVisitsCount") or 0)},
                {"label": "last visit", "value": _fmt_date(stats.get("LastVisitDate")) or "-"},
                {"label": "total exercises", "value": str(stats.get("TotalVisitsCount") or 0)}]

    async def get_profile(self) -> dict:
        async def load():
            user, stats, tickets, visits, sales = await asyncio.gather(self.get_user(), self.get_customer_stats(),
                self.get_available_tickets(), self.get_visits_transactions(20), self.get_sales_transactions(20))
            account = user.get("Account") or {}
            type_info = account.get("AccountType") or {}
            member = {"name": user.get("FullName") or " ".join(filter(None, [user.get("FirstName"), user.get("LastName")])),
                      "location": "Slovakia" if str(user.get("Country")) == "187" else str(user.get("Country") or "Club member"), "loyalty": []}
            info = {"gender": "female" if user.get("Gender") == 1 else "male", "firstName": user.get("FirstName") or "",
                    "lastName": user.get("LastName") or "", "email": user.get("Email") or "",
                    "phoneNumber": user.get("PhoneNumber") or "", "addressLine": user.get("AddressLine") or "",
                    "city": user.get("City") or "", "zipCode": user.get("ZipCode") or "", "country": member["location"],
                    "marketingConsent": bool(user.get("MarketingConsent"))}
            memberships = [[str(t.get("Name") or (t.get("Ticket") or {}).get("Name") or "Membership"),
                            str(t.get("StatusName") or t.get("Status") or "-"), _fmt_date(t.get("ValidTo") or t.get("ExpirationDate")) or "-"] for t in tickets]
            history = [_visit(r) for r in visits]
            balance = account.get("TotalBalance", user.get("CreditBalance", 0))
            minimum = type_info.get("MinChargeAmount") or 0
            return {"member": member, "metrics": self._metrics(user, stats), "contactInfo": info,
                    "memberships": {"columns": ["Name", "State", "Valid until"], "rows": memberships},
                    "history": {"columns": ["Entry", "Exit", "Employee", "Status", "Transaction"],
                                "rows": [[v["entryDate"], v["exitDate"] or "-", v["employee"], v["status"], str(v["transactionId"])] for v in history]},
                    "payments": {"columns": ["Date", "Total", "Employee", "Status", "Transaction"], "rows": [
                        [_fmt_date(p.get("EntryDate")) or "-", (_money(p["TotalWithVat"]) + " €") if p.get("TotalWithVat") is not None else "-",
                         str(p.get("EmployeeName") or p.get("ClosedByEmployeeName") or "-"), _status(p.get("TransactionStatus")),
                         str(p.get("TransactionId") or "-")] for p in sales]},
                    "creditText": "Current live credit balance: " + _money(balance),
                    "creditDeposit": {"enabled": bool(user.get("CreditAccountAllowed")), "currentBalanceText": _money(balance),
                                      "minAmount": float(minimum), "minAmountText": _money(minimum),
                                      "ctaLabel": (type_info.get("ChargeCreditGood") or {}).get("Name") or "Open top-up",
                                      "helperText": "Enter an amount and continue to the live iClub payment flow." if user.get("CreditAccountAllowed") else "Credit top-up is not enabled."}}
        return await self._cached("profile", 15, load)

    async def update_contact_information(self, *, gender: str, first_name: str, last_name: str, email: str,
                                         phone_number: str = "", address_line: str = "", city: str = "",
                                         zip_code: str = "", country: str = "Slovakia", marketing_consent: bool = False) -> dict:
        if gender not in ("male", "female") or not all([first_name, last_name, email]):
            raise ValueError("gender, first_name, last_name and email are required")
        user = await self.get_user()
        payload = {"Gender": 1 if gender == "female" else 0, "FirstName": first_name, "LastName": last_name,
                   "Email": email, "PhoneNumber": phone_number or None, "AddressLine": address_line or None,
                   "City": city or None, "ZipCode": zip_code or None, "Country": user.get("Country", 187),
                   "MarketingConsent": 1 if marketing_consent else 0, "UserId": self._id()}
        ok = await self._call("personworkflowhub", "SubmitUser", payload)
        if ok is not True:
            raise IClubError("iClub rejected contact update", code="CONTACT_UPDATE_REJECTED")
        self.clear_cache()
        return {"message": "Contact updated", "profile": await self.get_profile()}

    async def change_password(self, old_password: str, new_password: str, confirmation: str) -> dict:
        if new_password != confirmation:
            raise ValueError("Passwords do not match")
        if len(new_password) < 4:
            raise ValueError("New password too short")
        ok = await self._call("authenticationworkflowhub", "ChangePassword", self._email, hash_password(old_password), hash_password(new_password))
        if ok is not True:
            raise IClubError("Password change rejected", code="PASSWORD_CHANGE_REJECTED")
        self._password = new_password if self._browser_enabled else ""
        if self._browser:
            await self._browser.close()
            self._browser = None
        return {"message": "Password changed"}

    async def _ensure_browser(self):
        if not self._browser_enabled:
            raise IClubError("Browser support disabled. Initialize with browser_enabled=True and install browser extra.", code="BROWSER_DISABLED")
        if self._context is None:
            raise AuthenticationError("Not logged in", code="SESSION_REQUIRED")
        async with self._browser_lock:
            if self._browser is None:
                from .browser import IClubBrowser
                browser = IClubBrowser(headless=self._headless)
                try:
                    await browser.login(self._email, self._password, self._gym)
                except BaseException:
                    await browser.close()
                    raise
                self._browser = browser
        return self._browser

    async def get_live_qr_code(self) -> dict:
        return await (await self._ensure_browser()).get_live_qr_code()

    async def reset_qr_page(self):
        if self._browser:
            await self._browser.reset_qr_page()

    async def prepare_credit_deposit(self, amount: float) -> dict:
        if amount <= 0:
            raise ValueError("amount must be positive")
        user = await self.get_user()
        if not user.get("CreditAccountAllowed"):
            raise IClubError("Account does not allow top-ups", code="TOPUP_UNAVAILABLE")
        minimum = ((user.get("Account") or {}).get("AccountType") or {}).get("MinChargeAmount") or 0
        if amount < minimum:
            raise ValueError(f"Minimum top-up: {minimum}")
        return await (await self._ensure_browser()).prepare_credit_deposit(amount)

    async def reserve_event(self, event_id: int, *, start: str | datetime | None = None,
                            end: str | datetime | None = None, view: str = "week") -> dict:
        cal = await self.get_calendar(start=start, end=end, view=view)
        matches = [e for e in cal["events"] if e["id"] == event_id]
        if len(matches) != 1:
            raise IClubError("Event ID not uniquely found", code="BOOKING_EVENT_NOT_FOUND")
        ev = matches[0]
        if ev["booked"] or ev["ended"]:
            raise IClubError("Event already booked or ended", code="BOOKING_UNAVAILABLE")
        result = await (await self._ensure_browser()).reserve_event(name=ev["title"], start_date=ev["startDate"], trainer=ev["trainer"])
        self.clear_cache()
        return result

    async def register(self, *, gym_name: str, gender: str, first_name: str, last_name: str,
                       phone: str, email: str, accept_privacy_policy: bool, accept_terms: bool,
                       agree_newsletter: bool = False):
        if not self._browser_enabled:
            raise IClubError("Enable browser support for registration", code="BROWSER_DISABLED")
        from .browser import IClubBrowser
        browser = IClubBrowser(headless=self._headless)
        try:
            return await browser.register(gym_name=gym_name, gender=gender, first_name=first_name, last_name=last_name,
                                          phone=phone, email=email, accept_privacy_policy=accept_privacy_policy,
                                          accept_terms=accept_terms, agree_newsletter=agree_newsletter)
        finally:
            await browser.close()

    async def logout(self):
        if self._context:
            try:
                await self._call("authenticationworkflowhub", "Logout")
            except Exception:
                # Always dispose the transport even if iClub is unreachable.
                pass
            finally:
                self._context = None
                self._user_id = None
                self._password = ""
                self.clear_cache()
        if self._browser:
            await self._browser.close()
            self._browser = None

    async def close(self):
        try:
            await self.logout()
        finally:
            await self._transport.close()
