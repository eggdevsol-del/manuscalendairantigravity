import { describe, it, expect } from 'vitest';
import { localToUTC, utcToLocal, formatForInput, formatLocalTime, isValidTimezone } from './timezone';

describe('Timezone Utils - SSOT Compliance', () => {
    const BRISBANE_TZ = 'Australia/Brisbane';

    describe('localToUTC', () => {
        it('converts 9am Brisbane to UTC correctly (UTC+10)', () => {
            // 9am Brisbane = 11pm previous day UTC (UTC+10)
            const local = '2026-02-15T09:00';
            const utc = localToUTC(local, BRISBANE_TZ);

            const utcDate = new Date(utc);
            expect(utcDate.getUTCHours()).toBe(23);
            expect(utcDate.getUTCDate()).toBe(14); // Previous day
            expect(utcDate.getUTCMonth()).toBe(1); // February (0-indexed)
        });

        it('converts 11am Brisbane to UTC correctly (UTC+10)', () => {
            // 11am Brisbane = 1am same day UTC (UTC+10)
            const local = '2026-02-15T11:00';
            const utc = localToUTC(local, BRISBANE_TZ);

            const utcDate = new Date(utc);
            expect(utcDate.getUTCHours()).toBe(1);
            expect(utcDate.getUTCDate()).toBe(15); // Same day
        });

        it('converts midnight Brisbane to UTC correctly', () => {
            // 12am Brisbane = 2pm previous day UTC (UTC+10)
            const local = '2026-02-15T00:00';
            const utc = localToUTC(local, BRISBANE_TZ);

            const utcDate = new Date(utc);
            expect(utcDate.getUTCHours()).toBe(14);
            expect(utcDate.getUTCDate()).toBe(14); // Previous day
        });
    });

    describe('utcToLocal', () => {
        it('converts UTC back to 9am Brisbane', () => {
            const utc = '2026-02-14T23:00:00.000Z'; // 11pm UTC
            const local = utcToLocal(utc, BRISBANE_TZ);

            expect(local.getHours()).toBe(9);
            expect(local.getDate()).toBe(15); // Next day in Brisbane
            expect(local.getMonth()).toBe(1); // February
        });

        it('converts UTC back to 11am Brisbane', () => {
            const utc = '2026-02-15T01:00:00.000Z'; // 1am UTC
            const local = utcToLocal(utc, BRISBANE_TZ);

            expect(local.getHours()).toBe(11);
            expect(local.getDate()).toBe(15);
        });
    });

    describe('Round-trip conversion - CRITICAL TEST', () => {
        it('9am-11am stays same day and time', () => {
            const originalStart = '2026-02-15T09:00';
            const originalEnd = '2026-02-15T11:00';

            // Convert to UTC
            const startUTC = localToUTC(originalStart, BRISBANE_TZ);
            const endUTC = localToUTC(originalEnd, BRISBANE_TZ);

            // Convert back to local
            const backToStart = formatForInput(startUTC, BRISBANE_TZ);
            const backToEnd = formatForInput(endUTC, BRISBANE_TZ);

            // CRITICAL: Times must match exactly
            expect(backToStart).toBe(originalStart);
            expect(backToEnd).toBe(originalEnd);

            // CRITICAL: Must be same day
            expect(backToStart.split('T')[0]).toBe(backToEnd.split('T')[0]);
            expect(backToStart.split('T')[0]).toBe('2026-02-15');
        });

        it('handles appointment spanning 9am-11am without day shift', () => {
            const start = '2026-02-15T09:00';
            const end = '2026-02-15T11:00';

            const startUTC = localToUTC(start, BRISBANE_TZ);
            const endUTC = localToUTC(end, BRISBANE_TZ);

            const startLocal = formatForInput(startUTC, BRISBANE_TZ);
            const endLocal = formatForInput(endUTC, BRISBANE_TZ);

            // Verify no day shift occurred
            const startDay = startLocal.split('T')[0];
            const endDay = endLocal.split('T')[0];

            expect(startDay).toBe(endDay);
            expect(startDay).toBe('2026-02-15');

            // Verify times are correct
            expect(startLocal.split('T')[1]).toBe('09:00');
            expect(endLocal.split('T')[1]).toBe('11:00');
        });

        it('handles full day of appointments without shifting', () => {
            const times = [
                '2026-02-15T08:00',
                '2026-02-15T10:00',
                '2026-02-15T12:00',
                '2026-02-15T14:00',
                '2026-02-15T16:00',
                '2026-02-15T18:00',
            ];

            for (const time of times) {
                const utc = localToUTC(time, BRISBANE_TZ);
                const backToLocal = formatForInput(utc, BRISBANE_TZ);

                expect(backToLocal).toBe(time);
                expect(backToLocal.split('T')[0]).toBe('2026-02-15');
            }
        });
    });

    describe('formatLocalTime', () => {
        it('formats time for display correctly', () => {
            const utc = '2026-02-14T23:00:00.000Z'; // 9am Brisbane

            const time12h = formatLocalTime(utc, BRISBANE_TZ, 'h:mm a');
            expect(time12h).toBe('9:00 AM');

            const time24h = formatLocalTime(utc, BRISBANE_TZ, 'HH:mm');
            expect(time24h).toBe('09:00');
        });

        it('formats date and time for display', () => {
            const utc = '2026-02-14T23:00:00.000Z'; // 9am Feb 15 Brisbane

            const formatted = formatLocalTime(utc, BRISBANE_TZ, 'PPp');
            expect(formatted).toContain('Feb');
            expect(formatted).toContain('15');
            expect(formatted).toContain('2026');
            expect(formatted).toContain('9:00');
        });
    });

    describe('isValidTimezone', () => {
        it('validates correct IANA timezones', () => {
            expect(isValidTimezone('Australia/Brisbane')).toBe(true);
            expect(isValidTimezone('America/New_York')).toBe(true);
            expect(isValidTimezone('Europe/London')).toBe(true);
            expect(isValidTimezone('Asia/Tokyo')).toBe(true);
        });

        it('rejects invalid timezones', () => {
            expect(isValidTimezone('Invalid/Timezone')).toBe(false);
            expect(isValidTimezone('Brisbane')).toBe(false);
            expect(isValidTimezone('UTC+10')).toBe(false);
            expect(isValidTimezone('')).toBe(false);
        });
    });

    describe('Edge cases', () => {
        it('handles end of month correctly', () => {
            const local = '2026-02-28T23:00'; // Last day of Feb
            const utc = localToUTC(local, BRISBANE_TZ);
            const backToLocal = formatForInput(utc, BRISBANE_TZ);

            expect(backToLocal).toBe(local);
        });

        it('handles year boundary correctly', () => {
            const local = '2026-12-31T23:00'; // New Year's Eve
            const utc = localToUTC(local, BRISBANE_TZ);
            const backToLocal = formatForInput(utc, BRISBANE_TZ);

            expect(backToLocal).toBe(local);
        });

        it('handles leap year correctly', () => {
            const local = '2024-02-29T09:00'; // Leap day
            const utc = localToUTC(local, BRISBANE_TZ);
            const backToLocal = formatForInput(utc, BRISBANE_TZ);

            expect(backToLocal).toBe(local);
        });
    });
});
