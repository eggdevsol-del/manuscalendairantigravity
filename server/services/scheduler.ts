/**
 * Scheduled Tasks — Balance Reminder Scheduler
 *
 * Zero-dependency scheduler using setInterval.
 * Checks every hour if it's time to send balance reminders.
 *
 * For Railway/long-running server: starts on server boot.
 * Configurable via BALANCE_REMINDER_HOUR env var (UTC hour, default 21 = 7am AEST).
 */

import { sendMorningBalanceReminders } from "../services/balanceReminder";

let schedulerStarted = false;
let lastRunDate: string | null = null;

/** Target UTC hour for balance reminders (default: 21 = 7am AEST) */
const REMINDER_HOUR = parseInt(process.env.BALANCE_REMINDER_HOUR || "21", 10);

/** Interval between checks in ms (1 hour) */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Start all scheduled tasks. Called once from server startup.
 * Idempotent — safe to call multiple times.
 */
export function startScheduledTasks() {
    if (schedulerStarted) return;
    schedulerStarted = true;

    console.log(
        `[Scheduler] Started. Balance reminders at UTC hour ${REMINDER_HOUR} ` +
        `(override with BALANCE_REMINDER_HOUR env var)`
    );

    // Check immediately on startup (in case server restarted after scheduled time)
    checkAndRunReminders();

    // Then check every hour
    setInterval(checkAndRunReminders, CHECK_INTERVAL_MS);
}

async function checkAndRunReminders() {
    const now = new Date();
    const currentHour = now.getUTCHours();
    const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

    // Only run once per day, at or after the target hour
    if (currentHour >= REMINDER_HOUR && lastRunDate !== todayStr) {
        lastRunDate = todayStr;
        console.log(`[Scheduler] Triggering balance reminders for ${todayStr}...`);
        try {
            const results = await sendMorningBalanceReminders();
            console.log(
                `[Scheduler] Balance reminders complete: ${results.length} processed, ` +
                `${results.filter((r) => r.sent).length} sent`
            );
        } catch (error) {
            console.error("[Scheduler] Balance reminder failed:", error);
            // Reset so it retries next hour
            lastRunDate = null;
        }
    }
}

/**
 * Manual trigger for balance reminders (e.g., from admin API or testing).
 */
export async function triggerBalanceReminders() {
    return sendMorningBalanceReminders();
}
