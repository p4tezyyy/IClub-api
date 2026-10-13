import type { IClubClientContext, MetricCard, RecentBooking, TimelineItem } from "./types.js";
export declare function scrapeMemberSummary(client: IClubClientContext): Promise<{
    name: string;
    location: string;
    loyalty: never[];
}>;
export declare function scrapeMetrics(client: IClubClientContext): Promise<MetricCard[]>;
export declare function scrapeUpcomingClasses(client: IClubClientContext, limit?: number): Promise<{
    id: number;
    time: string;
    title: string;
    trainer: string;
    occupancy: string;
    day?: string;
}[]>;
export declare function scrapeRecentBookings(client: IClubClientContext, limit?: number): Promise<RecentBooking[]>;
export declare function scrapePayments(client: IClubClientContext, limit?: number): Promise<{
    date: string;
    total: string;
    employee: string;
    status: string;
    transactionId: string;
}[]>;
export declare function getDashboard(client: IClubClientContext): Promise<{
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
    metrics: MetricCard[];
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
    recentVisits: import("./types.js").RecentVisit[];
    recentBookings: RecentBooking[];
    activityTimeline: TimelineItem[];
}>;
export declare function getProfile(client: IClubClientContext): Promise<{
    member: {
        name: string;
        location: string;
        loyalty: never[];
    };
    metrics: MetricCard[];
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
