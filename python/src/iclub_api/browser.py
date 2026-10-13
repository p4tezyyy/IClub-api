"""Optional Playwright support for functions not covered by the observed hubs."""
from __future__ import annotations

import asyncio
import re
from datetime import datetime
from typing import Any
from .transport import BASE_URL, IClubError


def _visible_error(page):
    return page.locator("[role='alert'], .mat-mdc-snack-bar-label, .mat-mdc-form-field-error, .toast-message").first


class IClubBrowser:
    def __init__(self, *, headless: bool = True):
        self.headless = headless
        self._playwright: Any = None
        self._browser: Any = None
        self._context: Any = None
        self._page: Any = None
        self._qr_page: Any = None
        self._lock = asyncio.Lock()

    async def _start(self):
        try:
            from playwright.async_api import async_playwright
        except ImportError as exc:
            raise IClubError("Install the optional browser extra: pip install iclub_api[browser]", code="BROWSER_MISSING") from exc
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(headless=self.headless)
        self._context = await self._browser.new_context()
        self._page = await self._context.new_page()
        await self._page.goto(BASE_URL + "/#/zoznam-posilnovni", wait_until="domcontentloaded")
        english = self._page.get_by_role("button", name=re.compile("English", re.I))
        if await english.is_visible():
            await english.click()
            await self._page.keyboard.press("Escape")
        return self._page

    async def _select_gym(self, name: str):
        page = self._page
        picker = page.locator("input[role='combobox']").first
        await picker.wait_for(state="visible", timeout=15000)
        await picker.click()
        option = page.get_by_role("option", name=name, exact=True)
        if await option.count() != 1:
            await picker.fill(name)
            option = page.get_by_role("option", name=name, exact=True)
        if await option.count() != 1:
            raise IClubError("Gym option is missing or ambiguous", code="GYM_AMBIGUOUS")
        await option.first.wait_for(state="visible", timeout=15000)
        await option.first.click()
        choose = page.locator("button, [role='button']").filter(has_text=re.compile("Choose a sport ground|Vybrať športovisko|Open|Otvoriť", re.I)).first
        if await choose.is_visible():
            await choose.click()
        try:
            await page.locator("input[type='password']").first.wait_for(state="visible", timeout=20000)
        except Exception:
            # Preserve gym selection from the preceding flow; no fallback if it was not established.
            raise IClubError("Gym authentication page did not load", code="BROWSER_GYM_NAVIGATION_FAILED")
        return page

    async def login(self, email: str, password: str, gym_name: str):
        if self._context:
            await self.close()
        page = await self._start()
        await self._select_gym(gym_name)
        await page.locator("input[formcontrolname='Email'], input[formcontrolname='email'], input[type='email'], input[placeholder='Email']").first.fill(email)
        password_input = page.locator("input[type='password']").first
        await password_input.fill(password)
        login = page.get_by_role("button", name=re.compile(r"^(Login|Prihlásiť)$", re.I)).last
        if await login.is_visible():
            await login.click()
        else:
            await password_input.press("Enter")
        try:
            await page.wait_for_url(re.compile("#/hlavny-panel"), timeout=20000)
        except Exception as exc:
            raise IClubError("iClub browser login was rejected or page changed", code="BROWSER_LOGIN_FAILED") from exc

    async def get_live_qr_code(self) -> dict[str, Any]:
        if self._context is None:
            raise IClubError("Browser not authenticated", code="BROWSER_NOT_AUTHENTICATED")
        async with self._lock:
            if self._qr_page is None or self._qr_page.is_closed():
                self._qr_page = await self._context.new_page()
                await self._qr_page.goto(BASE_URL + "/#/hlavny-panel", wait_until="domcontentloaded")
            await self._qr_page.locator(".qrcode canvas").first.wait_for(state="visible", timeout=15000)
            data = await self._qr_page.locator(".qrcode canvas").first.evaluate("canvas => canvas.toDataURL('image/png')")
            return {"qrCodeDataUrl": data}

    async def reset_qr_page(self):
        if self._qr_page and not self._qr_page.is_closed():
            await self._qr_page.close()
        self._qr_page = None

    async def prepare_credit_deposit(self, amount: float) -> dict[str, str]:
        if not self._page:
            raise IClubError("Browser not authenticated", code="BROWSER_NOT_AUTHENTICATED")
        async with self._lock:
            page = self._page
            await page.goto(BASE_URL + "/#/profil", wait_until="domcontentloaded")
            previous = page.url
            pages = set(self._context.pages)
            trigger = page.locator("a,button,[role='button']").filter(has_text=re.compile(r"Add credit|Dobitie kreditu|Dobitie|Credit", re.I)).first
            if not await trigger.is_visible():
                raise IClubError("Account credit top-up button not available", code="TOPUP_UNAVAILABLE")
            await trigger.click()
            await page.wait_for_timeout(1000)
            popup = next((p for p in self._context.pages if p not in pages and not p.is_closed()), None)
            target = popup or page
            amount_input = target.locator("input[type='number'], input[inputmode='decimal'], input[formcontrolname*='amount' i], input[placeholder*='amount' i]").first
            if await amount_input.is_visible():
                await amount_input.fill(str(amount))
                cont = target.locator("button, [role='button'], a").filter(has_text=re.compile("Continue|Next|Pay|Proceed|Top up|Dobitie|Add credit", re.I)).first
                if await cont.is_visible():
                    await cont.click()
                    await target.wait_for_timeout(1200)
            url = target.url
            if url == previous:
                raise IClubError("No payment redirect was detected", code="TOPUP_FLOW_UNAVAILABLE")
            return {"message": "Opened official iClub top-up flow; no payment made by SDK", "redirectUrl": url}

    async def reserve_event(self, *, name: str, start_date: str, trainer: str | None = None) -> dict[str, Any]:
        """Fail closed unless calendar DOM identifies exactly one matching event."""
        if not self._page:
            raise IClubError("Browser not authenticated", code="BROWSER_NOT_AUTHENTICATED")
        if not name or not start_date:
            raise ValueError("Both event name and start_date are required")
        async with self._lock:
            page = self._page
            await page.goto(BASE_URL + "/#/rezervacie/rozvrh", wait_until="domcontentloaded")
            await page.locator(".fc-event, [class*='fc-event']").first.wait_for(timeout=10000)
            expected = datetime.fromisoformat(start_date.replace("Z", "+00:00")).strftime("%H:%M")
            events = page.locator(".fc-event")
            matches = []
            for i in range(await events.count()):
                element = events.nth(i)
                if not await element.is_visible():
                    continue
                value = " ".join((await element.inner_text()).split())
                if name.casefold() in value.casefold() and expected in value and (not trainer or trainer.casefold() in value.casefold()):
                    matches.append(element)
            if len(matches) != 1:
                raise IClubError(f"Expected one matching calendar event, found {len(matches)}; booking cancelled", code="BOOKING_EVENT_AMBIGUOUS")
            await matches[0].click()
            dialog = page.get_by_role("dialog")
            await dialog.wait_for(timeout=10000)
            buttons = dialog.get_by_role("button")
            eligible = []
            for i in range(await buttons.count()):
                b = buttons.nth(i)
                label = " ".join((await b.inner_text()).split())
                if await b.is_enabled() and re.search(r"reserve|book|rezerv", label, re.I) and not re.search(r"cancel|zruš", label, re.I):
                    eligible.append((b, label))
            if len(eligible) != 1:
                raise IClubError("No unique explicit reservation action; booking cancelled", code="BOOKING_UNAVAILABLE")
            await eligible[0][0].click()
            return {"message": "Reservation action submitted", "action": eligible[0][1], "confirmed": False}

    async def register(self, *, gym_name: str, gender: str, first_name: str, last_name: str, phone: str, email: str,
                       accept_privacy_policy: bool, accept_terms: bool, agree_newsletter: bool = False):
        if not accept_privacy_policy or not accept_terms:
            raise ValueError("Required consent must be explicitly granted")
        if gender not in ("man", "woman"):
            raise ValueError("gender must be 'man' or 'woman'")
        page = await self._start()
        await self._select_gym(gym_name)
        await page.get_by_text(re.compile("Sign Up", re.I)).last.click()
        await page.wait_for_url(re.compile("#/ucet/registracia"), timeout=20000)
        await page.locator("#mat-radio-1-input" if gender == "woman" else "#mat-radio-0-input").check()
        await page.locator("input[placeholder='Name']").fill(first_name)
        await page.locator("input[placeholder='Surname']").fill(last_name)
        await page.locator("input[placeholder='0912 123 456']").fill(phone)
        await page.locator("input[placeholder='Email']").fill(email)
        checkboxes = page.locator("input[type='checkbox']")
        await checkboxes.nth(0).check()
        if agree_newsletter:
            await checkboxes.nth(1).check()
        await checkboxes.nth(2).check()
        await page.get_by_role("button", name=re.compile("^Sign Up$", re.I)).last.click()
        await page.wait_for_url(re.compile("#/ucet/prihlasenie"), timeout=20000)
        return {"message": "Registration submitted. Verify email if requested by iClub."}

    async def close(self):
        if self._context:
            await self._context.close()
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
        self._context = self._browser = self._playwright = self._page = self._qr_page = None
