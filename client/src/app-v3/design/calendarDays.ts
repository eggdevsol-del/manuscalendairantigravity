/* Pure helpers for the iOS Modern endless calendar: working hours, free time, time-sized layout, and the
   days an artist saves for a client from "Fill this day". Kept apart so they can be tested without the API. */
import { parseTime } from "@shared/bookingAvailability";

export type CalendarSitting = {
  id: number | string;
  startTime: string | Date;
  endTime?: string | Date | null;
  status?: string;
};

const HOUR = 3600000;
const ms = (v: string | Date) => new Date(v).getTime();
const end = (s: CalendarSitting) =>
  s.endTime ? ms(s.endTime) : ms(s.startTime) + 2 * HOUR;
const minutes = (value?: string) => {
  const t = value ? parseTime(value) : null;
  return t ? t.hour * 60 + t.minute : null;
};

export function startOfDay(t: number | Date) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
export const addDays = (day: number, n: number) => {
  const d = new Date(day);
  d.setDate(d.getDate() + n);
  return d.getTime();
};

/** Work schedules are stored as JSON text, either an array of days or an object keyed by day. */
export function parseSchedule(value: unknown): any[] {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (Array.isArray(parsed)) return parsed;
  return parsed && typeof parsed === "object" ? Object.values(parsed) : [];
}

/** Opening hours for a day, in minutes from midnight. A day off gets a standard 9:30–5:30 day, flagged closed. */
export function hoursFor(schedule: any[], day: number) {
  const name = new Date(day).toLocaleDateString("en-US", { weekday: "long" });
  const row = schedule.find(
    d => String(d?.day || "").toLowerCase() === name.toLowerCase()
  );
  const start = minutes(row?.start || row?.startTime);
  const close = minutes(row?.end || row?.endTime);
  if (!row?.enabled || start === null || close === null || close <= start)
    return { open: false, start: 570, end: 1050, breaks: 0 };
  const breaks = (row.breaks || []).reduce((sum: number, b: any) => {
    const a = minutes(b.start || b.startTime);
    const z = minutes(b.end || b.endTime);
    return a !== null && z !== null && z > a ? sum + z - a : sum;
  }, 0);
  return { open: true, start, end: close, breaks };
}

/** Free working minutes: opening hours less breaks and bookings. */
export function freeMinutes(
  schedule: any[],
  day: number,
  sittings: CalendarSitting[]
) {
  const h = hoursFor(schedule, day);
  const booked = sittings
    .filter(s => s.status !== "cancelled")
    .reduce((sum, s) => sum + (end(s) - ms(s.startTime)) / 60000, 0);
  return Math.max(0, Math.round(h.end - h.start - h.breaks - booked));
}

/** Days from today onward with at least two free hours can be filled. Past days never can. */
export function canFill(free: number, day: number, now: number) {
  return day >= startOfDay(now) && free >= 120;
}

/** Lays a day's sittings down a column so each card is as tall as the sitting is long. */
export function dayColumn(
  sittings: CalendarSitting[],
  day: number,
  now: number,
  pxPerHour = 40
) {
  let h0 = 8;
  let h1 = 20;
  for (const s of sittings) {
    h0 = Math.min(h0, new Date(s.startTime).getHours());
    h1 = Math.max(h1, Math.ceil((end(s) - day) / HOUR));
  }
  const top = day + h0 * HOUR;
  const y = (t: number) => ((t - top) / HOUR) * pxPerHour;
  const ticks = [];
  for (let h = h0; h <= h1; h += 2)
    ticks.push({
      top: (h - h0) * pxPerHour,
      label: new Date(day + h * HOUR)
        .toLocaleTimeString("en-AU", { hour: "numeric" })
        .replace(" ", "")
        .toLowerCase(),
    });
  const cards = [...sittings]
    .sort((a, b) => ms(a.startTime) - ms(b.startTime))
    .map(s => {
      const height = Math.max(54, ((end(s) - ms(s.startTime)) / HOUR) * pxPerHour - 4);
      return {
        sitting: s,
        top: y(ms(s.startTime)) + 2,
        height,
        short: height < 90,
        live:
          s.status !== "cancelled" && ms(s.startTime) <= now && end(s) > now,
      };
    });
  const nowLine = now > top && now < day + h1 * HOUR ? y(now) : null;
  return { height: (h1 - h0) * pxPerHour + 12, ticks, cards, nowLine };
}

export function duration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}

// ── Saved days ─────────────────────────────────────────────
// "Quote for this day" remembers the date for that client on this device, and the booking composer
// offers it when you book them. Keys are "client:<id>" and "conversation:<id>" so either side can find it.
const STORE = "tattoi:saved-days:v1";
type SavedDays = Record<string, string>;

function readSaved(): SavedDays {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}
function writeSaved(days: SavedDays) {
  try {
    localStorage.setItem(STORE, JSON.stringify(days));
  } catch {}
}
export const savedKeys = (
  clientId?: string | null,
  conversationId?: number | null
) =>
  [
    clientId ? `client:${clientId}` : "",
    conversationId ? `conversation:${conversationId}` : "",
  ].filter(Boolean);

/** Saves a day (yyyy-MM-dd) for a client. */
export function saveDay(keys: string[], date: string) {
  const days = readSaved();
  for (const k of keys) days[k] = date;
  writeSaved(days);
}
/** The saved day for any of these keys, if it hasn't passed. */
export function savedDay(keys: string[], now = Date.now()) {
  const days = readSaved();
  const today = new Date(startOfDay(now)).toLocaleDateString("en-CA");
  for (const k of keys) if (days[k] && days[k] >= today) return days[k];
  return null;
}
export function forgetDay(keys: string[]) {
  const days = readSaved();
  for (const k of keys) delete days[k];
  writeSaved(days);
}
