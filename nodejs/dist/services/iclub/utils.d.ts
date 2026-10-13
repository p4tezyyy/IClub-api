import type { Page } from "playwright";
import type { RecentVisit, VisitRecord } from "./types.js";
export declare function parseMetricNumber(value: string): number;
export declare function parseLocalDate(dateValue: string): Date | null;
export declare function parseLocalDateTime(dateValue: string): Date | null;
export declare function diffInDays(from: Date, to: Date): number;
export declare function buildAttendanceSeriesFromVisits(visits: VisitRecord[], now: Date): {
    label: string;
    value: number;
}[];
export declare function buildWeekdayDistributionFromVisits(visits: VisitRecord[]): {
    label: string;
    value: number;
}[];
export declare function computeVisitStreakDays(visits: VisitRecord[]): number;
export declare function mapVisitRecordToRecentVisit(visit: VisitRecord): RecentVisit;
export declare function isPlaceholderOverview(value: string): boolean;
export declare function safeTextContent(locator: ReturnType<Page["locator"]>, timeout?: number): Promise<string | null>;
