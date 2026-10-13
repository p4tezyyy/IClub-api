import { cleanText, fallbackTable } from "../../utils/parse.js";
import { DASHBOARD_CACHE_TTL_MS, PROFILE_CACHE_TTL_MS } from "./types.js";
import { logger } from "../../utils/logger.js";
import { buildAttendanceSeriesFromVisits, buildWeekdayDistributionFromVisits, computeVisitStreakDays, diffInDays, isPlaceholderOverview, mapVisitRecordToRecentVisit, parseLocalDate, parseMetricNumber } from "./utils.js";
import { scrapeVisitHistory } from "./visits.js";
const log = logger.child({ scope: "iclub-dashboard-profile" });
function buildDurationLabel(entryDate, now) {
    const [, datePart = "", timePart = ""] = entryDate.match(/^(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})$/) ?? [];
    if (!datePart) {
        return undefined;
    }
    const parsed = parseLocalDate(datePart);
    if (!parsed) {
        return undefined;
    }
    const [hours = "0", minutes = "0"] = timePart.split(":");
    const startedAt = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), Number(hours), Number(minutes));
    const diffMs = now.getTime() - startedAt.getTime();
    if (!Number.isFinite(diffMs) || diffMs < 0) {
        return undefined;
    }
    const totalMinutes = Math.floor(diffMs / 60000);
    const durationHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    if (durationHours <= 0) {
        return `${remainingMinutes} min`;
    }
    return `${durationHours}h ${String(remainingMinutes).padStart(2, "0")}m`;
}
async function readPageLines(client) {
    const page = client.getPage();
    return page.evaluate(() => (document.body.innerText || "")
        .split(/\r?\n/)
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean));
}
async function waitForDashboardContent(client) {
    const page = client.getPage();
    await page.waitForFunction(() => /(valid memberships|remaining credit|exercises this month|last visit|total exercises)/i.test(document.body.innerText || ""), undefined, { timeout: 12_000 }).catch(() => undefined);
    await page.waitForTimeout(800);
}
async function waitForProfileContent(client) {
    const page = client.getPage();
    await page.waitForFunction(() => /(Client profile|Memberships|History|Payments)/i.test(document.body.innerText || ""), undefined, { timeout: 12_000 }).catch(() => undefined);
    await page.waitForTimeout(5000);
}
async function getVisibleTab(page, pattern, fallbackText) {
    const roleTab = page.getByRole("tab", { name: pattern }).first();
    if (await roleTab.isVisible().catch(() => false)) {
        return roleTab;
    }
    return page.locator(`text=/^${fallbackText}$/i`).first();
}
export async function scrapeMemberSummary(client) {
    const lines = await readPageLines(client);
    const locationIndex = lines.findIndex((line) => /^(Slovakia|Slovensko)$/i.test(line));
    const name = locationIndex > 0
        ? lines
            .slice(Math.max(0, locationIndex - 3), locationIndex)
            .find((line) => /^[A-ZÁČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ][\p{L}'-]+\s+[A-ZÁČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ][\p{L}' -]+$/u.test(line) && !/^[A-Z0-9\s.&'-]+$/.test(line))
        : undefined;
    const location = lines.find((line) => /^(Slovakia|Slovensko)$/i.test(line));
    return {
        name: cleanText(name) || "Member",
        location: cleanText(location) || "Club member",
        loyalty: []
    };
}
export async function scrapeMetrics(client) {
    const labels = new Set(["valid memberships", "remaining credit", "exercises this month", "last visit", "total exercises"]);
    const lines = await readPageLines(client);
    const metrics = [];
    for (let index = 1; index < lines.length; index += 1) {
        const label = lines[index].toLowerCase();
        if (!labels.has(label)) {
            continue;
        }
        metrics.push({
            label: cleanText(lines[index]),
            value: cleanText(lines[index - 1])
        });
    }
    log.debug("metrics.scraped", { count: metrics.length, metrics });
    return metrics;
}
export async function scrapeUpcomingClasses(client, limit = 4) {
    const page = await client.goto("#/rezervacie/rozvrh");
    return page.evaluate((maxItems) => {
        const dayNames = Array.from(document.querySelectorAll("[role='columnheader'], .fc-col-header-cell"))
            .map((node) => (node.textContent || "").replace(/\s+/g, " ").trim())
            .filter(Boolean);
        const seen = new Set();
        const results = [];
        const eventNodes = Array.from(document.querySelectorAll(".fc-event, [class*='fc-event']"));
        eventNodes.forEach((node, index) => {
            if (results.length >= maxItems) {
                return;
            }
            const text = (node.textContent || "").replace(/\s+/g, " ").trim();
            if (!text) {
                return;
            }
            const time = text.match(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/)?.[0] ?? "";
            const occupancy = text.match(/\d+\s*\/\s*\d+/)?.[0] ?? "";
            const withoutMeta = text.replace(time, "").replace(occupancy, "").trim();
            const trainerMatch = withoutMeta.match(/([\p{L}][\p{L}' -]+)$/u);
            const trainer = trainerMatch?.[1]?.trim() ?? "";
            const title = withoutMeta.replace(trainer, "").trim();
            const key = `${time}-${title}-${trainer}-${occupancy}`;
            if (!title || seen.has(key)) {
                return;
            }
            seen.add(key);
            const day = dayNames[Math.min(dayNames.length - 1, Math.floor(index / 6) + 1)] || undefined;
            results.push({ id: results.length, time, title, trainer, occupancy, day });
        });
        return results;
    }, limit);
}
export async function scrapeRecentBookings(client, limit = 4) {
    const page = await client.goto("#/rezervacie/moje-cvicenia");
    const rows = await page.evaluate((maxItems) => {
        const tableRows = Array.from(document.querySelectorAll("table tbody tr"));
        return tableRows
            .map((row) => Array.from(row.querySelectorAll("td")).map((cell) => (cell.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean))
            .filter((row) => row.length >= 5)
            .slice(0, maxItems);
    }, limit);
    return rows.map((row) => ({
        date: row[0] || "Unknown",
        time: row[1] || "Unknown",
        title: row[4] || "Booked session",
        trainer: row[5] || "Unknown trainer",
        status: row[3]
    }));
}
export async function scrapePayments(client, limit = 20) {
    const page = await client.goto("#/profil");
    await waitForProfileContent(client);
    const paymentsTab = page.getByRole("tab", { name: /Payments/i }).first();
    await paymentsTab.waitFor({ state: "visible", timeout: 10_000 }).catch(() => undefined);
    await paymentsTab.click().catch(() => undefined);
    await page.waitForFunction(() => Array.from(document.querySelectorAll("[role='row']")).some((row) => row.querySelectorAll("[role='cell']").length >= 4), undefined, { timeout: 12_000 }).catch(() => undefined);
    await page.waitForTimeout(5000);
    const payments = await page.evaluate((maxItems) => {
        const lines = (document.body.innerText || "")
            .split(/\r?\n/)
            .map((line) => line.replace(/\s+/g, " ").trim())
            .filter(Boolean);
        const startIndex = lines.findIndex((line) => line === "Date");
        const endIndex = lines.findIndex((line, index) => index > startIndex && /^Items per page$/i.test(line));
        const values = startIndex >= 0 ? lines.slice(startIndex + 5, endIndex === -1 ? undefined : endIndex) : [];
        const transactionIds = Array.from(document.querySelectorAll("a[href*='/transakcie/']"))
            .map((anchor) => String(anchor.getAttribute("href")?.match(/\/transakcie\/(\d+)/)?.[1] || ""))
            .filter(Boolean);
        const rows = [];
        let index = 0;
        while (index < values.length && rows.length < maxItems) {
            const date = values[index];
            if (!/^\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}$/.test(date || "")) {
                index += 1;
                continue;
            }
            const maybeTotal = values[index + 1] || "";
            const hasTotal = /^\d+,\d{2}\s*€$/.test(maybeTotal);
            const employee = values[index + (hasTotal ? 2 : 1)] || "";
            const status = values[index + (hasTotal ? 3 : 2)] || "";
            const detail = values[index + (hasTotal ? 4 : 3)] || "";
            if (!employee || !status || !/^Detail$/i.test(detail)) {
                index += 1;
                continue;
            }
            rows.push({
                date,
                total: hasTotal ? maybeTotal : "",
                employee,
                status,
                transactionId: transactionIds[rows.length] || ""
            });
            index += hasTotal ? 5 : 4;
        }
        return rows.filter((row) => Boolean(row.transactionId));
    }, limit);
    log.debug("payments.scraped", { url: page.url(), count: payments.length, first: payments[0] ?? null });
    return payments;
}
export async function getDashboard(client) {
    return client.withCache("dashboard", DASHBOARD_CACHE_TTL_MS, async () => {
        const page = await client.goto("#/hlavny-panel");
        await waitForDashboardContent(client);
        const member = await scrapeMemberSummary(client);
        const metrics = await scrapeMetrics(client);
        const title = cleanText(await page.getByRole("heading", { level: 1 }).textContent());
        log.debug("dashboard.page", { url: page.url(), title, member });
        const overviewMessage = cleanText(await page.locator("text=/Obsah úvodnej stránky pripravujeme|preparing/i").first().textContent({ timeout: 1200 }).catch(() => null));
        const metricsMap = new Map(metrics.map((metric) => [metric.label.toLowerCase(), metric]));
        const totalExercises = parseMetricNumber(metricsMap.get("total exercises")?.value ?? "0");
        const monthlyExercises = parseMetricNumber(metricsMap.get("exercises this month")?.value ?? "0");
        const remainingCredit = metricsMap.get("remaining credit")?.value ?? "0";
        const lastVisit = metricsMap.get("last visit")?.value ?? "No visit yet";
        const upcomingClasses = await scrapeUpcomingClasses(client, 4);
        const visitHistory = await scrapeVisitHistory(client, 20);
        const recentBookings = await scrapeRecentBookings(client, 4);
        log.debug("dashboard.related", {
            visits: visitHistory.length,
            bookings: recentBookings.length,
            classes: upcomingClasses.length
        });
        const now = new Date();
        const recentVisits = visitHistory.slice(0, 4).map(mapVisitRecordToRecentVisit);
        const visitDates = visitHistory
            .map((visit) => parseLocalDate(visit.entryDate.split(" ")[0] || ""))
            .filter((value) => Boolean(value));
        const visitsLast7Days = visitDates.filter((date) => diffInDays(date, now) <= 7).length;
        const visitsLast30Days = visitDates.filter((date) => diffInDays(date, now) <= 30).length;
        const streakDays = computeVisitStreakDays(visitHistory);
        const latestVisit = visitHistory[0];
        const activeSession = latestVisit && !/closed/i.test(latestVisit.status)
            ? {
                isActive: true,
                transactionId: latestVisit.transactionId,
                entryDate: latestVisit.entryDate,
                employee: latestVisit.employee,
                status: latestVisit.status,
                durationLabel: buildDurationLabel(latestVisit.entryDate, now),
                note: latestVisit.exitDate ? "Exit not recorded yet" : "Member is currently checked in."
            }
            : {
                isActive: false,
                transactionId: latestVisit?.transactionId,
                entryDate: latestVisit?.entryDate,
                employee: latestVisit?.employee,
                status: latestVisit?.status,
                note: latestVisit ? "No currently open gym entry." : "No recent session history available."
            };
        const occupancySeries = upcomingClasses.map((session) => {
            const occupancyMatch = session.occupancy.match(/(\d+)\s*\/\s*(\d+)/);
            const taken = occupancyMatch ? Number(occupancyMatch[1]) : 0;
            const total = occupancyMatch ? Number(occupancyMatch[2]) : 1;
            const percentage = total > 0 ? Math.round((taken / total) * 100) : 0;
            return { label: session.title.length > 12 ? `${session.title.slice(0, 12)}...` : session.title, value: percentage };
        });
        const activityTimeline = [
            ...recentVisits.map((visit) => ({
                title: "Gym visit",
                subtitle: visit.description,
                dateLabel: `${visit.date}${visit.time ? ` · ${visit.time}` : ""}`,
                kind: "visit"
            })),
            ...recentBookings.map((booking) => ({
                title: booking.title,
                subtitle: `${booking.trainer}${booking.status ? ` · ${booking.status}` : ""}`,
                dateLabel: `${booking.date} · ${booking.time}`,
                kind: "booking"
            }))
        ].slice(0, 6);
        return {
            title,
            member,
            hero: {
                heading: `Welcome back, ${member.name.split(" ")[0] ?? member.name}`,
                subheading: "A modern member view over your live club account, bookings, QR access, and training rhythm.",
                badge: "Live Member Dashboard"
            },
            activeSession,
            metrics,
            overviewMessage: !overviewMessage || isPlaceholderOverview(overviewMessage)
                ? `Live sync: ${recentVisits.length} recent visits, ${recentBookings.length} bookings, ${upcomingClasses.length} visible classes.`
                : overviewMessage,
            streakDays,
            visitsLast7Days,
            visitsLast30Days,
            insightStats: [
                { label: "Visits this month", value: String(monthlyExercises || visitsLast30Days), change: monthlyExercises ? "Live dashboard metric" : "Derived from recent visit history", tone: "default" },
                { label: "Total sessions", value: String(Math.max(totalExercises, visitHistory.length)), change: totalExercises > 0 ? "Live dashboard total" : visitHistory.length ? `Derived from ${visitHistory.length} recent history rows` : "No session history available yet", tone: "default" },
                { label: "Wallet credit", value: remainingCredit, change: "Live balance from dashboard", tone: "default" },
                { label: "Last check-in", value: visitHistory[0]?.entryDate ?? lastVisit, change: visitHistory[0]?.employee ? `${visitHistory[0].employee}${visitHistory[0].status ? ` - ${visitHistory[0].status}` : ""}` : "No recent activity", tone: recentVisits.length ? "default" : "warning" }
            ],
            attendanceSeries: buildAttendanceSeriesFromVisits(visitHistory, now),
            weekdayDistribution: buildWeekdayDistributionFromVisits(visitHistory),
            occupancySeries,
            upcomingClasses,
            recentVisits,
            recentBookings,
            activityTimeline
        };
    });
}
export async function getProfile(client) {
    return client.withCache("profile", PROFILE_CACHE_TTL_MS, async () => {
        const page = await client.goto("#/profil");
        await waitForProfileContent(client);
        const member = await scrapeMemberSummary(client);
        const metrics = await scrapeMetrics(client);
        const visits = await scrapeVisitHistory(client, 10);
        const payments = await scrapePayments(client, 20);
        log.debug("profile.scraped", { url: page.url(), member, metrics: metrics.length, visits: visits.length, payments: payments.length });
        return {
            member,
            metrics,
            memberships: fallbackTable(["Name", "State", "Valid until"], "No active memberships."),
            history: visits.length
                ? { columns: ["Entry", "Exit", "Employee", "Status", "Transaction"], rows: visits.map((visit) => [visit.entryDate, visit.exitDate, visit.employee, visit.status, String(visit.transactionId)]) }
                : fallbackTable(["Entry", "Exit", "Employee", "Status", "Transaction"], "No history rows were exposed in the current session."),
            payments: payments.length
                ? {
                    columns: ["Date", "Total", "Employee", "Status", "Transaction"],
                    rows: payments.map((payment) => [payment.date, payment.total || "-", payment.employee, payment.status, payment.transactionId || "-"])
                }
                : fallbackTable(["Date", "Total", "Employee", "Status", "Transaction"], "No payments were exposed in the current session."),
            creditText: "Use the live iClub account to top up credit. The source app handles payment processing in a separate flow."
        };
    });
}
