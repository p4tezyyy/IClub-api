import crypto from "node:crypto";
import WebSocket from "ws";
import { AppError } from "../../utils/app-error.js";
import { logger } from "../../utils/logger.js";
const BASE_URL = "https://online.iclub.sk";
const SIGNALR_PATH = "/signalr";
function createMessageId() {
    return crypto.randomUUID();
}
function encodeConnectionToken(token) {
    return encodeURIComponent(token);
}
function buildCookieHeader(response) {
    const headers = response.headers;
    let cookies = [];
    if (typeof headers.getSetCookie === "function") {
        cookies = headers.getSetCookie();
    }
    else if (typeof headers.raw === "function") {
        cookies = headers.raw()["set-cookie"] ?? [];
    }
    else {
        const cookieHeader = headers.get("set-cookie");
        cookies = cookieHeader ? [cookieHeader] : [];
    }
    return cookies
        .map((value) => value.split(";")[0]?.trim())
        .filter(Boolean)
        .join("; ");
}
function normalizeHubError(value) {
    if (typeof value === "string" && value.trim()) {
        return value.trim();
    }
    if (value && typeof value === "object" && "Message" in value && typeof value.Message === "string") {
        return value.Message.trim();
    }
    return "The live iClub request failed. Please try again.";
}
function isUnauthenticatedHubError(message) {
    return /neprihl[aá]sen[ýy]\s+u[žz][íi]vate[ľl]|not\s+logged\s+in|unauthenticated|unauthorized/i.test(message);
}
function unwrapHubResult(payload) {
    if (payload?.E) {
        const message = normalizeHubError(payload.E);
        if (isUnauthenticatedHubError(message)) {
            throw new AppError("Your live gym session expired. Please sign in again.", {
                status: 401,
                code: "NFITNESS_SESSION_EXPIRED",
                retryable: false
            });
        }
        throw new AppError(message, {
            status: 502,
            code: "NFITNESS_REMOTE_HUB_ERROR",
            retryable: true
        });
    }
    const resultEnvelope = Array.isArray(payload?.R) ? payload.R[0] : null;
    if (!resultEnvelope) {
        return null;
    }
    if (resultEnvelope.Left) {
        const message = normalizeHubError(resultEnvelope.Left);
        if (isUnauthenticatedHubError(message)) {
            throw new AppError("Your live gym session expired. Please sign in again.", {
                status: 401,
                code: "NFITNESS_SESSION_EXPIRED",
                retryable: false
            });
        }
        throw new AppError(message, {
            status: 502,
            code: "NFITNESS_REMOTE_HUB_LEFT_ERROR",
            retryable: true
        });
    }
    if (resultEnvelope.State !== 2) {
        throw new AppError("The live iClub request did not complete successfully.", {
            status: 502,
            code: "NFITNESS_REMOTE_HUB_STATE_ERROR",
            retryable: true
        });
    }
    if (!Array.isArray(resultEnvelope.Right)) {
        return resultEnvelope.Right ?? null;
    }
    if (resultEnvelope.Right.length === 0) {
        return [];
    }
    if (resultEnvelope.Right.length === 1) {
        return resultEnvelope.Right[0];
    }
    return resultEnvelope.Right;
}
export class SignalRConnection {
    logContext;
    socket = null;
    connectionToken = "";
    cookieHeader = "";
    started = false;
    requestSequence = 0;
    pending = new Map();
    log = logger.child({ scope: "iclub-signalr" });
    constructor(logContext = {}) {
        this.logContext = logContext;
        this.log = this.log.child(logContext);
    }
    async connect() {
        if (this.socket && this.started) {
            return;
        }
        const negotiateUrl = new URL(`${SIGNALR_PATH}/negotiate`, BASE_URL);
        negotiateUrl.searchParams.set("clientProtocol", "2.1");
        negotiateUrl.searchParams.set("connectionData", "[]");
        negotiateUrl.searchParams.set("_", String(Date.now()));
        this.log.info("signalr.negotiate.start");
        const negotiateResponse = await fetch(negotiateUrl, {
            headers: {
                accept: "application/json, text/plain, */*",
                "user-agent": "NFitness/1.0"
            }
        });
        if (!negotiateResponse.ok) {
            throw new AppError("The live iClub connection could not be negotiated.", {
                status: 502,
                code: "NFITNESS_SIGNALR_NEGOTIATE_FAILED",
                retryable: true
            });
        }
        const negotiate = (await negotiateResponse.json());
        this.connectionToken = negotiate.ConnectionToken;
        this.cookieHeader = buildCookieHeader(negotiateResponse);
        const socketUrl = new URL(`${SIGNALR_PATH}/connect`, BASE_URL.replace(/^http/i, "ws"));
        socketUrl.searchParams.set("transport", "webSockets");
        socketUrl.searchParams.set("clientProtocol", "2.1");
        socketUrl.searchParams.set("connectionToken", this.connectionToken);
        socketUrl.searchParams.set("connectionData", "[]");
        socketUrl.searchParams.set("tid", String(Math.floor(Math.random() * 11)));
        this.log.info("signalr.socket.open.start");
        await new Promise((resolve, reject) => {
            const socket = new WebSocket(socketUrl, {
                headers: this.cookieHeader ? { Cookie: this.cookieHeader } : undefined,
                origin: BASE_URL
            });
            const cleanup = () => {
                socket.removeAllListeners("open");
                socket.removeAllListeners("error");
            };
            socket.once("open", () => {
                cleanup();
                this.socket = socket;
                socket.on("message", (data) => this.handleMessage(data.toString()));
                socket.on("close", () => this.handleClose());
                socket.on("error", (error) => this.handleSocketError(error));
                resolve();
            });
            socket.once("error", (error) => {
                cleanup();
                reject(error);
            });
        });
        const startUrl = new URL(`${SIGNALR_PATH}/start`, BASE_URL);
        startUrl.searchParams.set("transport", "webSockets");
        startUrl.searchParams.set("clientProtocol", "2.1");
        startUrl.searchParams.set("connectionToken", this.connectionToken);
        startUrl.searchParams.set("connectionData", "[]");
        this.log.info("signalr.start.start");
        const startResponse = await fetch(startUrl, {
            headers: {
                accept: "application/json, text/plain, */*",
                ...(this.cookieHeader ? { cookie: this.cookieHeader } : {})
            }
        });
        if (!startResponse.ok) {
            throw new AppError("The live iClub session could not be started.", {
                status: 502,
                code: "NFITNESS_SIGNALR_START_FAILED",
                retryable: true
            });
        }
        this.started = true;
        this.log.info("signalr.connect.success");
    }
    async invoke(hub, method, args, timeoutMs = 20_000) {
        await this.connect();
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            throw new AppError("The live iClub connection is not open.", {
                status: 502,
                code: "NFITNESS_SIGNALR_SOCKET_NOT_OPEN",
                retryable: true
            });
        }
        const id = String(this.requestSequence++);
        const payload = JSON.stringify({
            H: hub,
            M: method,
            A: args,
            I: id
        });
        this.log.debug("signalr.invoke", { hub, method, id });
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.pending.delete(id);
                reject(new AppError("The iClub site took too long to respond. Please try again.", {
                    status: 504,
                    code: "NFITNESS_REMOTE_TIMEOUT",
                    retryable: true
                }));
            }, timeoutMs);
            this.pending.set(id, { resolve, reject, timeoutId });
            this.socket?.send(payload, (error) => {
                if (!error) {
                    return;
                }
                const pending = this.pending.get(id);
                if (!pending) {
                    return;
                }
                clearTimeout(pending.timeoutId);
                this.pending.delete(id);
                pending.reject(error);
            });
        });
    }
    async close() {
        this.started = false;
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timeoutId);
            pending.reject(new AppError("The live iClub connection was interrupted. Please retry in a moment.", {
                status: 502,
                code: "NFITNESS_REMOTE_UNAVAILABLE",
                retryable: true
            }));
        }
        this.pending.clear();
        await new Promise((resolve) => {
            if (!this.socket) {
                resolve();
                return;
            }
            const socket = this.socket;
            this.socket = null;
            socket.removeAllListeners("message");
            socket.removeAllListeners("error");
            socket.removeAllListeners("close");
            socket.once("close", () => resolve());
            socket.close();
            setTimeout(resolve, 1000);
        });
    }
    handleMessage(raw) {
        const trimmed = raw.trim();
        if (!trimmed || trimmed === "{}" || trimmed === "{\"S\":1,\"C\":\"d-0,0\"}") {
            return;
        }
        let payload;
        try {
            payload = JSON.parse(trimmed);
        }
        catch (error) {
            this.log.warn("signalr.message.parse-failed", { raw, error });
            return;
        }
        if (!payload?.I) {
            return;
        }
        const pending = this.pending.get(String(payload.I));
        if (!pending) {
            return;
        }
        clearTimeout(pending.timeoutId);
        this.pending.delete(String(payload.I));
        try {
            pending.resolve(unwrapHubResult(payload));
        }
        catch (error) {
            pending.reject(error);
        }
    }
    handleSocketError(error) {
        this.log.error("signalr.socket.error", { error });
    }
    handleClose() {
        this.log.warn("signalr.socket.closed");
        this.started = false;
        this.socket = null;
        for (const [id, pending] of this.pending.entries()) {
            clearTimeout(pending.timeoutId);
            pending.reject(new AppError("The live iClub connection was interrupted. Please retry in a moment.", {
                status: 502,
                code: "NFITNESS_REMOTE_UNAVAILABLE",
                retryable: true
            }));
            this.pending.delete(id);
        }
    }
}
export function createGuid() {
    return createMessageId();
}
