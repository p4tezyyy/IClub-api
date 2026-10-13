import crypto from "node:crypto";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const levelRank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const configuredLevel = (process.env.BACKEND_LOG_LEVEL?.toLowerCase() as LogLevel | undefined) ?? (process.env.BACKEND_DEBUG === "true" ? "debug" : "warn");

function shouldLog(level: LogLevel) {
  return levelRank[level] >= levelRank[configuredLevel];
}

function serializeError(error: unknown) {
  if (!(error instanceof Error)) {
    return error;
  }

  return {
    name: error.name,
    message: error.message,
    stack: process.env.BACKEND_DEBUG === "true" ? error.stack : undefined
  };
}

function print(level: LogLevel, message: string, context?: LogContext) {
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
  constructor(private readonly context: LogContext = {}) {}

  child(context: LogContext) {
    return new Logger({ ...this.context, ...context });
  }

  debug(message: string, context?: LogContext) {
    print("debug", message, { ...this.context, ...context });
  }

  info(message: string, context?: LogContext) {
    print("info", message, { ...this.context, ...context });
  }

  warn(message: string, context?: LogContext) {
    print("warn", message, { ...this.context, ...context });
  }

  error(message: string, context?: LogContext) {
    print("error", message, { ...this.context, ...context });
  }
}

export const logger = new Logger({ service: "nfitness-backend" });

export function createRequestId() {
  return crypto.randomUUID();
}
