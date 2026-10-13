import crypto from "node:crypto";
import type { BrowserContext, Page } from "playwright";
import { BASE_URL, type IClubClientContext } from "./iclub/types.js";
import { getBrowser, getGyms } from "./iclub/browser.js";
import { getCalendar, getEventDetail } from "./iclub/calendar.js";
import { getDashboard, getProfile } from "./iclub/dashboard-profile.js";
import { getVisitDetail, getVisitHistory } from "./iclub/visits.js";
import { AppError, readVisibleIClubError } from "../utils/app-error.js";
import { logger } from "../utils/logger.js";

export class IClubBrowserClient implements IClubClientContext {
  private clientId = crypto.randomUUID();
  private log = logger.child({ scope: "iclub-client", clientId: this.clientId });
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private qrPage: Page | null = null;
  private responseCache = new Map<string, { value: unknown; expiresAt: number }>();
  private inflightRequests = new Map<string, Promise<unknown>>();
  private pageTaskQueue: Promise<unknown> = Promise.resolve();

  static async getGyms() {
    logger.debug("iclub.getGyms.start");
    return getGyms();
  }

  getClientId() {
    return this.clientId;
  }

  private async resolveGymOption(gymName: string) {
    const page = this.getPage();
    const rawTextOption = page.locator("[role='option']").filter({ hasText: gymName }).first();
    if (await rawTextOption.isVisible().catch(() => false)) {
      return rawTextOption;
    }

    const escapedGymName = gymName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const namedOption = page.getByRole("option", { name: new RegExp(escapedGymName, "i") }).first();
    if (await namedOption.isVisible().catch(() => false)) {
      return namedOption;
    }

    const fuzzyTextOption = page.locator("[role='option']").filter({ hasText: new RegExp(escapedGymName, "i") }).first();
    if (await fuzzyTextOption.isVisible().catch(() => false)) {
      return fuzzyTextOption;
    }

    return page.locator("[role='option']").filter({ hasText: gymName.split(" ").filter(Boolean)[0] }).first();
  }

  private async openSelectedGym() {
    const page = this.getPage();
    const chooseButton = page
      .locator("button, [role='button']")
      .filter({ hasText: /Choose a sport ground|Vybrať športovisko|Vyberte športovisko|Open|Otvoriť/i })
      .first();

    if (await chooseButton.isVisible().catch(() => false)) {
      await chooseButton.click();
      return;
    }

    const loginHint = page
      .locator("a, button, [role='button']")
      .filter({ hasText: /Login|Prihl[aá]siť|Sign In/i })
      .first();

    if (await loginHint.isVisible().catch(() => false)) {
      return;
    }

    const snapshot = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      buttons: Array.from(document.querySelectorAll("button, [role='button']"))
        .map((node) => (node.textContent || "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .slice(0, 12)
    }));

    this.log.warn("auth.page.open.choose-missing", snapshot);
    throw new AppError("The selected gym could not be opened from the iClub gym list.", {
      status: 502,
      code: "NFITNESS_GYM_OPEN_FAILED"
    });
  }

  private async waitForLoginPage(timeout = 20_000) {
    const page = this.getPage();
    await Promise.race([
      page.waitForURL(/#\/ucet\/prihlasenie/, { timeout }),
      page.getByRole("textbox", { name: /Email/i }).waitFor({ timeout }),
      page.locator("input[placeholder='Email']").waitFor({ timeout }),
      page.locator("input[type='email']").waitFor({ timeout })
    ]);
  }

  private async hasVisibleLoginFields() {
    const page = this.getPage();
    const candidates = [
      page.getByRole("textbox", { name: /Email/i }).first(),
      page.locator("input[placeholder='Email']").first(),
      page.locator("input[type='email']").first(),
      page.locator("input[formcontrolname='email']").first()
    ];

    for (const candidate of candidates) {
      if (await candidate.isVisible().catch(() => false)) {
        return true;
      }
    }

    return /#\/ucet\/prihlasenie/i.test(page.url());
  }

  private getEmailInput() {
    const page = this.getPage();
    return page
      .locator("input[formcontrolname='Email'], input[formcontrolname='email'], input[type='email'], input[placeholder='Email']")
      .first();
  }

  private getPasswordInput() {
    const page = this.getPage();
    return page
      .locator("input[formcontrolname='Password'], input[formcontrolname='password'], input[type='password']")
      .first();
  }

  private getLoginButton() {
    const page = this.getPage();
    return page.getByRole("button", { name: /^Login$|^Prihl[aá]siť$/i }).last();
  }

  private async tryFallbackLoginRoute(gymName: string) {
    const page = this.getPage();
    const beforeUrl = page.url();
    this.log.warn("auth.page.open.direct-login-fallback.start", { gymName, beforeUrl });
    await page.goto(`${BASE_URL}/#/ucet/prihlasenie`, { waitUntil: "domcontentloaded" });
    await this.waitForLoginPage(10_000);
    this.log.info("auth.page.open.direct-login-fallback.success", { gymName, url: page.url() });
  }

  private async openGymAuthPage(gymName: string) {
    this.log.info("auth.page.open.start", { gymName });
    const browser = await getBrowser();
    this.context = await browser.newContext();
    this.page = await this.context.newPage();

    await this.page.goto(`${BASE_URL}/#/zoznam-posilnovni`, { waitUntil: "domcontentloaded" });

    const englishButton = this.page.getByRole("button", { name: /English/i });
    if (await englishButton.isVisible().catch(() => false)) {
      await englishButton.click();
      await this.page.keyboard.press("Escape").catch(() => undefined);
      await this.page.waitForTimeout(200);
    }

    const gymPicker = this.page.locator("input[role='combobox']").first();
    await gymPicker.waitFor({ state: "visible", timeout: 10_000 });
    await gymPicker.click();
    let gymOption = await this.resolveGymOption(gymName);
    if (!(await gymOption.isVisible().catch(() => false))) {
      await gymPicker.fill(gymName);
      gymOption = await this.resolveGymOption(gymName);
    }
    await gymOption.waitFor({ timeout: 10_000 });
    await gymOption.click();
    await gymPicker.press("Enter").catch(() => undefined);
    await this.page.waitForTimeout(150);
    try {
      await this.openSelectedGym();
      await this.waitForLoginPage(20_000);
    } catch (error) {
      const currentUrl = this.page.url();
      const bodyText = await this.page.locator("body").textContent().catch(() => "");
      const isBlankShell = !bodyText?.trim();

      this.log.warn("auth.page.open.primary-path-failed", {
        gymName,
        currentUrl,
        isBlankShell
      });

      if (currentUrl === `${BASE_URL}/` || currentUrl === `${BASE_URL}` || isBlankShell) {
        await this.page.waitForTimeout(1_000);
        const secondBodyText = await this.page.locator("body").textContent().catch(() => "");
        const stillBlankShell = !secondBodyText?.trim();
        if (stillBlankShell || this.page.url() === `${BASE_URL}/` || this.page.url() === `${BASE_URL}`) {
          await this.tryFallbackLoginRoute(gymName);
        } else {
          await this.openSelectedGym();
          await this.waitForLoginPage(10_000);
        }
      } else {
        await this.tryFallbackLoginRoute(gymName);
      }

      await this.page.waitForTimeout(300);
      const loginReady = await this.hasVisibleLoginFields();
      if (!loginReady) {
        throw error;
      }
    }

    this.log.info("auth.page.open.ready", { gymName, url: this.page.url() });
  }

  async login(email: string, password: string, gymName: string) {
    this.log.info("login.start", { email, gymName });
    await this.openGymAuthPage(gymName);
    const page = this.getPage();

    const emailInput = this.getEmailInput();
    const passwordInput = this.getPasswordInput();
    await emailInput.waitFor({ state: "visible", timeout: 15_000 });
    await passwordInput.waitFor({ state: "visible", timeout: 15_000 });
    await emailInput.fill(email);
    await passwordInput.fill(password);
    const loginButton = this.getLoginButton();
    if (await loginButton.isVisible().catch(() => false)) {
      await loginButton.click();
    } else {
      await passwordInput.press("Enter");
    }
    this.log.info("login.submit.clicked", { email, gymName, url: page.url() });

    try {
      await page.waitForURL(/#\/hlavny-panel/, { timeout: 20_000 });
    } catch (error) {
      const pageError = await readVisibleIClubError(page);
      if (pageError) {
        this.log.warn("login.rejected.page-error", { email, gymName, pageError });
        throw new AppError(pageError, {
          status: 401,
          code: "NFITNESS_LOGIN_REJECTED"
        });
      }

      const stillOnLogin = /#\/ucet\/prihlasenie/i.test(page.url());
      if (stillOnLogin) {
        this.log.warn("login.rejected.still-on-login", { email, gymName, url: page.url() });
        throw new AppError("The gym account credentials were rejected. Check the selected gym, email, and password.", {
          status: 401,
          code: "NFITNESS_INVALID_CREDENTIALS"
        });
      }

      this.log.error("login.failed.unknown", { email, gymName, error });
      throw error;
    }

    await page.waitForTimeout(800);

    await Promise.race([
      page.locator(".qrcode canvas").first().waitFor({ timeout: 5_000 }),
      page.locator("text=/remaining credit|exercises this month|last visit|total exercises/i").first().waitFor({ timeout: 5_000 })
    ]).catch(() => undefined);

    this.responseCache.clear();
    this.log.info("login.success", { email, gymName });
  }

  async register({
    gymName,
    gender,
    firstName,
    lastName,
    phone,
    email,
    acceptPrivacyPolicy,
    acceptTerms,
    agreeNewsletter
  }: {
    gymName: string;
    gender: "man" | "woman";
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    acceptPrivacyPolicy: boolean;
    acceptTerms: boolean;
    agreeNewsletter: boolean;
  }) {
    this.log.info("register.start", { email, gymName, gender });
    await this.openGymAuthPage(gymName);
    const page = this.getPage();

    await page.locator("text=/Sign Up/i").last().click();
    await page.waitForURL(/#\/ucet\/registracia/, { timeout: 20_000 });

    const genderInputId = gender === "woman" ? "#mat-radio-1-input" : "#mat-radio-0-input";
    await page.locator(genderInputId).check();
    await page.locator("input[placeholder='Name']").fill(firstName);
    await page.locator("input[placeholder='Surname']").fill(lastName);
    await page.locator("input[placeholder='0912 123 456']").fill(phone);
    await page.locator("input[placeholder='Email']").fill(email);

    const checkboxes = page.locator("input[type='checkbox']");
    if (acceptPrivacyPolicy && await checkboxes.nth(0).count()) {
      await checkboxes.nth(0).check();
    }
    if (agreeNewsletter && await checkboxes.nth(1).count()) {
      await checkboxes.nth(1).check();
    }
    if (acceptTerms && await checkboxes.nth(2).count()) {
      await checkboxes.nth(2).check();
    }

    await page.getByRole("button", { name: /^Sign Up$/i }).last().click();

    try {
      await page.waitForURL(/#\/ucet\/prihlasenie/, { timeout: 20_000 });
      await page.waitForTimeout(800);
      return {
        message: "Your registration was submitted successfully. Check your email to activate the account."
      };
    } catch (error) {
      const pageError = await readVisibleIClubError(page);
      if (pageError) {
        this.log.warn("register.rejected.page-error", { email, gymName, pageError });
        throw new AppError(pageError, {
          status: 400,
          code: "NFITNESS_REGISTRATION_REJECTED"
        });
      }

      const stillOnRegistration = /#\/ucet\/registracia/i.test(page.url());
      if (stillOnRegistration) {
        this.log.warn("register.rejected.still-on-registration", { email, gymName, url: page.url() });
        throw new AppError("The registration could not be completed. Check the entered details and required consents.", {
          status: 400,
          code: "NFITNESS_REGISTRATION_REJECTED"
        });
      }

      this.log.error("register.failed.unknown", { email, gymName, error });
      throw error;
    }
  }

  async changePassword(oldPassword: string, newPassword: string, newPasswordAgain: string) {
    this.log.info("password.change.start");
    const page = await this.goto("#/hlavny-panel");
    await page.getByRole("button", { name: /Change password/i }).click();

    const dialogTitle = page.locator("text=/Change your password/i").last();
    await dialogTitle.waitFor({ timeout: 10_000 });

    const passwordInputs = page.locator("input[type='password']");
    await passwordInputs.nth(0).fill(oldPassword);
    await passwordInputs.nth(1).fill(newPassword);
    await passwordInputs.nth(2).fill(newPasswordAgain);

    await page.getByRole("button", { name: /^Change password$/i }).last().click();
    await page.waitForTimeout(1000);

    const pageError = await readVisibleIClubError(page);
    if (pageError) {
      this.log.warn("password.change.rejected.page-error", { pageError });
      throw new AppError(pageError, {
        status: 400,
        code: "NFITNESS_CHANGE_PASSWORD_REJECTED"
      });
    }

    const dialogStillVisible = await dialogTitle.isVisible().catch(() => false);
    if (dialogStillVisible) {
      this.log.warn("password.change.rejected.dialog-still-visible");
      throw new AppError("The password could not be changed. Check the entered passwords and try again.", {
        status: 400,
        code: "NFITNESS_CHANGE_PASSWORD_REJECTED"
      });
    }

    this.log.info("password.change.success");
    return {
      message: "Your password was changed successfully."
    };
  }

  async prepareCreditDeposit(amount: number) {
    const page = await this.goto("#/profil");
    const beforeUrl = page.url();
    const knownPages = new Set(this.context?.pages() ?? []);
    const addCreditTrigger = page
      .locator("a,button,[role='button']")
      .filter({ hasText: /Add credit|Dobitie kreditu|Dobitie|Credit/i })
      .first();

    await addCreditTrigger.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
    if (!(await addCreditTrigger.isVisible().catch(() => false))) {
      throw new AppError("The live top-up button is not available for this account right now.", {
        status: 409,
        code: "NFITNESS_CREDIT_TOPUP_UNAVAILABLE"
      });
    }

    await addCreditTrigger.click().catch(() => undefined);
    await page.waitForTimeout(1_500);

    const popupPage = (this.context?.pages() ?? []).find((candidate) => !knownPages.has(candidate) && !candidate.isClosed()) ?? null;
    const targetPage = popupPage ?? page;

    const amountInput = targetPage
      .locator("input[type='number'], input[inputmode='decimal'], input[formcontrolname*='amount' i], input[placeholder*='amount' i]")
      .first();

    if (await amountInput.isVisible().catch(() => false)) {
      await amountInput.fill(String(amount).replace(",", "."));
      const continueButton = targetPage
        .locator("button, [role='button'], a")
        .filter({ hasText: /Continue|Next|Pay|Proceed|Top up|Dobitie|Add credit/i })
        .first();
      if (await continueButton.isVisible().catch(() => false)) {
        await continueButton.click().catch(() => undefined);
        await targetPage.waitForTimeout(1_500);
      }
    }

    const redirectUrl = targetPage.url();
    if (!redirectUrl || redirectUrl === beforeUrl) {
      throw new AppError("The live top-up flow could not be opened automatically. Please try again in the source app.", {
        status: 502,
        code: "NFITNESS_CREDIT_TOPUP_FLOW_UNAVAILABLE",
        retryable: true
      });
    }

    return {
      message: "The live top-up flow was opened in the official iClub payment page.",
      redirectUrl
    };
  }

  async dispose() {
    this.log.info("client.dispose.start");
    await this.qrPage?.close().catch(() => undefined);
    await this.context?.close();
    this.context = null;
    this.page = null;
    this.qrPage = null;
    this.responseCache.clear();
    this.inflightRequests.clear();
    this.log.info("client.dispose.finish");
  }

  getPage() {
    if (!this.page) {
      throw new Error("Browser session is not initialized.");
    }
    return this.page;
  }

  async goto(hashPath: string) {
    const page = this.getPage();
    this.log.debug("page.goto.start", { hashPath });
    await page.goto(`${BASE_URL}/${hashPath}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(3000);
    this.log.debug("page.goto.finish", { hashPath, url: page.url() });
    return page;
  }

  clearCache(prefix?: string) {
    if (!prefix) {
      this.responseCache.clear();
      return;
    }

    for (const key of this.responseCache.keys()) {
      if (key.startsWith(prefix)) {
        this.responseCache.delete(key);
      }
    }
  }

  async withCache<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const cached = this.responseCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      this.log.debug("cache.hit", { key, ttlMs });
      return cached.value as T;
    }

    const inflight = this.inflightRequests.get(key);
    if (inflight) {
      this.log.debug("cache.inflight-reuse", { key });
      return inflight as Promise<T>;
    }

    this.log.debug("cache.miss", { key, ttlMs });
    const request = loader()
      .then((value) => {
        this.responseCache.set(key, { value, expiresAt: Date.now() + ttlMs });
        this.log.debug("cache.store", { key, ttlMs });
        return value;
      })
      .finally(() => {
        this.inflightRequests.delete(key);
      });

    this.inflightRequests.set(key, request);
    return request;
  }

  async runWithPageLock<T>(taskName: string, task: () => Promise<T>): Promise<T> {
    const run = async () => {
      this.log.debug("page.lock.start", { taskName });
      try {
        return await task();
      } finally {
        this.log.debug("page.lock.finish", { taskName });
      }
    };

    const queued = this.pageTaskQueue.then(run, run);
    this.pageTaskQueue = queued.catch(() => undefined);
    return queued;
  }

  async extractQrCodeDataUrlFrom(page: Page) {
    return page.evaluate(() => {
      const canvas = document.querySelector(".qrcode canvas") as HTMLCanvasElement | null;
      return canvas ? canvas.toDataURL("image/png") : undefined;
    }).catch(() => undefined);
  }

  async getQrPage() {
    if (this.qrPage && !this.qrPage.isClosed()) {
      this.log.debug("qr.page.reuse");
      return this.qrPage;
    }

    if (!this.context) {
      throw new Error("Browser context is not initialized.");
    }

    this.qrPage = await this.context.newPage();
    await this.qrPage.goto(`${BASE_URL}/#/hlavny-panel`, { waitUntil: "domcontentloaded" });
    await this.qrPage.waitForTimeout(250);
    this.log.debug("qr.page.created");
    return this.qrPage;
  }

  async warmLiveQr() {
    const page = await this.getQrPage();
    await this.extractQrCodeDataUrlFrom(page).catch(() => undefined);
  }

  async resetQrPage() {
    if (this.qrPage && !this.qrPage.isClosed()) {
      await this.qrPage.close().catch(() => undefined);
    }
    this.qrPage = null;
    this.log.warn("qr.page.reset");
  }

  async getLiveQrCode() {
    const page = await this.getQrPage();
    const qrCodeDataUrl = await this.extractQrCodeDataUrlFrom(page);
    return { qrCodeDataUrl };
  }

  async getDashboard() {
    return this.runWithPageLock("dashboard", () => getDashboard(this));
  }

  async getVisitHistory() {
    return this.runWithPageLock("visits", () => getVisitHistory(this));
  }

  async getVisitDetail(transactionId: number) {
    return this.runWithPageLock(`visit-detail:${transactionId}`, () => getVisitDetail(this, transactionId));
  }

  async getProfile() {
    return this.runWithPageLock("profile", () => getProfile(this));
  }

  async getCalendar() {
    return this.runWithPageLock("calendar", () => getCalendar(this));
  }

  async getEventDetail(eventId: number) {
    return this.runWithPageLock(`event-detail:${eventId}`, () => getEventDetail(this, eventId));
  }

  /** Match by title/time/trainer, never by remote EventId as a DOM array index. */
  async reserveEventByMatch(event: { title: string; startDate: string; trainer?: string }) {
    return this.runWithPageLock("reserve:matched", async () => {
      const page = await this.goto("#/rezervacie/rozvrh");
      const start = new Date(event.startDate);
      if (Number.isNaN(start.getTime())) throw new AppError("Invalid class start time", { status: 400, code: "ICLUB_EVENT_DATE_INVALID" });
      const expectedTime = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
      const locators = page.locator(".fc-event");
      const matched = [];
      for (let i = 0; i < await locators.count(); i++) {
        const candidate = locators.nth(i);
        if (!await candidate.isVisible().catch(() => false)) continue;
        const description = (await candidate.innerText()).replace(/\s+/g, " ").trim().toLowerCase();
        if (description.includes(event.title.trim().toLowerCase()) && description.includes(expectedTime)
          && (!event.trainer || description.includes(event.trainer.trim().toLowerCase()))) matched.push(candidate);
      }
      if (matched.length !== 1) throw new AppError(`Expected exactly one matching class; found ${matched.length}. No booking performed.`, {
        status: 409, code: "ICLUB_BOOKING_EVENT_AMBIGUOUS"
      });
      await matched[0].click();
      const dialog = page.getByRole("dialog");
      await dialog.waitFor({ timeout: 10_000 });
      const buttons = dialog.getByRole("button");
      const eligible = [];
      for (let i = 0; i < await buttons.count(); i++) {
        const button = buttons.nth(i);
        const label = (await button.innerText()).trim();
        if (!await button.isDisabled() && /reserve|book|rezerv/i.test(label) && !/cancel|zruš/i.test(label)) {
          eligible.push({ button, label });
        }
      }
      if (eligible.length !== 1) throw new AppError("Reservation action not uniquely available", {
        status: 409, code: "ICLUB_BOOKING_UNAVAILABLE"
      });
      await eligible[0].button.click();
      return { message: "Reservation action submitted", action: eligible[0].label, confirmed: false };
    });
  }

  async reserveEvent(_eventId: number) {
    throw new AppError("Use reserveEventByMatch; array-index bookings are unsafe.", { status: 409, code: "ICLUB_UNSAFE_BOOKING_DISABLED" });
  }
}
