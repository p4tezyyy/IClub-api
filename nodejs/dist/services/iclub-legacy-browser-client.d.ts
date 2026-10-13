import type { Page } from "playwright";
import { type IClubClientContext } from "./iclub/types.js";
export declare class IClubBrowserClient implements IClubClientContext {
    private clientId;
    private log;
    private context;
    private page;
    private qrPage;
    private responseCache;
    private inflightRequests;
    private pageTaskQueue;
    static getGyms(): Promise<{
        id: string;
        name: string;
    }[]>;
    getClientId(): `${string}-${string}-${string}-${string}-${string}`;
    private resolveGymOption;
    private openSelectedGym;
    private waitForLoginPage;
    private hasVisibleLoginFields;
    private getEmailInput;
    private getPasswordInput;
    private getLoginButton;
    private tryFallbackLoginRoute;
    private openGymAuthPage;
    login(email: string, password: string, gymName: string): Promise<void>;
    register({ gymName, gender, firstName, lastName, phone, email, acceptPrivacyPolicy, acceptTerms, agreeNewsletter }: {
        gymName: string;
        gender: "man" | "woman";
        firstName: string;
        lastName: string;
        phone: string;
        email: string;
        acceptPrivacyPolicy: boolean;
        acceptTerms: boolean;
        agreeNewsletter: boolean;
    }): Promise<{
        message: string;
    }>;
    changePassword(oldPassword: string, newPassword: string, newPasswordAgain: string): Promise<{
        message: string;
    }>;
    prepareCreditDeposit(amount: number): Promise<{
        message: string;
        redirectUrl: string;
    }>;
    dispose(): Promise<void>;
    getPage(): Page;
    goto(hashPath: string): Promise<Page>;
    clearCache(prefix?: string): void;
    withCache<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T>;
    runWithPageLock<T>(taskName: string, task: () => Promise<T>): Promise<T>;
    extractQrCodeDataUrlFrom(page: Page): Promise<string | undefined>;
    getQrPage(): Promise<Page>;
    warmLiveQr(): Promise<void>;
    resetQrPage(): Promise<void>;
    getLiveQrCode(): Promise<{
        qrCodeDataUrl: string | undefined;
    }>;
    getDashboard(): Promise<{
        title: string;
        member: {
            name: string;
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
        metrics: import("./iclub/types.js").MetricCard[];
        overviewMessage: string;
        streakDays: number;
        visitsLast7Days: number;
        visitsLast30Days: number;
        insightStats: {
            label: string;
            value: string;
            change: string;
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
        occupancySeries: {
            label: string;
            value: number;
        }[];
        upcomingClasses: {
            id: number;
            time: string;
            title: string;
            trainer: string;
            occupancy: string;
            day?: string;
        }[];
        recentVisits: import("./iclub/types.js").RecentVisit[];
        recentBookings: import("./iclub/types.js").RecentBooking[];
        activityTimeline: import("./iclub/types.js").TimelineItem[];
    }>;
    getVisitHistory(): Promise<{
        visits: import("./iclub/types.js").VisitRecord[];
    }>;
    getVisitDetail(transactionId: number): Promise<{
        transactionId: number;
        ticketType: string | undefined;
        billingType: string | undefined;
        transactionStatus: string | undefined;
        entryDate: string | undefined;
        exitDate: string | undefined;
        totalTime: string | undefined;
        discountName: string | undefined;
        billingDesk: string | undefined;
        loggedInBy: string | undefined;
        loggedOutBy: string | undefined;
        appliedCredit: string | undefined;
        totalWithVat: string | undefined;
        goodsServices: {
            name: string;
            price?: string;
            discount?: string;
            quantity?: string;
            totalUnitPrice?: string;
        }[];
        rented: {
            name: string;
            price?: string;
            discount?: string;
            quantity?: string;
            totalUnitPrice?: string;
        }[];
    }>;
    getProfile(): Promise<{
        member: {
            name: string;
            location: string;
            loyalty: never[];
        };
        metrics: import("./iclub/types.js").MetricCard[];
        memberships: {
            columns: string[];
            rows: never[];
            emptyMessage: string;
        };
        history: {
            columns: string[];
            rows: never[];
            emptyMessage: string;
        } | {
            columns: string[];
            rows: string[][];
        };
        payments: {
            columns: string[];
            rows: never[];
            emptyMessage: string;
        } | {
            columns: string[];
            rows: string[][];
        };
        creditText: string;
    }>;
    getCalendar(): Promise<{
        rangeLabel: string;
        roomLabel: string;
        events: {
            id: number;
            time: string;
            title: string;
            trainer: string;
            occupancy: string;
            room?: string;
            day?: string;
        }[];
        upcomingMessage: string;
    }>;
    getEventDetail(eventId: number): Promise<{
        title: string;
        fields: {
            label: string;
            value: string;
        }[];
        primaryActionLabel: string | undefined;
    }>;
    /** Match by title/time/trainer, never by remote EventId as a DOM array index. */
    reserveEventByMatch(event: {
        title: string;
        startDate: string;
        trainer?: string;
    }): Promise<{
        message: string;
        action: string;
        confirmed: boolean;
    }>;
    reserveEvent(_eventId: number): Promise<void>;
}
