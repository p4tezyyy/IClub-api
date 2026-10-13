import crypto from "node:crypto";
import { AppError } from "../../utils/app-error.js";
import { logger } from "../../utils/logger.js";
import { SignalRConnection, createGuid } from "./protocol.js";

type IClubContext = {
  Ident: string;
  SessionId: string;
  DefaultCulture: string;
};

type GymRecord = {
  id: string;
  name: string;
};

type LoginUser = {
  UserId: number;
  Email?: string;
  FullName?: string;
  SessionId?: string | null;
  FirstName?: string;
  LastName?: string;
};

type CustomerStats = {
  LastVisitDate?: string | null;
  TotalVisitsCount?: number | null;
  CurrentMonthVisitsCount?: number | null;
  ValidTicketsCount?: number | null;
  LastCreditCharge?: string | null;
  LastCreditChargeAmount?: number | null;
};

type CustomerUser = LoginUser & {
  Gender?: number | null;
  PhoneNumber?: string | null;
  MarketingConsent?: boolean | null;
  DataPrivacyConsent?: boolean | null;
  GeneralConsent?: boolean | null;
  CreditAccountAllowed?: boolean | null;
  AddressLine?: string | null;
  City?: string | null;
  ZipCode?: string | null;
  Country?: number | string | null;
  CreditBalance?: number | null;
  Account?: {
    Balance?: number | null;
    BonusBalance?: number | null;
    TotalBalance?: number | null;
    AccountType?: {
      Name?: string | null;
      MinChargeAmount?: number | null;
      ChargeCreditGood?: { Name?: string | null } | null;
    } | null;
  } | null;
  CardCode?: string | null;
  EmailVerified?: boolean | null;
};

type SubmitUserPayload = {
  Gender: number;
  FirstName: string;
  LastName: string;
  Email: string;
  PhoneNumber: string | null;
  AddressLine: string | null;
  City: string | null;
  ZipCode: string | null;
  Country: number | string | null;
  MarketingConsent: number;
  UserId: number;
};

type TransactionRecord = {
  TransactionId: number;
  TransactionTypeId?: number | null;
  PersonId?: number | null;
  DiscountId?: number | null;
  AccountTypeId?: number | null;
  Ticket?: { Name?: string | null } | string | null;
  EntryDate?: string | null;
  ExitDate?: string | null;
  Duration?: string | null;
  LoginAuthType?: string | null;
  LogoutAuthType?: string | null;
  EmployeeName?: string | null;
  ClosedByEmployeeName?: string | null;
  TransactionStatus?: number | null;
  Note?: string | null;
  TotalWithVat?: number | null;
  CreditChange?: number | null;
  TotalCreditChange?: number | null;
  GoodsList?: Array<{
    Name?: string | null;
    Price?: number | null;
    Discount?: number | null;
    Quantity?: number | null;
    TotalUnitPrice?: number | null;
  }> | null;
  RentsList?: Array<{
    Name?: string | null;
    Price?: number | null;
    Discount?: number | null;
    Quantity?: number | null;
    TotalUnitPrice?: number | null;
  }> | null;
};

type TransactionListPayload = {
  Transactions?: TransactionRecord[];
  TotalCount?: number;
};

type RoomRecord = {
  RoomId: number;
  Name?: string | null;
};

type CalendarEventRecord = {
  EventId: number;
  Name?: string | null;
  TrainerName?: string | null;
  RoomName?: string | null;
  RoomId?: number | null;
  StartDate?: string | null;
  EndDate?: string | null;
  Duration?: number | null;
  Capacity?: number | null;
  AttendeesCount?: number | null;
  Ended?: boolean | null;
  CurrentUserLoggedIn?: boolean | null;
  AddingAttendeesAllowed?: boolean | null;
  Status?: number | null;
};

let gymsCache: { value: GymRecord[]; expiresAt: number } | null = null;
let gymsInflight: Promise<GymRecord[]> | null = null;

const GYM_CACHE_TTL_MS = 15 * 60 * 1000;
const log = logger.child({ scope: "iclub-signalr-client" });

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password, "utf8").digest("base64");
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function formatMoney(value?: number | null) {
  const amount = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return amount.toFixed(2).replace(".", ",");
}

function mapTransactionStatus(status?: number | null) {
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

function formatLocalDateTime(iso?: string | null) {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function mapCountry(value?: string | number | null) {
  if (value === 187 || value === "187") {
    return "Slovakia";
  }

  return typeof value === "string" && value.trim() ? value.trim() : "Club member";
}

function buildGymLabel(client: Record<string, unknown>) {
  const parts = [
    client.Name,
    client.ShopName,
    client.CompanyName,
    client.FullDetail
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  return parts[0] ?? "";
}

function collectGyms(value: unknown, result: GymRecord[], seen: Set<string>) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectGyms(item, result, seen);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;
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
    const gyms: GymRecord[] = [];
    collectGyms(raw, gyms, new Set<string>());
    const sorted = gyms.sort((left, right) => left.name.localeCompare(right.name));

    if (!sorted.length) {
      throw new AppError("The iClub gym list could not be loaded.", {
        status: 502,
        code: "NFITNESS_GYM_LIST_EMPTY",
        retryable: true
      });
    }

    return sorted;
  } finally {
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
  } catch (error) {
    log.warn("gyms.warm.failed", { error });
  }
}

export class IClubSignalRSession {
  private connection: SignalRConnection;
  private ctx: IClubContext | null = null;
  private userId: number | null = null;
  private userEmail = "";
  private log: ReturnType<typeof logger.child>;

  constructor(private readonly clientId: string) {
    this.connection = new SignalRConnection({ clientId });
    this.log = logger.child({ scope: "iclub-signalr-session", clientId });
  }

  async login(email: string, password: string, gymName: string) {
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
    ], 25_000) as LoginUser | null;

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
  async rawInvoke(hub: string, method: string, args: unknown[] = [], withContext = true) {
    if (!withContext) {
      return this.connection.invoke(hub, method, args);
    }
    if (!this.ctx) {
      throw new AppError("Log in before calling an authenticated hub.", { status: 401, code: "ICLUB_SESSION_REQUIRED" });
    }
    return this.connection.invoke(hub, method, [this.ctx, ...args]);
  }

  async getUser() {
    return this.invokeWithContext<CustomerUser>("personworkflowhub", "GetUser", [createGuid(), this.requireUserId()]);
  }

  async getCustomerStats() {
    return this.invokeWithContext<CustomerStats>("personworkflowhub", "GetCustomerStats", [createGuid(), this.requireUserId()]);
  }

  async getAvailableTickets() {
    return this.invokeWithContext<any[]>("ticketworkflowhub", "GetCustomerAvailableTickets", [createGuid(), this.requireUserId(), 0, 0, false]);
  }

  async getHomePageText() {
    const value = await this.invokeWithContext<unknown>("settingworkflowhub", "GetHomePageText", [createGuid()]);
    return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
  }

  async getVisitsTransactions(limit = 20) {
    const payload = await this.invokeWithContext<TransactionListPayload>("transactionworkflowhub", "GetVisitsTransactions", [createGuid(), this.requireUserId(), 0, limit]);
    return payload?.Transactions ?? [];
  }

  async getSalesTransactions(limit = 20) {
    const payload = await this.invokeWithContext<TransactionListPayload>("transactionworkflowhub", "GetSalesTransactions", [createGuid(), this.requireUserId(), 0, limit]);
    return payload?.Transactions ?? [];
  }

  async getTransaction(transactionId: number | string) {
    return this.invokeWithContext<TransactionRecord>("transactionworkflowhub", "GetTransaction", [
      createGuid(),
      String(transactionId)
    ]);
  }

  async getCustomerEvents(at = new Date()) {
    const value = await this.invokeWithContext<CalendarEventRecord[]>("reservationworkflowhub", "GetCustomerEvents", [
      createGuid(),
      this.requireUserId(),
      at.toISOString()
    ]);
    return Array.isArray(value) ? value : [];
  }

  async getRooms() {
    const value = await this.invokeWithContext<RoomRecord[]>("reservationworkflowhub", "GetRooms", [
      createGuid(),
      1,
      0
    ]);
    return Array.isArray(value) ? value : [];
  }

  async getRoomsEvents(startIso: string, endIso: string) {
    const value = await this.invokeWithContext<CalendarEventRecord[]>("reservationworkflowhub", "GetRoomsEvents", [
      createGuid(),
      0,
      startIso,
      endIso
    ]);
    return Array.isArray(value) ? value : [];
  }

  async submitUser(payload: SubmitUserPayload) {
    const result = await this.invokeWithContext<unknown>("personworkflowhub", "SubmitUser", [
      createGuid(),
      payload
    ]);
    return result === true;
  }

  async changePassword(oldPassword: string, newPassword: string) {
    const result = await this.invokeWithContext<unknown>("authenticationworkflowhub", "ChangePassword", [
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
    } catch (error) {
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

  private async invokeWithContext<T>(hub: string, method: string, args: unknown[], timeoutMs = 20_000) {
    if (!this.ctx) {
      throw new AppError("Your live gym session expired. Please sign in again.", {
        status: 401,
        code: "NFITNESS_SESSION_EXPIRED"
      });
    }

    return this.connection.invoke(hub, method, [this.ctx, ...args], timeoutMs) as Promise<T>;
  }

  private requireUserId() {
    if (!this.userId) {
      throw new AppError("Your live gym session expired. Please sign in again.", {
        status: 401,
        code: "NFITNESS_SESSION_EXPIRED"
      });
    }

    return this.userId;
  }
}
