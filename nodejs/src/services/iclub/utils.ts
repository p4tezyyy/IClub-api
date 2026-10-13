import type { Page } from "playwright";
import type { RecentVisit, VisitRecord } from "./types.js";

export function parseMetricNumber(value: string) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseLocalDate(dateValue: string) {
  const match = dateValue.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

export function parseLocalDateTime(dateValue: string) {
  const match = dateValue.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (!match) {
    return null;
  }

  const [, day, month, year, hours = "0", minutes = "0"] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes));
}

export function diffInDays(from: Date, to: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.floor((end - start) / msPerDay);
}

export function buildAttendanceSeriesFromVisits(visits: VisitRecord[], now: Date) {
  const bucketLabels = ["Week 1", "Week 2", "Week 3", "Week 4"];
  const buckets = [0, 0, 0, 0];

  for (const visit of visits) {
    const visitDate = parseLocalDateTime(visit.entryDate);
    if (!visitDate) {
      continue;
    }

    const daysAgo = diffInDays(visitDate, now);
    if (daysAgo < 0 || daysAgo > 27) {
      continue;
    }

    const bucketIndex = 3 - Math.floor(daysAgo / 7);
    if (bucketIndex >= 0 && bucketIndex < buckets.length) {
      buckets[bucketIndex] += 1;
    }
  }

  return bucketLabels.map((label, index) => ({ label, value: buckets[index] }));
}

export function buildWeekdayDistributionFromVisits(visits: VisitRecord[]) {
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const counts = [0, 0, 0, 0, 0, 0, 0];

  for (const visit of visits) {
    const visitDate = parseLocalDateTime(visit.entryDate);
    if (!visitDate) {
      continue;
    }

    counts[visitDate.getDay()] += 1;
  }

  return dayLabels.map((label, index) => ({ label, value: counts[index] }));
}

export function computeVisitStreakDays(visits: VisitRecord[]) {
  const uniqueDays = Array.from(new Set(visits.map((visit) => visit.entryDate.split(" ")[0]).filter(Boolean)))
    .map((value) => parseLocalDate(value))
    .filter((value): value is Date => Boolean(value))
    .sort((left, right) => right.getTime() - left.getTime());

  if (!uniqueDays.length) {
    return 0;
  }

  const today = new Date();
  const latestDay = uniqueDays[0];
  const latestGap = diffInDays(latestDay, today);

  // A current streak only counts if the last workout was today or yesterday.
  if (latestGap > 1 || latestGap < 0) {
    return 0;
  }

  let streak = 1;
  for (let index = 1; index < uniqueDays.length; index += 1) {
    const previous = uniqueDays[index - 1];
    const current = uniqueDays[index];
    if (diffInDays(current, previous) === 1) {
      streak += 1;
      continue;
    }
    break;
  }

  return streak;
}

export function mapVisitRecordToRecentVisit(visit: VisitRecord): RecentVisit {
  return {
    transactionId: visit.transactionId,
    date: visit.entryDate.split(" ")[0] || "Unknown",
    time: visit.entryDate.split(" ")[1],
    exitDate: visit.exitDate,
    employee: visit.employee,
    status: visit.status,
    description: `Entry - ${visit.employee}`
  };
}

export function isPlaceholderOverview(value: string) {
  return /pripravujeme|preparing/i.test(value);
}

export async function safeTextContent(locator: ReturnType<Page["locator"]>, timeout = 1200) {
  return locator.first().textContent({ timeout }).catch(() => null);
}
