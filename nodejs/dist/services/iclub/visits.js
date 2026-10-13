import { VISIT_DETAIL_CACHE_TTL_MS, VISITS_CACHE_TTL_MS } from "./types.js";
import { logger } from "../../utils/logger.js";
const log = logger.child({ scope: "iclub-visits" });
export async function scrapeVisitHistory(client, limit = 10) {
    const page = await client.goto("#/profil");
    await page.waitForFunction(() => /(Client profile|Memberships|History|Payments)/i.test(document.body.innerText || ""), undefined, { timeout: 12_000 }).catch(() => undefined);
    await page.waitForTimeout(5000);
    const historyTab = page.getByRole("tab", { name: /History/i }).first();
    await historyTab.waitFor({ state: "visible", timeout: 10_000 }).catch(() => undefined);
    await historyTab.click().catch(() => undefined);
    await page.waitForFunction(() => Array.from(document.querySelectorAll("[role='row']")).some((row) => row.querySelectorAll("[role='cell']").length >= 5), undefined, { timeout: 12_000 }).catch(() => undefined);
    await page.waitForTimeout(5000);
    const visits = await page.evaluate((maxItems) => {
        const lines = (document.body.innerText || "")
            .split(/\r?\n/)
            .map((line) => line.replace(/\s+/g, " ").trim())
            .filter(Boolean);
        const startIndex = lines.findIndex((line) => line === "Entry");
        const endIndex = lines.findIndex((line, index) => index > startIndex && /^Items per page$/i.test(line));
        const values = startIndex >= 0 ? lines.slice(startIndex + 5, endIndex === -1 ? undefined : endIndex) : [];
        const transactionIds = Array.from(document.querySelectorAll("a[href*='/transakcie/']"))
            .map((anchor) => Number(anchor.getAttribute("href")?.match(/\/transakcie\/(\d+)/)?.[1] || "0"))
            .filter((id) => id > 0);
        const rows = [];
        for (let index = 0; index + 4 < values.length && rows.length < maxItems; index += 5) {
            const chunk = values.slice(index, index + 5);
            if (!chunk[0] || !chunk[1] || !chunk[2] || !chunk[3]) {
                continue;
            }
            const transactionId = transactionIds[rows.length] || 0;
            if (!transactionId) {
                continue;
            }
            rows.push({
                transactionId,
                entryDate: chunk[0],
                exitDate: chunk[1],
                employee: chunk[2],
                status: chunk[3]
            });
        }
        return rows;
    }, limit);
    log.debug("visits.scraped", { url: page.url(), count: visits.length, first: visits[0] ?? null });
    return visits;
}
export async function getVisitHistory(client) {
    return client.withCache("visits", VISITS_CACHE_TTL_MS, async () => {
        const visits = await scrapeVisitHistory(client, 20);
        return { visits };
    });
}
export async function getVisitDetail(client, transactionId) {
    return client.withCache(`visit-detail:${transactionId}`, VISIT_DETAIL_CACHE_TTL_MS, async () => {
        const page = await client.goto(`#/transakcie/${transactionId}`);
        await page.waitForTimeout(500);
        return page.evaluate(({ id }) => {
            const normalize = (value) => (value || "").replace(/\s+/g, " ").trim();
            const lines = (document.body.innerText || "").split(/\r?\n/).map((line) => normalize(line)).filter(Boolean);
            const normalizedHeaders = ["name", "price", "discount", "quantity", "total unit price"];
            const normalizeLabel = (value) => normalize(value).replace(/:$/, "").toLowerCase();
            const readValueAfter = (label, occurrence = 1) => {
                let seen = 0;
                const normalizedLabel = normalizeLabel(label);
                for (let index = 0; index < lines.length; index += 1) {
                    if (normalizeLabel(lines[index]) !== normalizedLabel) {
                        continue;
                    }
                    seen += 1;
                    if (seen !== occurrence) {
                        continue;
                    }
                    return lines[index + 1] || undefined;
                }
                return undefined;
            };
            const readPrefixedValue = (prefix) => {
                const normalizedPrefix = normalizeLabel(prefix);
                const match = lines.find((line) => normalizeLabel(line).startsWith(normalizedPrefix));
                if (!match) {
                    return undefined;
                }
                return normalize(match.replace(new RegExp(`^${prefix}\\s*:?\\s*`, "i"), "")) || undefined;
            };
            const readSectionRows = (sectionTitle, stopTitles) => {
                const startIndex = lines.findIndex((line) => normalizeLabel(line) === normalizeLabel(sectionTitle));
                if (startIndex === -1) {
                    return [];
                }
                const normalizedStops = stopTitles.map((title) => normalizeLabel(title));
                const values = [];
                for (let index = startIndex + 1; index < lines.length; index += 1) {
                    const current = lines[index];
                    const normalizedCurrent = normalizeLabel(current);
                    if (normalizedStops.includes(normalizedCurrent)) {
                        break;
                    }
                    if (normalizedHeaders.includes(normalizedCurrent)) {
                        continue;
                    }
                    values.push(current);
                }
                const rows = [];
                for (let index = 0; index < values.length; index += 5) {
                    const chunk = values.slice(index, index + 5);
                    if (!chunk[0]) {
                        continue;
                    }
                    rows.push({
                        name: chunk[0] || "",
                        price: chunk[1] || undefined,
                        discount: chunk[2] || undefined,
                        quantity: chunk[3] || undefined,
                        totalUnitPrice: chunk[4] || undefined
                    });
                }
                return rows;
            };
            return {
                transactionId: id,
                ticketType: readValueAfter("Ticket type"),
                billingType: readValueAfter("Billing type", 1),
                transactionStatus: readValueAfter("Transaction status"),
                entryDate: readValueAfter("Entry date"),
                exitDate: readValueAfter("Exit date"),
                totalTime: readValueAfter("Total time"),
                discountName: readValueAfter("Discount name"),
                billingDesk: readValueAfter("Billing type", 2),
                loggedInBy: readValueAfter("Logged in by"),
                loggedOutBy: readValueAfter("Logged out by"),
                appliedCredit: readPrefixedValue("Applied credit"),
                totalWithVat: readPrefixedValue("Total With Vat"),
                goodsServices: readSectionRows("Goods & services", ["Rented", "Applied credit", "Total With Vat"]),
                rented: readSectionRows("Rented", ["Applied credit", "Total With Vat"])
            };
        }, { id: transactionId });
    });
}
