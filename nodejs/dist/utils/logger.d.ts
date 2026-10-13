type LogContext = Record<string, unknown>;
export declare class Logger {
    private readonly context;
    constructor(context?: LogContext);
    child(context: LogContext): Logger;
    debug(message: string, context?: LogContext): void;
    info(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    error(message: string, context?: LogContext): void;
}
export declare const logger: Logger;
export declare function createRequestId(): `${string}-${string}-${string}-${string}-${string}`;
export {};
