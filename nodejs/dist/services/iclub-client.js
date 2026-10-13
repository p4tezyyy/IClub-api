import crypto from "node:crypto";
import { AppError } from "../utils/app-error.js";
import { logger } from "../utils/logger.js";
import { IClubBrowserClient } from "./iclub-legacy-browser-client.js";
import { IClubSignalRSession, getSignalRGyms, warmSignalRGymCache } from "./iclub-signalr/client.js";
import { buildAttendanceSeriesFromVisits, buildWeekdayDistributionFromVisits, computeVisitStreakDays, diffInDays, mapVisitRecordToRecentVisit, parseLocalDate, parseLocalDateTime } from "./iclub/utils.js";
const DASHBOARD_CACHE_TTL_MS = 10_000;
const PROFILE_CACHE_TTL_MS = 15_000;
const VISITS_CACHE_TTL_MS = 10_000;
const VISIT_DETAIL_CACHE_TTL_MS = 60_000;
const CALENDAR_CACHE_TTL_MS = 15_000;
function formatElapsed(entryDate, now = new Date()) {
    const startedAt = parseLocalDateTime(entryDate);
    if (!startedAt) {
        return undefined;
    }
    const diffMs = now.getTime() - startedAt.getTime();
    if (diffMs < 0) {
        return undefined;
    }
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
function buildMemberSummary(user) {
    return {
        name: user?.FullName || [user?.FirstName, user?.LastName].filter(Boolean).join(" ") || "Member",
        location: IClubSignalRSession.mapCountry(user?.Country),
        loyalty: []
    };
}
function mapVisitRow(row) {
    return {
        transactionId: Number(row?.TransactionId || 0),
        entryDate: IClubSignalRSession.formatLocalDateTime(row?.EntryDate),
        exitDate: IClubSignalRSession.formatLocalDateTime(row?.ExitDate),
        employee: String(row?.EmployeeName || row?.ClosedByEmployeeName || "Unknown"),
        status: IClubSignalRSession.mapTransactionStatus(row?.TransactionStatus)
    };
}
function buildMetricCards(user, stats) {
    const totalBalance = user?.Account?.TotalBalance ?? user?.Account?.Balance ?? user?.CreditBalance ?? 0;
    return [
        { label: "valid memberships", value: String(stats?.ValidTicketsCount ?? 0) },
        { label: "remaining credit", value: IClubSignalRSession.formatMoney(totalBalance) },
        { label: "exercises this month", value: String(stats?.CurrentMonthVisitsCount ?? 0) },
        { label: "last visit", value: IClubSignalRSession.formatLocalDateTime(stats?.LastVisitDate) || "-" },
        { label: "total exercises", value: String(stats?.TotalVisitsCount ?? 0) }
    ];
}
function mapContactInfo(user) {
    return {
        gender: Number(user?.Gender) === 1 ? "female" : "male",
        firstName: String(user?.FirstName || ""),
        lastName: String(user?.LastName || ""),
        email: String(user?.Email || ""),
        phoneNumber: String(user?.PhoneNumber || ""),
        addressLine: String(user?.AddressLine || ""),
        city: String(user?.City || ""),
        zipCode: String(user?.ZipCode || ""),
        country: IClubSignalRSession.mapCountry(user?.Country),
        marketingConsent: Boolean(user?.MarketingConsent)
    };
}
function formatDuration(value) {
    if (!value) {
        return undefined;
    }
    const normalized = String(value).trim();
    if (!normalized) {
        return undefined;
    }
    if (/^\d+(?:\.\d+)?$/.test(normalized)) {
        const totalSeconds = Math.max(0, Math.floor(Number(normalized)));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    // Keep already formatted durations intact; otherwise normalize ISO-ish TimeSpan-like values.
    const match = normalized.match(/(?:(\d+)\.)?(\d{2}):(\d{2}):(\d{2})/);
    if (!match) {
        return normalized;
    }
    const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;
    const totalHours = Number(days) * 24 + Number(hours);
    return `${String(totalHours).padStart(2, "0")}:${minutes}:${seconds}`;
}
function formatLineAmount(value) {
    if (value == null || !Number.isFinite(value)) {
        return undefined;
    }
    return IClubSignalRSession.formatMoney(value);
}
function mapTransactionLines(lines) {
    return (lines ?? []).map((line) => ({
        name: String(line?.Name || ""),
        price: formatLineAmount(line?.Price),
        discount: formatLineAmount(line?.Discount),
        quantity: line?.Quantity == null ? undefined : String(line.Quantity),
        totalUnitPrice: formatLineAmount(line?.TotalUnitPrice)
    }));
}
function startOfDay(date) {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
}
function getWeekRange(now = new Date()) {
    const start = startOfDay(now);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
}
function getMonthRange(now = new Date()) {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const start = startOfDay(monthStart);
    start.setDate(start.getDate() - start.getDay());
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const end = startOfDay(monthEnd);
    end.setDate(end.getDate() + (6 - end.getDay()) + 1);
    return { start, end };
}
function parseCalendarDate(value) {
    if (!value) {
        return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function getCalendarRange(options) {
    const view = options?.view === "month" ? "month" : "week";
    const start = parseCalendarDate(options?.start);
    const end = parseCalendarDate(options?.end);
    if (start && end) {
        return {
            view,
            start: startOfDay(start),
            end: startOfDay(end)
        };
    }
    return {
        view,
        ...(view === "month" ? getMonthRange(start ?? new Date()) : getWeekRange(start ?? new Date()))
    };
}
function formatDayLabel(iso) {
    if (!iso) {
        return undefined;
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return undefined;
    }
    return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "2-digit" }).format(date);
}
function formatTimeRange(startIso, endIso) {
    const start = IClubSignalRSession.formatLocalDateTime(startIso);
    const end = IClubSignalRSession.formatLocalDateTime(endIso);
    const startTime = start.split(" ")[1] || start;
    const endTime = end.split(" ")[1] || end;
    return startTime && endTime ? `${startTime} - ${endTime}` : startTime || endTime || "-";
}
function buildCalendarPayload(events, customerEvents, rooms, options) {
    const { start, end, view } = getCalendarRange(options);
    const bookedIds = new Set(customerEvents.map((event) => Number(event.EventId)).filter((value) => value > 0));
    const formattedEvents = events
        .slice()
        .sort((left, right) => new Date(left.StartDate || 0).getTime() - new Date(right.StartDate || 0).getTime())
        .map((event) => ({
        id: Number(event.EventId),
        time: formatTimeRange(event.StartDate, event.EndDate),
        title: String(event.Name || "Class"),
        trainer: String(event.TrainerName || "Unknown trainer"),
        occupancy: `${Number(event.AttendeesCount || 0)}/${Number(event.Capacity || 0)}`,
        startDate: event.StartDate || undefined,
        endDate: event.EndDate || undefined,
        attendeesCount: Number(event.AttendeesCount || 0),
        capacity: Number(event.Capacity || 0),
        ended: Boolean(event.Ended),
        booked: Boolean(event.CurrentUserLoggedIn) || bookedIds.has(Number(event.EventId)),
        color: event.Color || undefined,
        fontColor: event.FontColor || undefined,
        room: event.RoomName || undefined,
        day: formatDayLabel(event.StartDate)
    }));
    const rangeLabel = view === "month"
        ? new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(start)
        : `${start.toLocaleDateString("en-GB")} - ${new Date(end.getTime() - 1).toLocaleDateString("en-GB")}`;
    const roomLabel = rooms.length ? `All rooms · ${rooms.length} available` : "All rooms";
    const upcomingMessage = customerEvents.length
        ? `You have ${customerEvents.length} booked event${customerEvents.length === 1 ? "" : "s"} in the current schedule.`
        : "You are not assigned to any event.";
    return {
        view,
        rangeLabel,
        rangeStart: start.toISOString(),
        rangeEnd: end.toISOString(),
        roomLabel,
        events: formattedEvents,
        upcomingMessage,
        rawEventsById: new Map(events.map((event) => [Number(event.EventId), event]))
    };
}
export class IClubClient {
    clientId = crypto.randomUUID();
    signalr = new IClubSignalRSession(this.clientId);
    legacyClient = null;
    responseCache = new Map();
    email = "";
    password = "";
    gymName = "";
    legacyWarmupPromise = null;
    log = logger.child({ scope: "iclub-client", clientId: this.clientId });
    static async getGyms() {
        return getSignalRGyms();
    }
    static async warmGymCache() {
        return warmSignalRGymCache();
    }
    getClientId() {
        return this.clientId;
    }
    async login(email, password, gymName) {
        this.email = email;
        this.password = password;
        this.gymName = gymName;
        this.log.info("login.start", { email, gymName });
        await this.signalr.login(email, password, gymName);
        this.responseCache.clear();
        // Browser is launched only when its optional functions are requested.
    }
    /** Expose the supported raw hub methods without HTML scraping. */
    async getUser() { return this.signalr.getUser(); }
    async getCustomerStats() { return this.signalr.getCustomerStats(); }
    async getAvailableTickets() { return this.signalr.getAvailableTickets(); }
    async getHomePageText() { return this.signalr.getHomePageText(); }
    async getVisitsTransactions(limit = 20) { return this.signalr.getVisitsTransactions(limit); }
    async getSalesTransactions(limit = 20) { return this.signalr.getSalesTransactions(limit); }
    async getTransaction(id) { return this.signalr.getTransaction(id); }
    async getCustomerEvents(at = new Date()) { return this.signalr.getCustomerEvents(at); }
    async getRooms() { return this.signalr.getRooms(); }
    async getRoomsEvents(startIso, endIso) { return this.signalr.getRoomsEvents(startIso, endIso); }
    async rawInvoke(hub, method, args = [], withContext = true) {
        return this.signalr.rawInvoke(hub, method, args, withContext);
    }
    async getCredit() {
        const user = await this.signalr.getUser();
        const account = user?.Account;
        return {
            balance: account?.Balance ?? null,
            bonusBalance: account?.BonusBalance ?? null,
            totalBalance: account?.TotalBalance ?? user?.CreditBalance ?? null,
            topUpAllowed: Boolean(user?.CreditAccountAllowed),
            minTopUp: account?.AccountType?.MinChargeAmount ?? null
        };
    }
    async getDashboard() {
        return this.withCache("dashboard", DASHBOARD_CACHE_TTL_MS, async () => {
            const [user, stats, tickets, homeText, visitRows, salesRows] = await Promise.all([
                this.signalr.getUser(),
                this.signalr.getCustomerStats(),
                this.signalr.getAvailableTickets(),
                this.signalr.getHomePageText(),
                this.signalr.getVisitsTransactions(20),
                this.signalr.getSalesTransactions(10)
            ]);
            const visits = visitRows.map(mapVisitRow).filter((row) => row.transactionId > 0);
            const recentVisits = visits.slice(0, 4).map(mapVisitRecordToRecentVisit);
            const now = new Date();
            const visitDates = visits
                .map((visit) => parseLocalDate(visit.entryDate.split(" ")[0] || ""))
                .filter((value) => Boolean(value));
            const visitsLast7Days = visitDates.filter((date) => diffInDays(date, now) <= 7).length;
            const visitsLast30Days = visitDates.filter((date) => diffInDays(date, now) <= 30).length;
            const streakDays = computeVisitStreakDays(visits);
            const latestVisit = visits[0];
            const totalBalance = user?.Account?.TotalBalance ?? user?.Account?.Balance ?? user?.CreditBalance ?? 0;
            const recentPayments = salesRows
                .filter((row) => Number(row?.TransactionId) > 0)
                .slice(0, 2)
                .map((row) => ({
                title: row?.Note || "Payment",
                subtitle: IClubSignalRSession.mapTransactionStatus(row?.TransactionStatus),
                dateLabel: IClubSignalRSession.formatLocalDateTime(row?.EntryDate),
                kind: "payment"
            }));
            const activityTimeline = [
                ...recentVisits.map((visit) => ({
                    title: "Gym visit",
                    subtitle: visit.description,
                    dateLabel: `${visit.date}${visit.time ? ` · ${visit.time}` : ""}`,
                    kind: "visit"
                })),
                ...recentPayments
            ].slice(0, 6);
            const activeSession = latestVisit && !/closed|cancelled/i.test(latestVisit.status)
                ? {
                    isActive: true,
                    transactionId: latestVisit.transactionId,
                    entryDate: latestVisit.entryDate,
                    employee: latestVisit.employee,
                    status: latestVisit.status,
                    durationLabel: formatElapsed(latestVisit.entryDate),
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
            return {
                title: "Main panel",
                member: buildMemberSummary(user),
                hero: {
                    heading: `Welcome back, ${(user?.FirstName || user?.FullName || "Member").split(" ")[0]}`,
                    subheading: "Your live account data is now coming directly from the iClub backend session.",
                    badge: "Live Member Dashboard"
                },
                activeSession,
                metrics: buildMetricCards(user, stats),
                overviewMessage: typeof homeText === "string" && homeText.trim()
                    ? homeText.trim()
                    : `Live sync: ${visits.length} visits, ${salesRows.length} payments, ${tickets.length} memberships.`,
                streakDays,
                visitsLast7Days,
                visitsLast30Days,
                insightStats: [
                    { label: "Visits this month", value: String(stats?.CurrentMonthVisitsCount ?? visitsLast30Days), tone: "default" },
                    { label: "Total sessions", value: String(stats?.TotalVisitsCount ?? visits.length), tone: "default" },
                    { label: "Wallet credit", value: IClubSignalRSession.formatMoney(totalBalance), tone: "default" },
                    { label: "Last check-in", value: IClubSignalRSession.formatLocalDateTime(stats?.LastVisitDate) || "-", tone: visits.length ? "default" : "warning" }
                ],
                attendanceSeries: buildAttendanceSeriesFromVisits(visits, now),
                weekdayDistribution: buildWeekdayDistributionFromVisits(visits),
                occupancySeries: [],
                upcomingClasses: [],
                recentVisits,
                recentBookings: [],
                activityTimeline
            };
        });
    }
    async getLiveQrCode() {
        const legacy = await this.ensureLegacyClient();
        return legacy.getLiveQrCode();
    }
    async resetQrPage() {
        if (!this.legacyClient) {
            return;
        }
        await this.legacyClient.resetQrPage();
    }
    async getVisitHistory() {
        return this.withCache("visits", VISITS_CACHE_TTL_MS, async () => {
            const visits = (await this.signalr.getVisitsTransactions(20)).map(mapVisitRow).filter((row) => row.transactionId > 0);
            return { visits };
        });
    }
    async getVisitDetail(transactionId) {
        return this.withCache(`visit-detail:${transactionId}`, VISIT_DETAIL_CACHE_TTL_MS, async () => {
            const transaction = await this.signalr.getTransaction(transactionId);
            const ticketType = typeof transaction?.Ticket === "string"
                ? transaction.Ticket
                : transaction?.Ticket?.Name;
            return {
                transactionId: Number(transaction?.TransactionId || transactionId),
                ticketType: ticketType || undefined,
                billingType: transaction?.Note || undefined,
                transactionStatus: IClubSignalRSession.mapTransactionStatus(transaction?.TransactionStatus),
                entryDate: IClubSignalRSession.formatLocalDateTime(transaction?.EntryDate) || undefined,
                exitDate: IClubSignalRSession.formatLocalDateTime(transaction?.ExitDate) || undefined,
                totalTime: formatDuration(transaction?.Duration),
                discountName: undefined,
                billingDesk: undefined,
                loggedInBy: transaction?.EmployeeName || undefined,
                loggedOutBy: transaction?.ClosedByEmployeeName || undefined,
                appliedCredit: transaction?.CreditChange == null ? undefined : IClubSignalRSession.formatMoney(Math.abs(transaction.CreditChange)),
                totalWithVat: transaction?.TotalWithVat == null ? undefined : `${IClubSignalRSession.formatMoney(transaction.TotalWithVat)} €`,
                goodsServices: mapTransactionLines(transaction?.GoodsList),
                rented: mapTransactionLines(transaction?.RentsList)
            };
        });
    }
    async getProfile() {
        return this.withCache("profile", PROFILE_CACHE_TTL_MS, async () => {
            const [user, stats, tickets, visits, sales] = await Promise.all([
                this.signalr.getUser(),
                this.signalr.getCustomerStats(),
                this.signalr.getAvailableTickets(),
                this.signalr.getVisitsTransactions(20),
                this.signalr.getSalesTransactions(20)
            ]);
            const mappedVisits = visits.map(mapVisitRow).filter((row) => row.transactionId > 0);
            const membershipRows = Array.isArray(tickets)
                ? tickets.map((ticket) => [
                    String(ticket?.Name || ticket?.Ticket?.Name || "Membership"),
                    String(ticket?.StatusName || ticket?.Status || "-"),
                    IClubSignalRSession.formatLocalDateTime(ticket?.ValidTo || ticket?.ExpirationDate) || "-"
                ])
                : [];
            return {
                member: buildMemberSummary(user),
                metrics: buildMetricCards(user, stats),
                contactInfo: mapContactInfo(user),
                memberships: membershipRows.length
                    ? { columns: ["Name", "State", "Valid until"], rows: membershipRows }
                    : { columns: ["Name", "State", "Valid until"], rows: [], emptyMessage: "No active memberships." },
                history: mappedVisits.length
                    ? {
                        columns: ["Entry", "Exit", "Employee", "Status", "Transaction"],
                        rows: mappedVisits.map((visit) => [visit.entryDate, visit.exitDate || "-", visit.employee, visit.status, String(visit.transactionId)])
                    }
                    : { columns: ["Entry", "Exit", "Employee", "Status", "Transaction"], rows: [], emptyMessage: "No history rows were exposed in the current session." },
                payments: sales.length
                    ? {
                        columns: ["Date", "Total", "Employee", "Status", "Transaction"],
                        rows: sales.map((payment) => [
                            IClubSignalRSession.formatLocalDateTime(payment?.EntryDate) || "-",
                            payment?.TotalWithVat == null ? "-" : `${IClubSignalRSession.formatMoney(payment.TotalWithVat)} €`,
                            String(payment?.EmployeeName || payment?.ClosedByEmployeeName || "-"),
                            IClubSignalRSession.mapTransactionStatus(payment?.TransactionStatus),
                            String(payment?.TransactionId || "-")
                        ])
                    }
                    : { columns: ["Date", "Total", "Employee", "Status", "Transaction"], rows: [], emptyMessage: "No payments were exposed in the current session." },
                creditText: `Current live credit balance: ${IClubSignalRSession.formatMoney(user?.Account?.TotalBalance ?? user?.CreditBalance ?? 0)}`,
                creditDeposit: {
                    enabled: Boolean(user?.CreditAccountAllowed),
                    currentBalanceText: IClubSignalRSession.formatMoney(user?.Account?.TotalBalance ?? user?.CreditBalance ?? 0),
                    minAmount: Number(user?.Account?.AccountType?.MinChargeAmount ?? 0),
                    minAmountText: IClubSignalRSession.formatMoney(user?.Account?.AccountType?.MinChargeAmount ?? 0),
                    ctaLabel: String(user?.Account?.AccountType?.ChargeCreditGood?.Name || "Open top-up"),
                    helperText: user?.CreditAccountAllowed
                        ? "Enter an amount and continue to the live iClub payment flow."
                        : "Credit top-up is not enabled for the current account."
                }
            };
        });
    }
    async prepareCreditDeposit(amount) {
        const user = await this.signalr.getUser();
        const minAmount = Number(user?.Account?.AccountType?.MinChargeAmount ?? 0);
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new AppError("Enter a valid deposit amount.", {
                status: 400,
                code: "NFITNESS_CREDIT_AMOUNT_INVALID"
            });
        }
        if (minAmount > 0 && amount < minAmount) {
            throw new AppError(`Minimum top-up amount is ${IClubSignalRSession.formatMoney(minAmount)} €.`, {
                status: 400,
                code: "NFITNESS_CREDIT_AMOUNT_TOO_LOW"
            });
        }
        const legacy = await this.ensureLegacyClient();
        return legacy.prepareCreditDeposit(amount);
    }
    async updateContactInformation(payload) {
        const user = await this.signalr.getUser();
        const submitted = await this.signalr.submitUser({
            Gender: payload.gender === "female" ? 1 : 0,
            FirstName: payload.firstName,
            LastName: payload.lastName,
            Email: payload.email,
            PhoneNumber: payload.phoneNumber || null,
            AddressLine: payload.addressLine || null,
            City: payload.city || null,
            ZipCode: payload.zipCode || null,
            Country: user?.Country ?? 187,
            MarketingConsent: payload.marketingConsent ? 1 : 0,
            UserId: Number(user?.UserId || 0)
        });
        if (!submitted) {
            throw new AppError("The contact information could not be updated. Please try again.", {
                status: 400,
                code: "NFITNESS_CONTACT_UPDATE_REJECTED"
            });
        }
        this.responseCache.delete("profile");
        const profile = await this.getProfile();
        return {
            message: "Your contact information was updated successfully.",
            profile
        };
    }
    async changePassword(oldPassword, newPassword, newPasswordAgain) {
        if (newPassword !== newPasswordAgain) {
            throw new AppError("The new password confirmation does not match.", {
                status: 400,
                code: "NFITNESS_CHANGE_PASSWORD_MISMATCH"
            });
        }
        const changed = await this.signalr.changePassword(oldPassword, newPassword);
        if (!changed) {
            throw new AppError("The password could not be changed. Check the entered passwords and try again.", {
                status: 400,
                code: "NFITNESS_CHANGE_PASSWORD_REJECTED"
            });
        }
        this.password = newPassword;
        if (this.legacyClient) {
            await this.legacyClient.dispose().catch(() => undefined);
            this.legacyClient = null;
        }
        return { message: "Your password was changed successfully." };
    }
    async getCalendar(options) {
        const { start, end, view } = getCalendarRange(options);
        const cacheKey = `calendar:${view}:${start.toISOString()}:${end.toISOString()}`;
        return this.withCache(cacheKey, CALENDAR_CACHE_TTL_MS, async () => {
            const [customerEvents, rooms, roomEvents] = await Promise.all([
                this.signalr.getCustomerEvents(start),
                this.signalr.getRooms(),
                this.signalr.getRoomsEvents(start.toISOString(), end.toISOString())
            ]);
            const payload = buildCalendarPayload(roomEvents, customerEvents, rooms, {
                start: start.toISOString(),
                end: end.toISOString(),
                view
            });
            return {
                view: payload.view,
                rangeLabel: payload.rangeLabel,
                rangeStart: payload.rangeStart,
                rangeEnd: payload.rangeEnd,
                roomLabel: payload.roomLabel,
                events: payload.events,
                upcomingMessage: payload.upcomingMessage
            };
        });
    }
    async getEventDetail(eventId, options) {
        const { start, end, view } = getCalendarRange(options);
        const [customerEvents, rooms, roomEvents] = await Promise.all([
            this.signalr.getCustomerEvents(start),
            this.signalr.getRooms(),
            this.signalr.getRoomsEvents(start.toISOString(), end.toISOString())
        ]);
        const payload = buildCalendarPayload(roomEvents, customerEvents, rooms, {
            start: start.toISOString(),
            end: end.toISOString(),
            view
        });
        const event = payload.rawEventsById.get(eventId);
        if (!event) {
            throw new AppError("The selected class could not be found in the current live schedule.", {
                status: 404,
                code: "NFITNESS_EVENT_NOT_FOUND"
            });
        }
        return {
            title: String(event.Name || "Class"),
            fields: [
                { label: "Trainer", value: String(event.TrainerName || "Unknown trainer") },
                { label: "Room", value: String(event.RoomName || "-") },
                { label: "Time", value: formatTimeRange(event.StartDate, event.EndDate) },
                { label: "Day", value: formatDayLabel(event.StartDate) || "-" },
                { label: "Occupancy", value: `${Number(event.AttendeesCount || 0)}/${Number(event.Capacity || 0)}` },
                { label: "Status", value: event.Ended ? "Ended" : "Upcoming" }
            ],
            primaryActionLabel: event.AddingAttendeesAllowed && !event.Ended ? "Reserve class" : undefined
        };
    }
    async reserveEvent(eventId, options) {
        // Source bug: eventId is a remote EventId, NOT a Playwright .nth() index.
        // Refuse to book unless uniquely identified by the live SignalR calendar.
        const { start, end } = getCalendarRange(options);
        const events = await this.signalr.getRoomsEvents(start.toISOString(), end.toISOString());
        const matches = events.filter((event) => Number(event.EventId) === eventId);
        if (matches.length !== 1 || !matches[0].StartDate || !matches[0].Name) {
            throw new AppError("Requested class could not be identified uniquely.", { status: 409, code: "ICLUB_EVENT_AMBIGUOUS" });
        }
        const event = matches[0];
        if (event.Ended || event.CurrentUserLoggedIn || !event.AddingAttendeesAllowed) {
            throw new AppError("Class is already booked or unavailable.", { status: 409, code: "ICLUB_BOOKING_UNAVAILABLE" });
        }
        const legacy = await this.ensureLegacyClient();
        const result = await legacy.reserveEventByMatch({
            title: event.Name,
            startDate: event.StartDate,
            trainer: event.TrainerName ?? undefined
        });
        this.responseCache.clear();
        return result;
    }
    async dispose() {
        this.legacyWarmupPromise = null;
        await this.signalr.logout().catch(() => undefined);
        await this.signalr.close().catch(() => undefined);
        if (this.legacyClient) {
            await this.legacyClient.dispose().catch(() => undefined);
            this.legacyClient = null;
        }
        this.responseCache.clear();
    }
    async ensureLegacyClient() {
        if (this.legacyClient) {
            return this.legacyClient;
        }
        if (!this.email || !this.password || !this.gymName) {
            throw new AppError("Your live gym session expired. Please sign in again.", {
                status: 401,
                code: "NFITNESS_SESSION_EXPIRED"
            });
        }
        this.log.info("legacy.fallback.login.start", { gymName: this.gymName });
        const legacy = new IClubBrowserClient();
        await legacy.login(this.email, this.password, this.gymName);
        this.legacyClient = legacy;
        return legacy;
    }
    async prewarmLegacyQr() {
        if (this.legacyWarmupPromise) {
            return this.legacyWarmupPromise;
        }
        this.legacyWarmupPromise = (async () => {
            try {
                const legacy = await this.ensureLegacyClient();
                await legacy.warmLiveQr();
                this.log.info("legacy.qr.prewarm.ready");
            }
            catch (error) {
                this.log.warn("legacy.qr.prewarm.failed", { error });
            }
            finally {
                this.legacyWarmupPromise = null;
            }
        })();
        return this.legacyWarmupPromise;
    }
    async withCache(key, ttlMs, loader) {
        const cached = this.responseCache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.value;
        }
        const value = await loader();
        this.responseCache.set(key, { value, expiresAt: Date.now() + ttlMs });
        return value;
    }
}
export async function warmGymCache() {
    await IClubClient.warmGymCache();
}
