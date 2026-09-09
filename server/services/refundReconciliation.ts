import type Stripe from "stripe";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  paymentLedger,
  appointments,
  sessionPlans,
  sessionPlanItems,
  orders,
  orderItems,
  seminars,
} from "../../drizzle/schema";
import { allocateRefund } from "../domain/refunds";
import type { getDb } from "./core";
/** Called inside the webhook transaction, which serializes cumulative charge events. */
export async function reconcileChargeRefund(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  charge: Stripe.Charge
) {
  const paymentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!paymentId) throw new Error("Refund has no linked payment.");
  const original = await db.query.paymentLedger.findFirst({
    where: and(
      eq(paymentLedger.stripePaymentId, paymentId),
      inArray(paymentLedger.transactionType, [
        "deposit",
        "balance",
        "store_order",
      ])
    ),
  });
  if (!original)
    throw new Error("Original payment is not recorded yet; retry refund.");
  const priorRefunds = await db
    .select()
    .from(paymentLedger)
    .where(
      and(
        or(
          eq(paymentLedger.stripePaymentId, paymentId),
          eq(paymentLedger.stripePaymentId, charge.id)
        ),
        eq(paymentLedger.transactionType, "refund")
      )
    );
  const before = priorRefunds.reduce((sum, row) => sum - row.amountCents, 0);
  const totalBaseRefund = Math.min(
    original.amountCents,
    charge.amount_refunded || 0
  );
  const delta = Math.max(0, totalBaseRefund - before);
  const previousFees = priorRefunds.reduce(
    (sum, row) => sum - row.platformFeeCents,
    0
  );
  const feeDelta = Math.max(
    0,
    (charge.amount_refunded || 0) - totalBaseRefund - previousFees
  );
  if (delta > 0 || feeDelta > 0) {
    const plan = await db.query.sessionPlans.findFirst({
      where: eq(sessionPlans.stripeSessionId, paymentId),
    });
    const items = plan
      ? await db.query.sessionPlanItems.findMany({
          where: eq(sessionPlanItems.sessionPlanId, plan.id),
          orderBy: sessionPlanItems.id,
        })
      : [];
    const targets = original.bookingId
      ? [{ id: original.bookingId, weight: original.amountCents }]
      : items
          .filter(item => item.appointmentId)
          .map(item => ({
            id: item.appointmentId!,
            weight: item.depositCents,
          }));
    if (delta > 0 && targets.length) {
      const weights = targets.map(target => target.weight);
      const previous = allocateRefund(
          Math.min(before, original.amountCents),
          weights
        ),
        current = allocateRefund(totalBaseRefund, weights);
      for (let i = 0; i < targets.length; i++) {
        const change = current[i] - previous[i];
        if (change <= 0) continue;
        const [booking] = await db
          .select()
          .from(appointments)
          .where(eq(appointments.id, targets[i].id))
          .for("update");
        if (!booking)
          throw new Error("Refund booking is missing; review required.");
        const paid = Math.max(0, (booking.totalPaidAmountCents || 0) - change);
        await db
          .update(appointments)
          .set({
            totalPaidAmountCents: paid,
            remainingBalanceCents: Math.max(
              0,
              (booking.totalExpectedAmountCents ?? (booking.price || 0) * 100) -
                paid
            ),
            paymentStatus: "refunded",
            clientPaid: 0,
            ...(original.transactionType === "deposit"
              ? { depositPaid: 0 }
              : {}),
          })
          .where(eq(appointments.id, booking.id));
      }
    }
    if (
      original.transactionType === "store_order" &&
      charge.amount_refunded >= charge.amount
    ) {
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.stripePaymentIntentId, paymentId))
        .for("update");
      if (order && order.status !== "cancelled") {
        await db
          .update(orders)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(orders.id, order.id));
        const items = await db.query.orderItems.findMany({
          where: eq(orderItems.orderId, order.id),
        });
        for (const item of items) {
          if (!item.seminarId) continue;
          const [seminar] = await db
            .select()
            .from(seminars)
            .where(eq(seminars.id, item.seminarId))
            .for("update");
          if (seminar)
            await db
              .update(seminars)
              .set({
                ticketsSold: Math.max(0, seminar.ticketsSold - item.quantity),
              })
              .where(eq(seminars.id, seminar.id));
        }
      }
    }
    await db.insert(paymentLedger).values({
      artistId: original.artistId,
      clientId: original.clientId,
      bookingId: original.bookingId,
      transactionType: "refund",
      amountCents: -delta || 0,
      platformFeeCents: -feeDelta || 0,
      artistFeeCents: 0,
      stripePaymentId: paymentId,
      paymentMethod: original.paymentMethod,
      metadata: JSON.stringify({
        chargeId: charge.id,
        cumulativeBaseRefundCents: totalBaseRefund,
      }),
    });
  }
}
