import { BASE_URL, GYMS_CACHE_TTL_MS } from "./types.js";
import { logger } from "../../utils/logger.js";
let sharedBrowser = null;
let gymsCache = null;
let gymsInflight = null;
const log = logger.child({ scope: "iclub-browser" });
function resolveHeadlessMode() {
    if (process.env.PLAYWRIGHT_HEADLESS === "false") {
        return false;
    }
    return true;
}
export async function getBrowser() {
    if (!sharedBrowser) {
        log.info("browser.launch.start", { headless: resolveHeadlessMode() });
        const { chromium } = await import("playwright").catch(() => {
            throw new Error("Install the optional browser dependency: npm install playwright; npx playwright install chromium");
        });
        sharedBrowser = await chromium.launch({
            headless: resolveHeadlessMode()
        });
        log.info("browser.launch.success");
    }
    return sharedBrowser;
}
export async function getGyms() {
    if (gymsCache && gymsCache.expiresAt > Date.now()) {
        log.debug("gyms.cache.hit", { count: gymsCache.gyms.length });
        return gymsCache.gyms;
    }
    if (gymsInflight) {
        log.debug("gyms.inflight.reuse");
        return gymsInflight;
    }
    gymsInflight = loadGyms().finally(() => {
        gymsInflight = null;
    });
    return gymsInflight;
}
async function loadGyms() {
    const browser = await getBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();
    const startedAt = Date.now();
    try {
        log.info("gyms.scrape.start");
        await page.goto(`${BASE_URL}/#/zoznam-posilnovni`, {
            waitUntil: "domcontentloaded",
            timeout: 30_000
        });
        const englishButton = page.getByRole("button", { name: /English/i });
        if (await englishButton.isVisible().catch(() => false)) {
            await englishButton.click();
            await page.keyboard.press("Escape").catch(() => undefined);
        }
        const gymPicker = page.locator("input[role='combobox']").first();
        await gymPicker.waitFor({ state: "visible", timeout: 10_000 });
        await gymPicker.click();
        await Promise.race([
            page.getByRole("listbox").waitFor({ timeout: 10_000 }),
            page.waitForFunction(() => document.querySelectorAll("[role='option']").length > 0, undefined, { timeout: 10_000 })
        ]);
        const gyms = await page.evaluate(() => {
            const options = Array.from(document.querySelectorAll("[role='option']"));
            return options
                .map((option, index) => {
                const name = (option.textContent || "").replace(/\s+/g, " ").trim();
                if (!name) {
                    return null;
                }
                return {
                    id: `${index}-${name.toLowerCase()}`,
                    name
                };
            })
                .filter((gym) => Boolean(gym));
        });
        gymsCache = {
            gyms,
            expiresAt: Date.now() + GYMS_CACHE_TTL_MS
        };
        log.info("gyms.scrape.success", { count: gyms.length, durationMs: Date.now() - startedAt });
        return gyms;
    }
    catch (error) {
        log.error("gyms.scrape.failed", { durationMs: Date.now() - startedAt, error });
        throw error;
    }
    finally {
        await context.close();
    }
}
export async function warmGymCache() {
    try {
        await getGyms();
    }
    catch (error) {
        log.warn("gyms.warmup.failed", { error });
    }
}
