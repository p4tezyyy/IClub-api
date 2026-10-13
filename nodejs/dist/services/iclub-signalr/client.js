import crypto from "node:crypto";
import { AppError } from "../../utils/app-error.js";
import { logger } from "../../utils/logger.js";
import { SignalRConnection, createGuid } from "./protocol.js";
let gymsCache = null;
let gymsInflight = null;
const GYM_CACHE_TTL_MS = 15 * 60 * 1000;
const log = logger.child({ scope: "iclub-signalr-client" });
function hashPassword(password) {
    return crypto.createHash("sha256").update(password, "utf8").digest("base64");
}
function normalizeText(value) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}
function formatMoney(value) {
    const amount = typeof value === "number" && Number.isFinite(value) ? value : 0;
    return amount.toFixed(2).replace(".", ",");
}
function mapTransactionStatus(status) {
    if (status === 2) {
        return "Closed";
    }
    if (status === 3) {
        return "Cancelled";
    }
    if (status === 1) {
        return "Open";
    }
    return status == null ? "Unknown" : `Status ${status}`;
}
function formatLocalDateTime(iso) {
    if (!iso) {
        return "";
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    const pad = (value) => String(value).padStart(2, "0");
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function mapCountry(value) {
    if (value === 187 || value === "187") {
        return "Slovakia";
    }
    return typeof value === "string" && value.trim() ? value.trim() : "Club member";
}
function buildGymLabel(client) {
    const parts = [
        client.Name,
        client.ShopName,
        client.CompanyName,
        client.FullDetail
    ].filter((value) => typeof value === "string" && value.trim().length > 0);
    return parts[0] ?? "";
}
function collectGyms(value, result, seen) {
    if (Array.isArray(value)) {
        for (const item of value) {
            collectGyms(item, result, seen);
        }
        return;
    }
    if (!value || typeof value !== "object") {
        return;
    }
    const record = value;
    const ident = typeof record.ClientIdentAlias === "string"
        ? record.ClientIdentAlias.trim()
        : typeof record.Ident === "string"
            ? record.Ident.trim()
            : "";
    const name = buildGymLabel(record).trim();
    if (ident && name && !seen.has(ident)) {
        seen.add(ident);
        result.push({ id: ident, name });
    }
    for (const nestedValue of Object.values(record)) {
        collectGyms(nestedValue, result, seen);
    }
}
async function loadGyms() {
    const connection = new SignalRConnection({ phase: "gyms" });
    try {
        const raw = await connection.invoke("settingworkflowhub", "GetClients", [null, createGuid()], 20_000);
        const gyms = [];
        collectGyms(raw, gyms, new Set());
        const sorted = gyms.sort((left, right) => left.name.localeCompare(right.name));
        if (!sorted.length) {
            throw new AppError("The iClub gym list could not be loaded.", {
                status: 502,
                code: "NFITNESS_GYM_LIST_EMPTY",
                retryable: true
            });
        }
        return sorted;
    }
    finally {
        await connection.close().catch(() => undefined);
    }
}
export async function getSignalRGyms() {
    if (gymsCache && gymsCache.expiresAt > Date.now()) {
        log.debug("gyms.cache.hit", { count: gymsCache.value.length });
        return gymsCache.value;
    }
    if (gymsInflight) {
        log.debug("gyms.inflight.reuse");
        return gymsInflight;
    }
    gymsInflight = loadGyms()
        .then((value) => {
        gymsCache = { value, expiresAt: Date.now() + GYM_CACHE_TTL_MS };
        log.info("gyms.loaded", { count: value.length });
        return value;
    })
        .finally(() => {
        gymsInflight = null;
    });
    return gymsInflight;
}
export async function warmSignalRGymCache() {
    try {
        await getSignalRGyms();
    }
    catch (error) {
        log.warn("gyms.warm.failed", { error });
    }
}
export class IClubSignalRSession {
    clientId;
    connection;
    ctx = null;
    userId = null;
    userEmail = "";
    log;
    constructor(clientId) {
        this.clientId = clientId;
        this.connection = new SignalRConnection({ clientId });
        this.log = logger.child({ scope: "iclub-signalr-session", clientId });
    }
    async login(email, password, gymName) {
        const gyms = await getSignalRGyms();
        const targetGym = normalizeText(gymName);
        const gym = gyms.find((item) => normalizeText(item.name) === targetGym);
        if (!gym) {
            throw new AppError("The selected gym could not be matched in the live iClub list.", {
                status: 400,
                code: "NFITNESS_GYM_NOT_FOUND",
                retryable: false
            });
        }
        this.ctx = {
            Ident: gym.id,
            SessionId: createGuid(),
            DefaultCulture: "en-GB"
        };
        this.userEmail = email;
        const rawUser = await this.connection.invoke("authenticationworkflowhub", "Login", [
            this.ctx,
            createGuid(),
            email,
            hashPassword(password),
            false
        ], 25_000);
        if (!rawUser?.UserId) {
            throw new AppError("The gym account credentials were rejected. Check the selected gym, email, and password.", {
                status: 401,
                code: "NFITNESS_INVALID_CREDENTIALS"
            });
        }
        this.userId = rawUser.UserId;
        if (rawUser.SessionId) {
            this.ctx.SessionId = rawUser.SessionId;
        }
        this.log.info("login.success", { email, gymName, userId: this.userId });
        return rawUser;
    }
    /** Advanced low-level hub access. May mutate remote account data. */
    async rawInvoke(hub, method, args = [], withContext = true) {
        if (!withContext) {
            return this.connection.invoke(hub, method, args);
        }
        if (!this.ctx) {
            throw new AppError("Log in before calling an authenticated hub.", { status: 401, code: "ICLUB_SESSION_REQUIRED" });
        }
        return this.connection.invoke(hub, method, [this.ctx, ...args]);
    }
    async getUser() {
        return this.invokeWithContext("personworkflowhub", "GetUser", [createGuid(), this.requireUserId()]);
    }
    async getCustomerStats() {
        return this.invokeWithContext("personworkflowhub", "GetCustomerStats", [createGuid(), this.requireUserId()]);
    }
    async getAvailableTickets() {
        return this.invokeWithContext("ticketworkflowhub", "GetCustomerAvailableTickets", [createGuid(), this.requireUserId(), 0, 0, false]);
    }
    async getHomePageText() {
        const value = await this.invokeWithContext("settingworkflowhub", "GetHomePageText", [createGuid()]);
        return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
    }
    async getVisitsTransactions(limit = 20) {
        const payload = await this.invokeWithContext("transactionworkflowhub", "GetVisitsTransactions", [createGuid(), this.requireUserId(), 0, limit]);
        return payload?.Transactions ?? [];
    }
    async getSalesTransactions(limit = 20) {
        const payload = await this.invokeWithContext("transactionworkflowhub", "GetSalesTransactions", [createGuid(), this.requireUserId(), 0, limit]);
        return payload?.Transactions ?? [];
    }
    async getTransaction(transactionId) {
        return this.invokeWithContext("transactionworkflowhub", "GetTransaction", [
            createGuid(),
            String(transactionId)
        ]);
    }
    async getCustomerEvents(at = new Date()) {
        const value = await this.invokeWithContext("reservationworkflowhub", "GetCustomerEvents", [
            createGuid(),
            this.requireUserId(),
            at.toISOString()
        ]);
        return Array.isArray(value) ? value : [];
    }
    async getRooms() {
        const value = await this.invokeWithContext("reservationworkflowhub", "GetRooms", [
            createGuid(),
            1,
            0
        ]);
        return Array.isArray(value) ? value : [];
    }
    async getRoomsEvents(startIso, endIso) {
        const value = await this.invokeWithContext("reservationworkflowhub", "GetRoomsEvents", [
            createGuid(),
            0,
            startIso,
            endIso
        ]);
        return Array.isArray(value) ? value : [];
    }
    async submitUser(payload) {
        const result = await this.invokeWithContext("personworkflowhub", "SubmitUser", [
            createGuid(),
            payload
        ]);
        return result === true;
    }
    async changePassword(oldPassword, newPassword) {
        const result = await this.invokeWithContext("authenticationworkflowhub", "ChangePassword", [
            createGuid(),
            this.userEmail,
            hashPassword(oldPassword),
            hashPassword(newPassword)
        ]);
        return result === true;
    }
    async logout() {
        if (!this.ctx) {
            return;
        }
        try {
            await this.invokeWithContext("authenticationworkflowhub", "Logout", [createGuid()], 10_000);
        }
        catch (error) {
            this.log.warn("logout.failed", { error });
        }
    }
    async close() {
        await this.connection.close();
    }
    static formatMoney = formatMoney;
    static formatLocalDateTime = formatLocalDateTime;
    static mapTransactionStatus = mapTransactionStatus;
    static mapCountry = mapCountry;
    async invokeWithContext(hub, method, args, timeoutMs = 20_000) {
        if (!this.ctx) {
            throw new AppError("Your live gym session expired. Please sign in again.", {
                status: 401,
                code: "NFITNESS_SESSION_EXPIRED"
            });
        }
        return this.connection.invoke(hub, method, [this.ctx, ...args], timeoutMs);
    }
    requireUserId() {
        if (!this.userId) {
            throw new AppError("Your live gym session expired. Please sign in again.", {
                status: 401,
                code: "NFITNESS_SESSION_EXPIRED"
            });
        }
        return this.userId;
    }
}
