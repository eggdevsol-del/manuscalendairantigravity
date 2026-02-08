import { zonedTimeToUtc, utcToZonedTime, format } from 'date-fns-tz';
import { parseISO } from 'date-fns';

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
    const zonedDate = zonedTimeToUtc(localInput, timezone);
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
    return utcToZonedTime(utcDate, timezone);
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
    return format(localDate, "yyyy-MM-dd'T'HH:mm", { timeZone: timezone });
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
    formatString: string = 'PPp'
): string {
    const localDate = utcToLocal(utcISO, timezone);
    return format(localDate, formatString, { timeZone: timezone });
}

/**
 * Get business timezone (from settings or default)
 * TODO: Fetch from artist settings when available
 * @returns IANA timezone string
 */
export function getBusinessTimezone(): string {
    // Default to Australia/Brisbane
    // In future, fetch from artist settings
    return 'Australia/Brisbane';
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
    const isHex = color.startsWith('#');

    if (isHex) {
        // Convert opacity to hex (0-1 to 00-FF)
        const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
        return `${color}${alpha}`;
    } else {
        // Assume oklch or other CSS color
        return `oklch(from ${color} l c h / ${opacity})`;
    }
}
