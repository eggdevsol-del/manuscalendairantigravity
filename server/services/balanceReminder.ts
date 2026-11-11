/**
 * Balance Payment Reminder Service
 *
 * On the morning of a sitting, sends the client a secure payment link for the remaining balance by
 * email, SMS and push (whichever are available for that client), then records that it was sent so a
 * restart or second run never sends it twice.
 *
 * Called daily by the scheduler (see scheduler.ts).
 */
import { getDb } from "./core";
import { and, eq, gt, gte, lt, ne, or, isNull } from "drizzle-orm";
import { appointments, artistSettings, users } from "../../drizzle/schema";
import { createBalanceToken } from "./depositToken";
import { sendEmail } from "./email";
import { deliveryAvailability, sendOfferSms } from "./offerDelivery";
import { sendPushNotification } from "./pushService";
import { formatLocalTime } from "../../shared/utils/timezone";

export interface BalanceReminderResult {
  bookingId: number;
  clientId: string;
  remainingBalanceCents: number;
  sent: boolean;
  channels: string[];
  error?: string;
}

/** How far ahead of the run a sitting may start and still be reminded this morning. */
const WINDOW_HOURS = 18;
const mysql = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
const dollars = (cents: number) =>
  "$" + (cents / 100).toLocaleString("en-AU", { minimumFractionDigits: 2 });

/** The reminder wording, shared by every channel. */
export function balanceReminderMessage(opts: {
  clientName?: string | null;
  artistName: string;
  when: string;
  remainingCents: number;
  link: string;
}) {
  const hi = opts.clientName ? `Hi ${opts.clientName.split(" ")[0]}, ` : "";
  return {
    subject: `Your sitting with ${opts.artistName} is today`,
    short: `${hi}your sitting with ${opts.artistName} is ${opts.when}. ${dollars(opts.remainingCents)} is due on the day. Pay securely: ${opts.link}`,
    body: `${hi}your sitting with ${opts.artistName} is ${opts.when}.\n\nThe remaining balance is ${dollars(opts.remainingCents)}. You can pay it securely here before or at your sitting:\n${opts.link}\n\nIf you've already arranged payment with ${opts.artistName}, you can ignore this message.`,
  };
}

/**
 * Find sittings starting in the next WINDOW_HOURS that still have a balance owing and remind each
 * client once. Times are stored in UTC, so the window is taken from the moment of the run rather
 * than from a calendar date in the server's timezone.
 */
export async function sendMorningBalanceReminders(
  now: Date = new Date()
): Promise<BalanceReminderResult[]> {
  const db = await getDb();
  if (!db) {
    console.error("[BalanceReminder] Database connection failed");
    return [];
  }
  const due = await db.query.appointments.findMany({
    where: and(
      eq(appointments.paymentStatus, "deposit_paid"),
      eq(appointments.status, "confirmed"),
      gte(appointments.startTime, mysql(now)),
      lt(
        appointments.startTime,
        mysql(new Date(+now + WINDOW_HOURS * 3600_000))
      ),
      gt(appointments.remainingBalanceCents, 0),
      or(isNull(appointments.reminderSent), ne(appointments.reminderSent, 1))
    ),
  });
  const appUrl = (
    process.env.APP_URL ||
    process.env.VITE_APP_URL ||
    "https://www.tattoi.app"
  ).replace(/\/$/, "");
  const results: BalanceReminderResult[] = [];

  for (const booking of due) {
    const remaining = booking.remainingBalanceCents || 0;
    const base = {
      bookingId: booking.id,
      clientId: booking.clientId,
      remainingBalanceCents: remaining,
    };
    try {
      const [client, artist, settings] = await Promise.all([
        db.query.users.findFirst({ where: eq(users.id, booking.clientId) }),
        db.query.users.findFirst({ where: eq(users.id, booking.artistId) }),
        db.query.artistSettings.findFirst({
          where: eq(artistSettings.userId, booking.artistId),
        }),
      ]);
      if (!client) throw new Error("Client not found.");
      const link = `${appUrl}/balance/${booking.id}?token=${createBalanceToken(booking.id)}`;
      const message = balanceReminderMessage({
        clientName: client.name,
        artistName: settings?.businessName || artist?.name || "your artist",
        when: `today at ${formatLocalTime(
          new Date(booking.startTime.replace(" ", "T") + "Z").toISOString(),
          booking.timeZone,
          "h:mm a"
        )}`,
        remainingCents: remaining,
        link,
      });

      // Each channel is independent: one failing must not stop the others.
      const channels: string[] = [];
      const failures: string[] = [];
      const attempt = async (name: string, send: () => Promise<unknown>) => {
        try {
          await send();
          channels.push(name);
        } catch (e) {
          failures.push(
            `${name}: ${e instanceof Error ? e.message : "failed"}`
          );
        }
      };
      if (client.email && process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
        await attempt("email", () =>
          sendEmail(
            { to: client.email!, subject: message.subject, body: message.body },
            `balance-reminder-${booking.id}`
          )
        );
      if (client.phone && deliveryAvailability().smsAvailable)
        await attempt("sms", () => sendOfferSms(client.phone!, message.short));
      await attempt("push", async () => {
        const push = await sendPushNotification(client.id, {
          title: message.subject,
          body: `${dollars(remaining)} is due on the day. Tap to pay securely.`,
          url: link,
        });
        if (!push.success) throw new Error("no device registered");
      });

      if (channels.length)
        await db
          .update(appointments)
          .set({ reminderSent: 1 })
          .where(eq(appointments.id, booking.id));
      // Never log recipients, links or message bodies.
      console.log(
        `[BalanceReminder] Booking ${booking.id}: ${channels.length ? "sent via " + channels.join(", ") : "not sent"}`
      );
      results.push({
        ...base,
        sent: channels.length > 0,
        channels,
        ...(channels.length
          ? {}
          : { error: failures.join("; ") || "No way to reach this client." }),
      });
    } catch (error) {
      results.push({
        ...base,
        sent: false,
        channels: [],
        error: error instanceof Error ? error.message : "failed",
      });
    }
  }
  console.log(
    `[BalanceReminder] Processed ${results.length} bookings, ${results.filter(r => r.sent).length} reminders sent`
  );
  return results;
}
