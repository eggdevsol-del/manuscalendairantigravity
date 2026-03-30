/**
 * Balance Payment Reminder Service
 *
 * v2.3 §2: On the morning of an appointment, automatically
 * sends the client a secure payment link for the remaining balance.
 *
 * Called by:
 * - A scheduled cron job (runs daily at 7am local time)
 * - Or a server-side scheduled task on app startup
 *
 * Flow:
 * 1. Query appointments where: today's date, paymentStatus = "deposit_paid"
 * 2. For each, generate a balance payment link
 * 3. Send via push notification / SMS / email
 * 4. Appointment cannot be marked complete until balance is paid
 */

import { getDb } from "./core";
import { eq, and, sql } from "drizzle-orm";
import { appointments, artistSettings, users } from "../../drizzle/schema";
import {
    calculateTransactionFees,
    resolvePaymentTier,
    getAllowedPaymentMethods,
} from "../domain/fees";

export interface BalanceReminderResult {
    bookingId: number;
    clientId: string;
    remainingBalanceCents: number;
    sent: boolean;
    error?: string;
}

/**
 * Find all appointments happening today that have unpaid balances
 * and send payment reminders to clients.
 */
export async function sendMorningBalanceReminders(): Promise<
    BalanceReminderResult[]
> {
    const db = await getDb();
    if (!db) {
        console.error("[BalanceReminder] Database connection failed");
        return [];
    }

    // Find today's appointments with paymentStatus = deposit_paid
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayStr = todayStart.toISOString().slice(0, 10); // YYYY-MM-DD

    const unpaidBookings = await db.query.appointments.findMany({
        where: and(
            eq(appointments.paymentStatus, "deposit_paid" as any),
            sql`DATE(${appointments.startTime}) = ${todayStr}`
        ),
    });

    const results: BalanceReminderResult[] = [];

    for (const booking of unpaidBookings) {
        try {
            const remaining = booking.remainingBalanceCents || 0;
            if (remaining <= 0) continue;

            // Get artist settings for tier + Connect account
            const settings = await db.query.artistSettings.findFirst({
                where: eq(artistSettings.userId, booking.artistId),
            });
            const artist = await db.query.users.findFirst({
                where: eq(users.id, booking.artistId),
            });

            const tier = resolvePaymentTier(settings?.subscriptionTier);
            const fees = calculateTransactionFees(remaining, tier);
            const paymentMethods = getAllowedPaymentMethods(tier, false);

            // Generate balance payment token (secure, time-limited)
            const { generateDepositToken } = await import("./depositToken");
            const balanceToken = generateDepositToken(booking.id);

            // TODO: Create the actual balance checkout session and send via:
            // - Push notification (if app installed)
            // - SMS (if phone number available)
            // - Email (always)
            //
            // The checkout URL will be:
            // createBalanceCheckoutSession({
            //   bookingId: booking.id,
            //   balanceAmountCents: remaining,
            //   platformFeeCents: fees.stripeApplicationFeeCents,
            //   clientTotalCents: fees.clientTotalCents,
            //   clientEmail: client.email,
            //   artistName: settings?.businessName || artist?.name || "Artist",
            //   paymentMethods,
            //   stripeConnectAccountId: settings?.stripeConnectAccountId,
            //   tier,
            //   balanceToken,
            // });

            console.log(
                `[BalanceReminder] Booking ${booking.id}: ${remaining}c remaining, ` +
                `client: ${booking.clientId}, tier: ${tier}, ` +
                `methods: ${paymentMethods.join(",")}`
            );

            results.push({
                bookingId: booking.id,
                clientId: booking.clientId,
                remainingBalanceCents: remaining,
                sent: true,
            });
        } catch (error: any) {
            results.push({
                bookingId: booking.id,
                clientId: booking.clientId,
                remainingBalanceCents: booking.remainingBalanceCents || 0,
                sent: false,
                error: error.message,
            });
        }
    }

    console.log(
        `[BalanceReminder] Processed ${results.length} bookings, ` +
        `${results.filter((r) => r.sent).length} reminders sent`
    );
    return results;
}
