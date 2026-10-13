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
            ChargeCreditGood?: {
                Name?: string | null;
            } | null;
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
    Ticket?: {
        Name?: string | null;
    } | string | null;
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
declare function formatMoney(value?: number | null): string;
declare function mapTransactionStatus(status?: number | null): string;
declare function formatLocalDateTime(iso?: string | null): string;
declare function mapCountry(value?: string | number | null): string;
export declare function getSignalRGyms(): Promise<GymRecord[]>;
export declare function warmSignalRGymCache(): Promise<void>;
export declare class IClubSignalRSession {
    private readonly clientId;
    private connection;
    private ctx;
    private userId;
    private userEmail;
    private log;
    constructor(clientId: string);
    login(email: string, password: string, gymName: string): Promise<LoginUser>;
    /** Advanced low-level hub access. May mutate remote account data. */
    rawInvoke(hub: string, method: string, args?: unknown[], withContext?: boolean): Promise<unknown>;
    getUser(): Promise<CustomerUser>;
    getCustomerStats(): Promise<CustomerStats>;
    getAvailableTickets(): Promise<any[]>;
    getHomePageText(): Promise<string>;
    getVisitsTransactions(limit?: number): Promise<TransactionRecord[]>;
    getSalesTransactions(limit?: number): Promise<TransactionRecord[]>;
    getTransaction(transactionId: number | string): Promise<TransactionRecord>;
    getCustomerEvents(at?: Date): Promise<CalendarEventRecord[]>;
    getRooms(): Promise<RoomRecord[]>;
    getRoomsEvents(startIso: string, endIso: string): Promise<CalendarEventRecord[]>;
    submitUser(payload: SubmitUserPayload): Promise<boolean>;
    changePassword(oldPassword: string, newPassword: string): Promise<boolean>;
    logout(): Promise<void>;
    close(): Promise<void>;
    static formatMoney: typeof formatMoney;
    static formatLocalDateTime: typeof formatLocalDateTime;
    static mapTransactionStatus: typeof mapTransactionStatus;
    static mapCountry: typeof mapCountry;
    private invokeWithContext;
    private requireUserId;
}
export {};
