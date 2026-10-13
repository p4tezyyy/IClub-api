import type { Page } from "playwright";

export type ApiErrorPayload = {
  error: string;
  code: string;
  retryable: boolean;
};

export class AppError extends Error {
  status: number;
  code: string;
  retryable: boolean;

  constructor(message: string, options?: { status?: number; code?: string; retryable?: boolean }) {
    super(message);
    this.name = "AppError";
    this.status = options?.status ?? 500;
    this.code = options?.code ?? "NFITNESS_UNKNOWN_ERROR";
    this.retryable = options?.retryable ?? false;
  }
}

function looksLikeCredentialError(message: string) {
  return /invalid|incorrect|wrong password|wrong e-mail|wrong email|bad credentials|authentication failed/i.test(message);
}

function looksLikeTimeout(message: string) {
  return /timeout|timed out|exceeded/i.test(message);
}

function looksLikeRemoteOutage(message: string) {
  return /net::|navigation|target page, context or browser has been closed|browser context is not initialized|browser session is not initialized/i.test(message);
}

export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const message = error instanceof Error ? error.message : "Unexpected error";

  if (looksLikeCredentialError(message)) {
    return new AppError("The gym account credentials were rejected. Check the selected gym, email, and password.", {
      status: 401,
      code: "NFITNESS_INVALID_CREDENTIALS"
    });
  }

  if (/No active browser session/i.test(message)) {
    return new AppError("Your live gym session expired. Please sign in again.", {
      status: 401,
      code: "NFITNESS_SESSION_EXPIRED"
    });
  }

  if (/No active booking action was available/i.test(message)) {
    return new AppError("This class cannot be booked right now.", {
      status: 409,
      code: "NFITNESS_BOOKING_UNAVAILABLE"
    });
  }

  if (/Failed to decode live QR update/i.test(message)) {
    return new AppError("The live QR update could not be read. Trying again.", {
      status: 502,
      code: "NFITNESS_QR_DECODE_FAILED",
      retryable: true
    });
  }

  if (looksLikeTimeout(message)) {
    return new AppError("The iClub site took too long to respond. Please try again.", {
      status: 504,
      code: "NFITNESS_REMOTE_TIMEOUT",
      retryable: true
    });
  }

  if (looksLikeRemoteOutage(message)) {
    return new AppError("The live iClub connection was interrupted. Please retry in a moment.", {
      status: 502,
      code: "NFITNESS_REMOTE_UNAVAILABLE",
      retryable: true
    });
  }

  return new AppError("The live iClub request failed. Please try again.", {
    status: 500,
    code: "NFITNESS_REMOTE_ERROR",
    retryable: true
  });
}

export function toApiErrorPayload(error: unknown): { status: number; body: ApiErrorPayload } {
  const normalized = normalizeError(error);
  return {
    status: normalized.status,
    body: {
      error: normalized.message,
      code: normalized.code,
      retryable: normalized.retryable
    }
  };
}

export async function readVisibleIClubError(page: Page) {
  const selectors = [
    "[role='alert']",
    ".mat-mdc-snack-bar-label",
    ".mdc-snackbar__label",
    ".mat-mdc-form-field-error",
    ".error",
    ".alert",
    ".toast-message"
  ];

  const text = await page.evaluate((candidateSelectors: string[]) => {
    const normalize = (value: string | null | undefined) => (value || "").replace(/\s+/g, " ").trim();

    for (const selector of candidateSelectors) {
      const nodes = Array.from(document.querySelectorAll(selector));
      for (const node of nodes) {
        const textContent = normalize(node.textContent);
        if (textContent) {
          return textContent;
        }
      }
    }

    return "";
  }, selectors).catch(() => "");

  return text || null;
}
