import type { Page } from "playwright";

export const BASE_URL = "https://online.iclub.sk";
export const GYMS_CACHE_TTL_MS = 15 * 60 * 1000;
export const DASHBOARD_CACHE_TTL_MS = 10 * 1000;
export const PROFILE_CACHE_TTL_MS = 15 * 1000;
export const CALENDAR_CACHE_TTL_MS = 15 * 1000;
export const VISITS_CACHE_TTL_MS = 10 * 1000;
export const VISIT_DETAIL_CACHE_TTL_MS = 60 * 1000;

export type MetricCard = {
  label: string;
  value: string;
  actionLabel?: string;
};

export type DashboardClass = {
  id: number;
  title: string;
  trainer: string;
  time: string;
  occupancy: string;
  room?: string;
  day?: string;
};

export type RecentVisit = {
  transactionId?: number;
  date: string;
  time?: string;
  exitDate?: string;
  employee?: string;
  status?: string;
  description: string;
};

export type RecentBooking = {
  date: string;
  time: string;
  title: string;
  trainer: string;
  status?: string;
};

export type TimelineItem = {
  title: string;
  subtitle: string;
  dateLabel: string;
  kind: "visit" | "booking" | "payment";
};

export type VisitRecord = {
  transactionId: number;
  entryDate: string;
  exitDate: string;
  employee: string;
  status: string;
};

export interface IClubClientContext {
  getPage(): Page;
  goto(hashPath: string): Promise<Page>;
  withCache<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T>;
  clearCache(prefix?: string): void;
  getQrPage(): Promise<Page>;
  extractQrCodeDataUrlFrom(page: Page): Promise<string | undefined>;
}
