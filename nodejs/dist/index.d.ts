/** Unofficial iClub SDK. Uses observed SignalR calls; no association with iClub. */
import { IClubClient } from "./services/iclub-client.js";
export { AppError as IClubError } from "./utils/app-error.js";
export { SignalRConnection, createGuid } from "./services/iclub-signalr/protocol.js";
export { IClubSignalRSession, getSignalRGyms } from "./services/iclub-signalr/client.js";
export type { VisitRecord } from "./services/iclub/types.js";
export type Gym = {
    id: string;
    name: string;
};
export type CalendarOptions = {
    start?: string;
    end?: string;
    view?: "week" | "month";
};
export type Registration = {
    gymName: string;
    gender: "man" | "woman";
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    acceptPrivacyPolicy: boolean;
    acceptTerms: boolean;
    agreeNewsletter?: boolean;
};
export declare class IClub {
    private core;
    static listGyms(): Promise<Gym[]>;
    listGyms(): Promise<Gym[]>;
    login(email: string, password: string, gymName: string): Promise<void>;
    getUser(): Promise<{
        UserId: number;
        Email?: string;
        FullName?: string;
        SessionId?: string | null;
        FirstName?: string;
        LastName?: string;
    } & {
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
    }>;
    getCustomerStats(): Promise<{
        LastVisitDate?: string | null;
        TotalVisitsCount?: number | null;
        CurrentMonthVisitsCount?: number | null;
        ValidTicketsCount?: number | null;
        LastCreditCharge?: string | null;
        LastCreditChargeAmount?: number | null;
    }>;
    getAvailableTickets(): Promise<any[]>;
    getMemberships(): Promise<any[]>;
    getHomePageText(): Promise<string>;
    getCredit(): Promise<{
        balance: number | null;
        bonusBalance: number | null;
        totalBalance: number | null;
        topUpAllowed: boolean;
        minTopUp: number | null;
    }>;
    getVisitsTransactions(limit?: number): Promise<{
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
    }[]>;
    getSalesTransactions(limit?: number): Promise<{
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
    }[]>;
    getPayments(limit?: number): Promise<{
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
    }[]>;
    getTransaction(id: number | string): Promise<{
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
    }>;
    getVisitHistory(): Promise<{
        visits: import("./services/iclub/types.js").VisitRecord[];
    }>;
    getVisitDetail(id: number): Promise<{
        transactionId: number;
        ticketType: string | undefined;
        billingType: string | undefined;
        transactionStatus: string;
        entryDate: string | undefined;
        exitDate: string | undefined;
        totalTime: string | undefined;
        discountName: undefined;
        billingDesk: undefined;
        loggedInBy: string | undefined;
        loggedOutBy: string | undefined;
        appliedCredit: string | undefined;
        totalWithVat: string | undefined;
        goodsServices: {
            name: string;
            price: string | undefined;
            discount: string | undefined;
            quantity: string | undefined;
            totalUnitPrice: string | undefined;
        }[];
        rented: {
            name: string;
            price: string | undefined;
            discount: string | undefined;
            quantity: string | undefined;
            totalUnitPrice: string | undefined;
        }[];
    }>;
    getCustomerEvents(at?: Date): Promise<{
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
    }[]>;
    getRooms(): Promise<{
        RoomId: number;
        Name?: string | null;
    }[]>;
    getRoomsEvents(startIso: string, endIso: string): Promise<{
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
    }[]>;
    getCalendar(options?: CalendarOptions): Promise<{
        view: "month" | "week";
        rangeLabel: string;
        rangeStart: string;
        rangeEnd: string;
        roomLabel: string;
        events: {
            id: number;
            time: string;
            title: string;
            trainer: string;
            occupancy: string;
            startDate?: string;
            endDate?: string;
            attendeesCount?: number;
            capacity?: number;
            ended?: boolean;
            booked?: boolean;
            color?: string;
            fontColor?: string;
            room?: string;
            day?: string;
        }[];
        upcomingMessage: string;
    }>;
    getEventDetail(id: number, options?: CalendarOptions): Promise<{
        title: string;
        fields: {
            label: string;
            value: string;
        }[];
        primaryActionLabel: string | undefined;
    }>;
    reserveEvent(id: number, options?: CalendarOptions): Promise<{
        message: string;
        action: string;
        confirmed: boolean;
    }>;
    getProfile(): Promise<{
        member: {
            name: any;
            location: string;
            loyalty: never[];
        };
        metrics: {
            label: string;
            value: string;
        }[];
        contactInfo: {
            readonly gender: "male" | "female";
            readonly firstName: string;
            readonly lastName: string;
            readonly email: string;
            readonly phoneNumber: string;
            readonly addressLine: string;
            readonly city: string;
            readonly zipCode: string;
            readonly country: string;
            readonly marketingConsent: boolean;
        };
        memberships: {
            columns: string[];
            rows: string[][];
            emptyMessage?: undefined;
        } | {
            columns: string[];
            rows: never[];
            emptyMessage: string;
        };
        history: {
            columns: string[];
            rows: string[][];
            emptyMessage?: undefined;
        } | {
            columns: string[];
            rows: never[];
            emptyMessage: string;
        };
        payments: {
            columns: string[];
            rows: string[][];
            emptyMessage?: undefined;
        } | {
            columns: string[];
            rows: never[];
            emptyMessage: string;
        };
        creditText: string;
        creditDeposit: {
            enabled: boolean;
            currentBalanceText: string;
            minAmount: number;
            minAmountText: string;
            ctaLabel: string;
            helperText: string;
        };
    }>;
    getDashboard(): Promise<{
        title: string;
        member: {
            name: any;
            location: string;
            loyalty: never[];
        };
        hero: {
            heading: string;
            subheading: string;
            badge: string;
        };
        activeSession: {
            isActive: boolean;
            transactionId: number;
            entryDate: string;
            employee: string;
            status: string;
            durationLabel: string | undefined;
            note: string;
        } | {
            isActive: boolean;
            transactionId: number;
            entryDate: string;
            employee: string;
            status: string;
            note: string;
            durationLabel?: undefined;
        };
        metrics: {
            label: string;
            value: string;
        }[];
        overviewMessage: string;
        streakDays: number;
        visitsLast7Days: number;
        visitsLast30Days: number;
        insightStats: {
            label: string;
            value: string;
            tone: string;
        }[];
        attendanceSeries: {
            label: string;
            value: number;
        }[];
        weekdayDistribution: {
            label: string;
            value: number;
        }[];
        occupancySeries: never[];
        upcomingClasses: never[];
        recentVisits: import("./services/iclub/types.js").RecentVisit[];
        recentBookings: never[];
        activityTimeline: import("./services/iclub/types.js").TimelineItem[];
    }>;
    updateContactInformation(contact: Parameters<IClubClient["updateContactInformation"]>[0]): Promise<{
        message: string;
        profile: {
            member: {
                name: any;
                location: string;
                loyalty: never[];
            };
            metrics: {
                label: string;
                value: string;
            }[];
            contactInfo: {
                readonly gender: "male" | "female";
                readonly firstName: string;
                readonly lastName: string;
                readonly email: string;
                readonly phoneNumber: string;
                readonly addressLine: string;
                readonly city: string;
                readonly zipCode: string;
                readonly country: string;
                readonly marketingConsent: boolean;
            };
            memberships: {
                columns: string[];
                rows: string[][];
                emptyMessage?: undefined;
            } | {
                columns: string[];
                rows: never[];
                emptyMessage: string;
            };
            history: {
                columns: string[];
                rows: string[][];
                emptyMessage?: undefined;
            } | {
                columns: string[];
                rows: never[];
                emptyMessage: string;
            };
            payments: {
                columns: string[];
                rows: string[][];
                emptyMessage?: undefined;
            } | {
                columns: string[];
                rows: never[];
                emptyMessage: string;
            };
            creditText: string;
            creditDeposit: {
                enabled: boolean;
                currentBalanceText: string;
                minAmount: number;
                minAmountText: string;
                ctaLabel: string;
                helperText: string;
            };
        };
    }>;
    changePassword(oldPassword: string, newPassword: string, confirmation: string): Promise<{
        message: string;
    }>;
    prepareCreditDeposit(amount: number): Promise<{
        message: string;
        redirectUrl: string;
    }>;
    getLiveQrCode(): Promise<{
        qrCodeDataUrl: string | undefined;
    }>;
    resetQrPage(): Promise<void>;
    /** Advanced: remote hub may expose mutations; avoid undocumented calls on accounts you do not own. */
    rawInvoke(hub: string, method: string, args?: unknown[], withContext?: boolean): Promise<unknown>;
    static register(details: Registration): Promise<{
        message: string;
    }>;
    close(): Promise<void>;
    logout(): Promise<void>;
}
