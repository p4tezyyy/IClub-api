import type { Page } from "playwright";
export type ApiErrorPayload = {
    error: string;
    code: string;
    retryable: boolean;
};
export declare class AppError extends Error {
    status: number;
    code: string;
    retryable: boolean;
    constructor(message: string, options?: {
        status?: number;
        code?: string;
        retryable?: boolean;
    });
}
export declare function normalizeError(error: unknown): AppError;
export declare function toApiErrorPayload(error: unknown): {
    status: number;
    body: ApiErrorPayload;
};
export declare function readVisibleIClubError(page: Page): Promise<string | null>;
