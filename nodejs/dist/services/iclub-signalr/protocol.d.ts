export declare class SignalRConnection {
    private readonly logContext;
    private socket;
    private connectionToken;
    private cookieHeader;
    private started;
    private requestSequence;
    private pending;
    private log;
    constructor(logContext?: Record<string, unknown>);
    connect(): Promise<void>;
    invoke(hub: string, method: string, args: unknown[], timeoutMs?: number): Promise<unknown>;
    close(): Promise<void>;
    private handleMessage;
    private handleSocketError;
    private handleClose;
}
export declare function createGuid(): `${string}-${string}-${string}-${string}-${string}`;
