import { TRPCError } from "@trpc/server";

// --- Types ---
export interface WorkDay {
    day: string;
    enabled: boolean;
    start?: string;
    startTime?: string;
    end?: string;
    endTime?: string;
}

export interface AppointmentInterval {
    startTime: Date;
    endTime: Date;
}

export interface ProjectAvailabilityInput {
    serviceDuration: number;
    sittings: number;
    frequency: "single" | "consecutive" | "weekly" | "biweekly" | "monthly";
    startDate: Date;
    workSchedule: any[];
    existingAppointments: AppointmentInterval[];
    timeZone: string;
}

// --- Helpers ---

/**
 * Parses a time string (e.g., "14:30", "02:30 PM") into hours and minutes.
 */
export function parseTime(timeStr: string): { hour: number; minute: number } | null {
    if (!timeStr) return null;
    try {
        const normalized = timeStr.trim().toUpperCase();
        let hour = 0;
        let minute = 0;

        const isPM = normalized.includes("PM");
        const isAM = normalized.includes("AM");

        const cleanTime = normalized.replace("PM", "").replace("AM", "").trim();
        const parts = cleanTime.split(":");

        if (parts.length < 2) return null;

        hour = parseInt(parts[0], 10);
        minute = parseInt(parts[1], 10);

        if (isNaN(hour) || isNaN(minute)) return null;

        if (isPM && hour < 12) hour += 12;
        if (isAM && hour === 12) hour = 0;

        return { hour, minute };
    } catch (e) {
        return null;
    }
}

/**
 * Parses and normalizes the work schedule from the DB (JSON).
 */
export function parseWorkSchedule(scheduleJson: string | any): WorkDay[] {
    try {
        if (!scheduleJson) {
            console.warn("parseWorkSchedule received empty schedule");
            return [];
        }

        let schedule: any;
        if (typeof scheduleJson === 'string') {
            try {
                schedule = JSON.parse(scheduleJson);
            } catch (e) {
                console.error("Failed to parse work schedule JSON string", e);
                return [];
            }
        } else {
            schedule = scheduleJson;
        }

        if (schedule && typeof schedule === 'object' && !Array.isArray(schedule)) {
            // Convert object { monday: {...} } to array [ { day: 'Monday', ... } ]
            return Object.entries(schedule).map(([key, value]: [string, any]) => ({
                day: key.charAt(0).toUpperCase() + key.slice(1),
                ...(typeof value === 'object' ? value : {})
            }));
        } else if (Array.isArray(schedule)) {
            return schedule;
        }
        return [];
    } catch (e) {
        console.error("Unexpected error in parseWorkSchedule", e);
        return [];
    }
}

/**
 * Finds the maximum consecutive minutes available in the work schedule.
 */
export function getMaxDailyMinutes(workSchedule: WorkDay[]): number {
    return workSchedule.reduce((max, day) => {
        if (!day.enabled) return max;
        const startStr = day.start || day.startTime;
        const endStr = day.end || day.endTime;

        if (!startStr || !endStr) return max;

        const s = parseTime(startStr);
        const e = parseTime(endStr);

        if (!s || !e) return max;

        let startMins = s.hour * 60 + s.minute;
        let endMins = e.hour * 60 + e.minute;

        if (endMins < startMins) endMins += 24 * 60; // Overnight

        return Math.max(max, endMins - startMins);
    }, 0);
}

/**
 * Core Algorithm: Finds the next available slot of X minutes.
 */
export function findNextAvailableSlot(
    startDate: Date,
    durationMinutes: number,
    workSchedule: WorkDay[],
    existingAppointments: AppointmentInterval[],
    timeZone: string
): Date | null {
    const endSearchLimit = new Date(startDate);
    endSearchLimit.setFullYear(endSearchLimit.getFullYear() + 1);

    // Re-implementing the loop to be robust:
    let searchPointer = new Date(startDate);

    // Ensure 30 min alignment
    const rem = searchPointer.getMinutes() % 30;
    if (rem !== 0) searchPointer.setMinutes(searchPointer.getMinutes() + (30 - rem));
    searchPointer.setSeconds(0);
    searchPointer.setMilliseconds(0);

    // Debug log
    const failureLog: string[] = [];
    console.log(`[BookingService] Searching for slot from ${searchPointer.toISOString()} in TZ: ${timeZone}`);

    while (searchPointer < endSearchLimit) {
        // 1. Is this time within working hours?
        const dayName = searchPointer.toLocaleDateString("en-US", { weekday: "long", timeZone });
        const schedule = workSchedule.find((d) => d.day && d.day.toLowerCase() === dayName.toLowerCase());

        if (schedule && schedule.enabled) {
            const s = parseTime(schedule.start || schedule.startTime || "");
            const e = parseTime(schedule.end || schedule.endTime || "");

            if (s && e) {
                // Get current time in TZ
                const timeParts = Intl.DateTimeFormat('en-US', {
                    timeZone,
                    hour: 'numeric', minute: 'numeric',
                    hour12: false
                }).formatToParts(searchPointer);

                const hourPart = timeParts.find(p => p.type === 'hour')?.value;
                const minPart = timeParts.find(p => p.type === 'minute')?.value;

                // Handle "24" hour issue if sometimes returned
                let currentH = parseInt(hourPart || "0");
                if (currentH === 24) currentH = 0;
                const currentM = parseInt(minPart || "0");

                const currentTotal = currentH * 60 + currentM;
                const startTotal = s.hour * 60 + s.minute;
                const endTotal = e.hour * 60 + e.minute;

                if (currentTotal >= startTotal && (currentTotal + durationMinutes) <= endTotal) {
                    // Check appointments
                    const potentialEnd = new Date(searchPointer.getTime() + durationMinutes * 60000);
                    const hasCollision = existingAppointments.some((appt) => {
                        const apptStart = new Date(appt.startTime);
                        const apptEnd = new Date(appt.endTime);
                        return searchPointer < apptEnd && potentialEnd > apptStart;
                    });

                    if (!hasCollision) {
                        return new Date(searchPointer);
                    } else {
                        if (failureLog.length < 5) failureLog.push(`${dayName} ${currentH}:${currentM} Collision`);
                    }
                } else {
                    // Only log if inside the "day" but outside hours
                    if (currentTotal > startTotal - 60 && currentTotal < endTotal + 60 && failureLog.length < 5) {
                        failureLog.push(`${dayName} ${currentH}:${currentM} Outside (${startTotal}-${endTotal} vs ${currentTotal}+${durationMinutes})`);
                    }
                }
            } else {
                if (failureLog.length < 1) failureLog.push(`${dayName} ParseFail`);
            }
        }

        // Advance 30 mins
        searchPointer.setTime(searchPointer.getTime() + 30 * 60000);
    }

    // Throw detailed error
    const debugMsg = failureLog.join('\n');
    throw new Error(`SLOT_SEARCH_FAILED:::${debugMsg}`);
}

/**
 * Optimized findNextAvailableSlot that iterates days, then constructs start/end times.
 */
export function findNextAvailableSlotOptimized(
    startDate: Date,
    durationMinutes: number,
    workSchedule: WorkDay[],
    existingAppointments: AppointmentInterval[],
    timeZone: string
): Date | null {
    const endSearchLimit = new Date(startDate);
    endSearchLimit.setFullYear(endSearchLimit.getFullYear() + 1);

    // Re-implementing the loop to be robust:
    let searchPointer = new Date(startDate);

    // Ensure 30 min alignment
    const rem = searchPointer.getMinutes() % 30;
    if (rem !== 0) searchPointer.setMinutes(searchPointer.getMinutes() + (30 - rem));
    searchPointer.setSeconds(0);
    searchPointer.setMilliseconds(0);

    // Debug log
    console.log(`[BookingService] Searching for slot from ${searchPointer.toISOString()} in TZ: ${timeZone}`);


    while (searchPointer < endSearchLimit) {
        // 1. Is this time within working hours?
        const dayName = searchPointer.toLocaleDateString("en-US", { weekday: "long", timeZone });
        const schedule = workSchedule.find((d) => d.day && d.day.toLowerCase() === dayName.toLowerCase());

        if (schedule && schedule.enabled) {
            const s = parseTime(schedule.start || schedule.startTime || "");
            const e = parseTime(schedule.end || schedule.endTime || "");

            if (s && e) {
                // Get current time in TZ
                const timeParts = Intl.DateTimeFormat('en-US', {
                    timeZone,
                    hour: 'numeric', minute: 'numeric',
                    hour12: false
                }).formatToParts(searchPointer);

                const hourPart = timeParts.find(p => p.type === 'hour')?.value;
                const minPart = timeParts.find(p => p.type === 'minute')?.value;

                // Handle "24" hour issue if sometimes returned
                let currentH = parseInt(hourPart || "0");
                if (currentH === 24) currentH = 0;
                const currentM = parseInt(minPart || "0");

                const currentTotal = currentH * 60 + currentM;
                const startTotal = s.hour * 60 + s.minute;
                const endTotal = e.hour * 60 + e.minute;

                if (currentTotal >= startTotal && (currentTotal + durationMinutes) <= endTotal) {
                    // Check appointments
                    const potentialEnd = new Date(searchPointer.getTime() + durationMinutes * 60000);
                    const hasCollision = existingAppointments.some((appt) => {
                        const apptStart = new Date(appt.startTime);
                        const apptEnd = new Date(appt.endTime);
                        return searchPointer < apptEnd && potentialEnd > apptStart;
                    });

                    if (!hasCollision) {
                        return new Date(searchPointer);
                    }
                }
            }
        }

        // Advance 30 mins
        searchPointer.setTime(searchPointer.getTime() + 30 * 60000);
    }

    return null;
}

/**
 * Validates if a specific time slot falls within working hours.
 */
export function validateAppointmentForWorkHours(
    startTime: Date,
    durationMinutes: number,
    workSchedule: WorkDay[],
    timeZone: string
): { valid: boolean; reason?: string } {
    const dayName = startTime.toLocaleDateString("en-US", { weekday: "long", timeZone });
    const schedule = workSchedule.find((d) => d.day && d.day.toLowerCase() === dayName.toLowerCase());

    if (!schedule || !schedule.enabled) {
        return { valid: false, reason: `Work day (${dayName}) is disabled.` };
    }

    const s = parseTime(schedule.start || schedule.startTime || "");
    const e = parseTime(schedule.end || schedule.endTime || "");

    if (!s || !e) {
        return { valid: false, reason: `Invalid schedule hours for ${dayName}.` };
    }

    // Get current time in TZ
    const timeParts = Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: 'numeric', minute: 'numeric',
        hour12: false
    }).formatToParts(startTime);

    const hourPart = timeParts.find(p => p.type === 'hour')?.value;
    const minPart = timeParts.find(p => p.type === 'minute')?.value;

    let currentH = parseInt(hourPart || "0");
    if (currentH === 24) currentH = 0;
    const currentM = parseInt(minPart || "0");

    const currentTotal = currentH * 60 + currentM;
    const startTotal = s.hour * 60 + s.minute;
    const endTotal = e.hour * 60 + e.minute;

    if (currentTotal < startTotal) {
        return { valid: false, reason: `Start time (${currentH}:${currentM}) is before opening (${startTotal / 60}).` };
    }

    if (currentTotal + durationMinutes > endTotal) {
        return { valid: false, reason: `End time extends past closing.` };
    }

    return { valid: true };
}



/**
 * Main Orchestrator: Calculates dates for a multi-sitting project.
 */
export function calculateProjectDates(input: ProjectAvailabilityInput): Date[] {
    const suggestedDates: Date[] = [];
    let currentDateSearch = new Date(input.startDate);

    // Initial past-date correction
    if (currentDateSearch < new Date()) {
        currentDateSearch = new Date();
        currentDateSearch.setMinutes(Math.ceil(currentDateSearch.getMinutes() / 30) * 30);
        currentDateSearch.setSeconds(0);
        currentDateSearch.setMilliseconds(0);
    }

    // Clone appointments so we can "book" them temporarily to prevent self-overlap
    const tempAppointments = [...input.existingAppointments];

    for (let i = 0; i < input.sittings; i++) {
        let slot: Date | null = null;
        try {
            slot = findNextAvailableSlot(
                currentDateSearch,
                input.serviceDuration,
                input.workSchedule,
                tempAppointments,
                input.timeZone
            );
        } catch (e: any) {
            if (e.message && e.message.startsWith('SLOT_SEARCH_FAILED:::')) {
                const debugLog = e.message.split(':::')[1];
                throw new TRPCError({
                    code: "PRECONDITION_FAILED",
                    message: `Could not find slot for sitting ${i + 1}.\nFailures (First 5 Attempts):\n${debugLog}\nDebug Info:\nTZ: ${input.timeZone}\nStart: ${currentDateSearch.toISOString()}`,
                });
            }
            throw e; // Rethrow other errors
        }

        if (!slot) {
            // This fallback should rarely be hit now
            throw new TRPCError({
                code: "PRECONDITION_FAILED",
                message: `Could not find available slot for sitting ${i + 1} within the next year.`,
            });
        }

        suggestedDates.push(slot);

        // Add to temp appointments
        tempAppointments.push({
            startTime: new Date(slot),
            endTime: new Date(slot.getTime() + input.serviceDuration * 60000)
        });

        // Calculate next search start
        const nextDate = new Date(slot);

        // Advance by frequency
        // We advance by calendar days, but ensure we don't skip over available slots by jumping to midnight of next day?
        // Actually, logic was: Jump to next day midnight.
        // But if we are in timezone, next day midnight might be 13:00 today.
        // We should just add 24 hours (or 7 days) worth of milliseconds to be safe, then find next.

        switch (input.frequency) {
            case "single":
            case "consecutive":
                nextDate.setDate(nextDate.getDate() + 1);
                break;
            case "weekly":
                nextDate.setDate(nextDate.getDate() + 7);
                break;
            case "biweekly":
                nextDate.setDate(nextDate.getDate() + 14);
                break;
            case "monthly":
                nextDate.setMonth(nextDate.getMonth() + 1);
                break;
        }
        // Instead of resetting to 00:00 (which is UTC midnight), we just start searching from that time.
        // The findNextAvailableSlot loop will find the first valid working hour.

        currentDateSearch = nextDate;
    }

    return suggestedDates;
}
