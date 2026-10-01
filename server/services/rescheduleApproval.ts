import { TRPCError } from "@trpc/server";
import { and, eq, inArray, sql, gt, lt, isNotNull } from "drizzle-orm";
import * as s from "../../drizzle/schema";
import { withDatabaseTransaction } from "./core";
import * as bookings from "./appointmentService";
import { sittingFinancials } from "./sittingFinancials";
import { revisedBookingPrice } from "../domain/paymentState";
import {
  parseWorkSchedule,
  validateAppointmentForWorkHours,
} from "./booking.service";
import { createMessage } from "./conversationService";
import { RESCHEDULE_HOLD_HOURS } from "../../shared/reschedule";
const mysql = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
export const utc = (d: string) =>
  new Date(d.includes("T") ? d : d.replace(" ", "T") + "Z");
const fail = (message: string): never => {
  throw new TRPCError({ code: "CONFLICT", message });
};
export async function queueReschedulePush(
  tx: any,
  userId: string,
  conversationId: number,
  body: string
) {
  await tx.insert(s.notificationOutbox).values({
    eventType: "push_message",
    status: "pending",
    payloadJson: JSON.stringify({
      targetUserId: userId,
      title: "Reschedule update",
      body,
      url: `/chat/${conversationId}`,
      data: { conversationId },
    }),
  });
}
export function reschedulePriceTerms(
  booking: any,
  original: any,
  quote: any,
  itemId: number,
  kind: string
) {
  const old = sittingFinancials(booking);
  const base = original.items.find((x: any) => x.id === itemId);
  const discounted = quote.items.find((x: any) => x.id === itemId);
  if (!base || !discounted)
    fail("The sitting's original promotion allocation could not be verified.");
  const removed =
    kind === "discount"
      ? Math.max(0, base.estimateCents - discounted.estimateCents)
      : 0;
  const estimateCents = old.estimateCents + removed;
  return {
    oldEstimateCents: old.estimateCents,
    estimateCents,
    paidCents: old.paidCents,
    remainingCents: Math.max(0, estimateCents - old.paidCents),
    removedDiscountCents: removed,
  };
}
export async function proposeReschedule(
  tx: any,
  booking: any,
  application: any,
  rules: any,
  start: Date,
  end: Date,
  confirm: boolean
) {
  if (!booking.conversationId)
    fail("A conversation is required for client approval.");
  const item = await tx.query.sessionPlanItems.findFirst({
    where: eq(s.sessionPlanItems.appointmentId, booking.id),
  });
  const original = JSON.parse(application.originalJson),
    quote = JSON.parse(application.quoteJson);
  const price = reschedulePriceTerms(
    booking,
    original,
    quote,
    item?.id,
    rules.kind
  );
  const terms = {
    ...price,
    oldStart: booking.startTime,
    oldEnd: booking.endTime,
    newStart: start.toISOString(),
    newEnd: end.toISOString(),
    timeZone: booking.timeZone,
    sessionIndex: booking.sessionIndex || 1,
    offerName: rules.name,
    applicationId: application.id,
    itemId: item.id,
    kind: rules.kind,
  };
  if (!confirm)
    return {
      success: false,
      requiresApproval: true,
      depositForfeited: false,
      terms,
    };
  if (
    await bookings.checkAppointmentOverlap(
      booking.artistId,
      start,
      end,
      booking.id
    )
  )
    fail("This time is already booked or held for another client.");
  // Do not reserve over another proposal whose provider checkout is already active.
  const checkouts = await tx
    .select({ id: s.sessionPlans.id })
    .from(s.sessionPlanItems)
    .innerJoin(
      s.sessionPlans,
      eq(s.sessionPlanItems.sessionPlanId, s.sessionPlans.id)
    )
    .where(
      and(
        eq(s.sessionPlans.artistId, booking.artistId),
        eq(s.sessionPlans.status, "pending"),
        isNotNull(s.sessionPlans.stripeSessionId),
        lt(s.sessionPlanItems.startsAt, mysql(end)),
        sql`DATE_ADD(${s.sessionPlanItems.startsAt}, INTERVAL ${s.sessionPlanItems.durationMinutes} MINUTE) > ${mysql(start)}`
      )
    )
    .limit(1);
  if (checkouts.length)
    fail(
      "Another client is checking out for this time. Choose a different time."
    );
  const now = new Date(),
    expires = new Date(
      Math.min(+now + RESCHEDULE_HOLD_HOURS * 3600000, +start)
    );
  const pending = await tx
    .select()
    .from(s.rescheduleRequests)
    .where(
      and(
        eq(s.rescheduleRequests.appointmentId, booking.id),
        eq(s.rescheduleRequests.status, "pending")
      )
    );
  for (const request of pending) {
    if (+utc(request.expiresAt) > +now) {
      if (
        JSON.stringify(JSON.parse(request.termsJson)) === JSON.stringify(terms)
      )
        return {
          success: true,
          requiresApproval: true,
          depositForfeited: false,
          requestId: request.id,
        };
      fail(
        "A reschedule request is already awaiting the client. Withdraw it before sending another."
      );
    }
  }
  const result = await tx.insert(s.rescheduleRequests).values({
    appointmentId: booking.id,
    artistId: booking.artistId,
    clientId: booking.clientId,
    conversationId: booking.conversationId,
    startsAt: mysql(start),
    endsAt: mysql(end),
    expiresAt: mysql(expires),
    createdAt: mysql(now),
    termsJson: JSON.stringify(terms),
  });
  const requestId = Number(result[0].insertId);
  await createMessage({
    conversationId: booking.conversationId,
    senderId: booking.artistId,
    messageType: "system",
    content:
      "Please review the proposed date and promotion change. Your original sitting stays booked until you accept.",
    metadata: JSON.stringify({ type: "reschedule_request", requestId }),
  });
  await queueReschedulePush(
    tx,
    booking.clientId,
    booking.conversationId,
    "Your artist proposed a new sitting date outside the promotion dates. Review the revised terms before accepting."
  );
  return {
    success: true,
    requiresApproval: true,
    depositForfeited: false,
    requestId,
  };
}
export async function resolveReschedule(
  requestId: number,
  userId: string,
  action: "accept" | "decline" | "withdraw"
) {
  return withDatabaseTransaction(async tx => {
    // Match booking-writer lock order: artist first, then request and appointment.
    const found = await tx.query.rescheduleRequests.findFirst({
      where: eq(s.rescheduleRequests.id, requestId),
    });
    if (
      !found ||
      (action === "withdraw"
        ? found.artistId !== userId
        : found.clientId !== userId)
    )
      throw new TRPCError({ code: "FORBIDDEN" });
    await tx
      .select({ id: s.users.id })
      .from(s.users)
      .where(eq(s.users.id, found.artistId))
      .for("update");
    const [r] = await tx
      .select()
      .from(s.rescheduleRequests)
      .where(eq(s.rescheduleRequests.id, requestId))
      .for("update");
    if (r.status !== "pending") return { status: r.status };
    const now = new Date();
    if (+utc(r.expiresAt) <= +now) {
      await tx
        .update(s.rescheduleRequests)
        .set({ status: "expired", resolvedAt: mysql(now) })
        .where(eq(s.rescheduleRequests.id, r.id));
      return { status: "expired" };
    }
    const terms = JSON.parse(r.termsJson);
    const [b] = await tx
      .select()
      .from(s.appointments)
      .where(eq(s.appointments.id, r.appointmentId))
      .for("update");
    if (action === "accept") {
      if (!b) fail("The sitting is no longer available.");
      const amounts = sittingFinancials(b);
      if (
        !b ||
        b.status !== "confirmed" ||
        +utc(b.startTime) !== +utc(terms.oldStart) ||
        +utc(b.endTime) !== +utc(terms.oldEnd) ||
        amounts.estimateCents !== terms.oldEstimateCents ||
        amounts.paidCents !== terms.paidCents
      )
        fail(
          "The booking or payments changed. Ask your artist to send updated terms."
        );
      const start = utc(r.startsAt),
        end = utc(r.endsAt);
      if (start <= now) fail("The proposed sitting time has passed.");
      const settings = await tx.query.artistSettings.findFirst({
        where: eq(s.artistSettings.userId, r.artistId),
      });
      const hours = validateAppointmentForWorkHours(
        start,
        (+end - +start) / 60000,
        parseWorkSchedule(settings?.workSchedule),
        terms.timeZone
      );
      if (!hours.valid) fail(hours.reason || "This time is unavailable.");
      if (await bookings.checkAppointmentOverlap(r.artistId, start, end, b.id))
        fail("This time is no longer available.");
      // Release this hold inside the transaction so the shared overlap check permits the move.
      await tx
        .update(s.rescheduleRequests)
        .set({ status: "accepted", resolvedAt: mysql(now) })
        .where(eq(s.rescheduleRequests.id, r.id));
      const active = await tx.query.paymentRequests.findFirst({
        where: and(
          eq(s.paymentRequests.appointmentId, b.id),
          eq(s.paymentRequests.status, "pending")
        ),
      });
      if (active)
        fail(
          "An outstanding payment request must be cancelled before changing this sitting's terms."
        );
      await bookings.updateAppointment(
        b.id,
        {
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          ...revisedBookingPrice(b, terms.estimateCents / 100),
        },
        userId
      );
      await tx
        .update(s.sessionPlanItems)
        .set({ startsAt: mysql(start), estimateCents: terms.estimateCents })
        .where(eq(s.sessionPlanItems.id, terms.itemId));
      await tx
        .update(s.sessionPlans)
        .set({
          totalEstimateCents: sql`${s.sessionPlans.totalEstimateCents} + ${terms.removedDiscountCents}`,
        })
        .where(eq(s.sessionPlans.id, b.sessionPlanId!));
      const app = await tx.query.offerApplications.findFirst({
        where: eq(s.offerApplications.id, terms.applicationId),
      });
      if (!app || app.status !== "redeemed")
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "The promotion changed. Ask your artist to send updated terms.",
        });
      const q = JSON.parse(app.quoteJson);
      const item = q.items.find((x: any) => x.id === terms.itemId);
      item.estimateCents += terms.removedDiscountCents;
      q.totalEstimateCents += terms.removedDiscountCents;
      q.discountCents -= terms.removedDiscountCents;
      q.amount -= terms.removedDiscountCents;
      await tx
        .update(s.offerApplications)
        .set({ quoteJson: JSON.stringify(q) })
        .where(eq(s.offerApplications.id, app.id));
    } else
      await tx
        .update(s.rescheduleRequests)
        .set({
          status: action === "decline" ? "declined" : "withdrawn",
          resolvedAt: mysql(now),
        })
        .where(eq(s.rescheduleRequests.id, r.id));
    const content =
      action === "accept"
        ? "Reschedule accepted. The sitting date and agreed balance are updated; existing payments remain credited."
        : "Reschedule request closed. The original booking remains unchanged.";
    await createMessage({
      conversationId: r.conversationId,
      senderId: userId,
      messageType: "system",
      content,
    });
    await queueReschedulePush(
      tx,
      userId === r.artistId ? r.clientId : r.artistId,
      r.conversationId,
      content
    );
    return {
      status:
        action === "accept"
          ? "accepted"
          : action === "decline"
            ? "declined"
            : "withdrawn",
    };
  });
}
