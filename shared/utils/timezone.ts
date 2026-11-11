import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { parseISO, format } from "date-fns";

/**
 * SSOT Timezone Utilities
 *
 * All appointment times are stored in UTC ISO format in the database.
 * These utilities handle conversion between local and UTC times.
 */

/**
 * Convert local datetime-local input to UTC ISO string
 * @param localInput - "YYYY-MM-DDTHH:mm" from datetime-local input
 * @param timezone - IANA timezone (e.g. "Australia/Brisbane")
 * @returns UTC ISO string for database storage
 *
 * @example
 * localToUTC("2026-02-15T09:00", "Australia/Brisbane")
 * // Returns: "2026-02-14T23:00:00.000Z" (UTC+10)
 */
export function localToUTC(localInput: string, timezone: string): string {
  // Parse the local input as if it's in the specified timezone
  const zonedDate = fromZonedTime(localInput, timezone);
  return zonedDate.toISOString();
}

/**
 * Convert UTC ISO string to local time in specified timezone
 * @param utcISO - UTC ISO string from database
 * @param timezone - IANA timezone
 * @returns Date object in local timezone
 *
 * @example
 * utcToLocal("2026-02-14T23:00:00.000Z", "Australia/Brisbane")
 * // Returns: Date object representing 2026-02-15 09:00 in Brisbane
 */
export function utcToLocal(utcISO: string, timezone: string): Date {
  const utcDate = parseISO(utcISO);
  return toZonedTime(utcDate, timezone);
}

/**
 * Format UTC time for datetime-local input
 * @param utcISO - UTC ISO string from database
 * @param timezone - IANA timezone
 * @returns "YYYY-MM-DDTHH:mm" for datetime-local input
 *
 * @example
 * formatForInput("2026-02-14T23:00:00.000Z", "Australia/Brisbane")
 * // Returns: "2026-02-15T09:00"
 */
export function formatForInput(utcISO: string, timezone: string): string {
  const localDate = utcToLocal(utcISO, timezone);
  return format(localDate, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Format UTC time for display
 * @param utcISO - UTC ISO string from database
 * @param timezone - IANA timezone
 * @param formatString - date-fns format string (default: 'PPp' = "Apr 29, 2026, 9:00 AM")
 * @returns Formatted string in local timezone
 *
 * @example
 * formatLocalTime("2026-02-14T23:00:00.000Z", "Australia/Brisbane", "h:mm a")
 * // Returns: "9:00 AM"
 */
export function formatLocalTime(
  utcISO: string,
  timezone: string,
  formatString: string = "PPp"
): string {
  const localDate = utcToLocal(utcISO, timezone);
  return format(localDate, formatString);
}

export const DEFAULT_TIMEZONE = "Australia/Brisbane";
/** Zones offered in Business details. Any valid IANA zone is accepted by the server. */
export const BUSINESS_TIMEZONES: { id: string; label: string }[] = [
  { id: "Australia/Brisbane", label: "Brisbane (Queensland)" },
  { id: "Australia/Sydney", label: "Sydney, Canberra (NSW, ACT)" },
  { id: "Australia/Melbourne", label: "Melbourne (Victoria)" },
  { id: "Australia/Hobart", label: "Hobart (Tasmania)" },
  { id: "Australia/Adelaide", label: "Adelaide (South Australia)" },
  { id: "Australia/Darwin", label: "Darwin (Northern Territory)" },
  { id: "Australia/Perth", label: "Perth (Western Australia)" },
  { id: "Pacific/Auckland", label: "Auckland, Wellington (New Zealand)" },
];
/**
 * The zone a business works in: the artist's saved zone when it is valid, otherwise the default.
 * Pass the artist's `artistSettings.timeZone`.
 * @returns IANA timezone string
 */
export function getBusinessTimezone(preferred?: string | null): string {
  return preferred && isValidTimezone(preferred) ? preferred : DEFAULT_TIMEZONE;
}

/**
 * Validate IANA timezone string
 * @param timezone - Timezone string to validate
 * @returns true if valid IANA timezone
 *
 * @example
 * isValidTimezone("Australia/Brisbane") // true
 * isValidTimezone("Invalid/Timezone")   // false
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get service color with opacity for appointment display
 * Helper to generate color strings with opacity
 *
 * @param color - Service color (hex or CSS variable)
 * @param opacity - Opacity value (0-1)
 * @returns Color string with opacity
 */
export function getColorWithOpacity(color: string, opacity: number): string {
  const isHex = color.startsWith("#");

  if (isHex) {
    // Convert opacity to hex (0-1 to 00-FF)
    const alpha = Math.round(opacity * 255)
      .toString(16)
      .padStart(2, "0");
    return `${color}${alpha}`;
  } else {
    // Assume oklch or other CSS color
    return `oklch(from ${color} l c h / ${opacity})`;
  }
}
