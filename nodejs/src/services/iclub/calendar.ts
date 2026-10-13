import { cleanText } from "../../utils/parse.js";
import type { IClubClientContext } from "./types.js";
import { CALENDAR_CACHE_TTL_MS } from "./types.js";

export async function getCalendar(client: IClubClientContext) {
  return client.withCache("calendar", CALENDAR_CACHE_TTL_MS, async () => {
    const page = await client.goto("#/rezervacie/rozvrh");
    const rangeLabel = cleanText(await page.getByRole("heading", { level: 2 }).textContent());
    const roomLabel = cleanText(await page.getByRole("combobox", { name: /Select room/i }).textContent());
    const upcomingMessage = cleanText(await page.locator("text=/You are not assigned to any event|Your upcoming events:/i").first().textContent());

    const events = await page.evaluate(() => {
      const dayNames = Array.from(document.querySelectorAll("[role='columnheader'], .fc-col-header-cell")).map((node) => (node.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean);
      const seen = new Set<string>();
      const results: Array<{ id: number; time: string; title: string; trainer: string; occupancy: string; room?: string; day?: string }> = [];
      const eventNodes = Array.from(document.querySelectorAll(".fc-event, [class*='fc-event']"));

      eventNodes.forEach((node, index) => {
        const text = (node.textContent || "").replace(/\s+/g, " ").trim();
        if (!text) {
          return;
        }

        const time = text.match(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/)?.[0] ?? "";
        const occupancy = text.match(/\d+\s*\/\s*\d+/)?.[0] ?? "";
        const withoutMeta = text.replace(time, "").replace(occupancy, "").trim();
        const trainerMatch = withoutMeta.match(/([\p{L}][\p{L}' -]+)$/u);
        const trainer = trainerMatch?.[1]?.trim() ?? "";
        const title = withoutMeta.replace(trainer, "").trim();
        const key = `${time}-${title}-${trainer}-${occupancy}`;

        if (!title || seen.has(key)) {
          return;
        }

        seen.add(key);
        const day = dayNames[Math.min(dayNames.length - 1, Math.floor(index / 6) + 1)] || undefined;
        results.push({ id: results.length, time, title, trainer, occupancy, day });
      });

      return results;
    });

    return { rangeLabel, roomLabel, events, upcomingMessage };
  });
}

export async function getEventDetail(client: IClubClientContext, eventId: number) {
  const page = await client.goto("#/rezervacie/rozvrh");
  const event = page.locator(".fc-event, [class*='fc-event']").nth(eventId);
  await event.click();

  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ timeout: 10_000 });

  const title = cleanText(await dialog.getByRole("heading").textContent());
  const fields = await dialog.evaluate((node) => {
    const paragraphs = Array.from(node.querySelectorAll("p")).map((element: any) => (element.textContent || "").replace(/\s+/g, " ").trim());
    const pairs: Array<{ label: string; value: string }> = [];
    for (let index = 0; index < paragraphs.length; index += 2) {
      const label = paragraphs[index];
      const value = paragraphs[index + 1];
      if (label && value) {
        pairs.push({ label, value });
      }
    }
    return pairs;
  });

  const buttons = await dialog.getByRole("button").allTextContents();
  const primaryActionLabel = buttons.map(cleanText).find((label) => !/^Cancel$/i.test(label));
  await dialog.getByRole("button", { name: /^Cancel$/i }).click();

  return { title, fields, primaryActionLabel };
}

// Booking is implemented safely in IClubBrowserClient.reserveEventByMatch.
// Intentionally do not expose the original EventId-as-array-index behavior.
