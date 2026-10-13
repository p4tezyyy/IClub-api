import type { TimelineItem, VisitRecord } from "./iclub/types.js";
export interface IClubSessionClient {
    getClientId(): string;
    login(email: string, password: string, gymName: string): Promise<void>;
    register?(payload: unknown): Promise<unknown>;
    getDashboard(): Promise<unknown>;
    getLiveQrCode(): Promise<unknown>;
    resetQrPage(): Promise<void>;
    getVisitHistory(): Promise<unknown>;
    getVisitDetail(transactionId: number): Promise<unknown>;
    getProfile(): Promise<unknown>;
    prepareCreditDeposit(amount: number): Promise<unknown>;
    updateContactInformation(payload: {
        gender: "male" | "female";
        firstName: string;
        lastName: string;
        email: string;
        phoneNumber: string;
        addressLine: string;
        city: string;
        zipCode: string;
        country: string;
        marketingConsent: boolean;
    }): Promise<unknown>;
    changePassword(oldPassword: string, newPassword: string, newPasswordAgain: string): Promise<unknown>;
    getCalendar(options?: {
        start?: string;
        end?: string;
        view?: "week" | "month";
    }): Promise<unknown>;
    getEventDetail(eventId: number, options?: {
        start?: string;
        end?: string;
        view?: "week" | "month";
    }): Promise<unknown>;
    reserveEvent(eventId: number): Promise<unknown>;
    dispose(): Promise<void>;
}
export declare class IClubClient implements IClubSessionClient {
    private readonly clientId;
    private readonly signalr;
    private legacyClient;
    private readonly responseCache;
    private email;
    private password;
    private gymName;
    private legacyWarmupPromise;
    private readonly log;
    static getGyms(): Promise<{
        id: string;
        name: string;
    }[]>;
    static warmGymCache(): Promise<void>;
    getClientId(): `${string}-${string}-${string}-${string}-${string}`;
    login(email: string, password: string, gymName: string): Promise<void>;
    /** Expose the supported raw hub methods without HTML scraping. */
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
    getHomePageText(): Promise<string>;
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
    getTransaction(id: string | number): Promise<{
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
    rawInvoke(hub: string, method: string, args?: unknown[], withContext?: boolean): Promise<unknown>;
    getCredit(): Promise<{
        balance: number | null;
        bonusBalance: number | null;
        totalBalance: number | null;
        topUpAllowed: boolean;
        minTopUp: number | null;
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
        recentVisits: import("./iclub/types.js").RecentVisit[];
        recentBookings: never[];
        activityTimeline: TimelineItem[];
    }>;
    getLiveQrCode(): Promise<{
        qrCodeDataUrl: string | undefined;
    }>;
    resetQrPage(): Promise<void>;
    getVisitHistory(): Promise<{
        visits: VisitRecord[];
    }>;
    getVisitDetail(transactionId: number): Promise<{
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
    prepareCreditDeposit(amount: number): Promise<{
        message: string;
        redirectUrl: string;
    }>;
    updateContactInformation(payload: {
        gender: "male" | "female";
        firstName: string;
        lastName: string;
        email: string;
        phoneNumber: string;
        addressLine: string;
        city: string;
        zipCode: string;
        country: string;
        marketingConsent: boolean;
    }): Promise<{
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
    changePassword(oldPassword: string, newPassword: string, newPasswordAgain: string): Promise<{
        message: string;
    }>;
    getCalendar(options?: {
        start?: string;
        end?: string;
        view?: "week" | "month";
    }): Promise<{
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
    getEventDetail(eventId: number, options?: {
        start?: string;
        end?: string;
        view?: "week" | "month";
    }): Promise<{
        title: string;
        fields: {
            label: string;
            value: string;
        }[];
        primaryActionLabel: string | undefined;
    }>;
    reserveEvent(eventId: number, options?: {
        start?: string;
        end?: string;
        view?: "week" | "month";
    }): Promise<{
        message: string;
        action: string;
        confirmed: boolean;
    }>;
    dispose(): Promise<void>;
    private ensureLegacyClient;
    private prewarmLegacyQr;
    private withCache;
}
export declare function warmGymCache(): Promise<void>;
