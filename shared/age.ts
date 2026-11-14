export const MINIMUM_BOOKING_AGE = 18;
export const UNDERAGE_MESSAGE =
  "You must be 18 or over to request a tattoo booking.";

/** Parses a strict YYYY-MM-DD calendar date; null for anything else (including 2024-02-30). */
export function parseDateOfBirth(value: unknown): CalendarDate | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]),
    month = Number(match[2]),
    day = Number(match[3]);
  if (year < 1900) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return { year, month, day };
}

export type CalendarDate = { year: number; month: number; day: number };

export const DEFAULT_AGE_CHECK_TIME_ZONE = "Australia/Brisbane";

/**
 * The calendar date it is right now in an IANA time zone. The server uses the
 * artist's zone so the 18th birthday starts when it does at the studio, not
 * when it does in UTC. An unknown zone falls back to the default.
 */
export function calendarDateInTimeZone(
  timeZone: string | null | undefined,
  now = new Date()
): CalendarDate {
  const read = (zone: string) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const part = (type: string) =>
      Number(parts.find(item => item.type === type)?.value);
    return { year: part("year"), month: part("month"), day: part("day") };
  };
  try {
    return read(timeZone || DEFAULT_AGE_CHECK_TIME_ZONE);
  } catch {
    return read(DEFAULT_AGE_CHECK_TIME_ZONE);
  }
}

/**
 * Whole years of age on `today`. A Date is read in the runtime's own time
 * zone (the browser hint); the server passes a CalendarDate instead.
 * Null when the date of birth is not a real date or is in the future.
 */
export function ageInYears(
  value: unknown,
  today: Date | CalendarDate = new Date()
): number | null {
  const born = parseDateOfBirth(value);
  if (!born) return null;
  const { year, month, day } =
    today instanceof Date
      ? {
          year: today.getFullYear(),
          month: today.getMonth() + 1,
          day: today.getDate(),
        }
      : today;
  let age = year - born.year;
  // A 29 February birthday counts from 1 March in non-leap years.
  if (month < born.month || (month === born.month && day < born.day)) age--;
  return age < 0 ? null : age;
}

export function isAdult(
  value: unknown,
  today: Date | CalendarDate = new Date()
): boolean {
  const age = ageInYears(value, today);
  return age !== null && age >= MINIMUM_BOOKING_AGE;
}
