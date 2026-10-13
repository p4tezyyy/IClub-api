import crypto from "node:crypto";
const levelRank = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40
};
const configuredLevel = process.env.BACKEND_LOG_LEVEL?.toLowerCase() ?? (process.env.BACKEND_DEBUG === "true" ? "debug" : "warn");
function shouldLog(level) {
    return levelRank[level] >= levelRank[configuredLevel];
}
function serializeError(error) {
    if (!(error instanceof Error)) {
        return error;
    }
    return {
        name: error.name,
        message: error.message,
        stack: process.env.BACKEND_DEBUG === "true" ? error.stack : undefined
    };
}
function print(level, message, context) {
    if (!shouldLog(level)) {
        return;
    }
    const payload = {
        ts: new Date().toISOString(),
        level,
        msg: message,
        ...(context ? Object.fromEntries(Object.entries(context).map(([key, value]) => [key, value instanceof Error ? serializeError(value) : value])) : {})
    };
    // Avoid leaking account emails, auth tokens, and passwords to stdout.
    const line = JSON.stringify(payload, (key, value) => /email|password|token|cookie|sessionid/i.test(key) ? "[REDACTED]" : value);
    if (level === "error") {
        console.error(line);
        return;
    }
    if (level === "warn") {
        console.warn(line);
        return;
    }
    console.log(line);
}
export class Logger {
    context;
    constructor(context = {}) {
        this.context = context;
    }
    child(context) {
        return new Logger({ ...this.context, ...context });
    }
    debug(message, context) {
        print("debug", message, { ...this.context, ...context });
    }
    info(message, context) {
        print("info", message, { ...this.context, ...context });
    }
    warn(message, context) {
        print("warn", message, { ...this.context, ...context });
    }
    error(message, context) {
        print("error", message, { ...this.context, ...context });
    }
}
export const logger = new Logger({ service: "nfitness-backend" });
export function createRequestId() {
    return crypto.randomUUID();
}
