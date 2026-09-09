import { eq, and, ne, lt, gt } from "drizzle-orm";
import type Stripe from "stripe";
import * as schema from "../../drizzle/schema";
import { generateRequiredForms } from "./appointmentService";

const mysqlDate = (date: Date) =>
  date.toISOString().slice(0, 19).replace("T", " ");
const utcDate = (date: string) =>
  new Date(date.includes("T") ? date : date.replace(" ", "T") + "Z");

/** Fulfil a stored PaymentIntent under a row lock; every internal write rolls back together. */
export async function fulfillSessionPlan(
  database: any,
  planId: number,
  payment: Stripe.PaymentIntent
) {
  return database.transaction(async (tx: any) => {
    const [plan] = await tx
      .select()
      .from(schema.sessionPlans)
      .where(eq(schema.sessionPlans.id, planId))
      .for("update");
    if (!plan || plan.stripeSessionId !== payment.id)
      throw new Error("Payment does not match the stored session plan.");
    if (
      payment.status !== "succeeded" ||
      payment.currency !== "aud" ||
      payment.amount_received !==
        plan.depositTotalCents + (plan.platformFeeCents || 0)
    )
      throw new Error("Payment amount or currency does not match the plan.");
    if (plan.status === "accepted") return { alreadyProcessed: true };
    if (plan.status !== "pending")
      throw new Error(
        "Paid plan needs reconciliation: it is no longer pending."
      );
    await tx
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, plan.artistId))
      .for("update");
    const items = await tx.query.sessionPlanItems.findMany({
      where: eq(schema.sessionPlanItems.sessionPlanId, plan.id),
    });
    if (!items.length) throw new Error("Session plan has no sessions.");
    const settings = await tx.query.artistSettings.findFirst({
      where: eq(schema.artistSettings.userId, plan.artistId),
    });
    const destination =
      typeof payment.transfer_data?.destination === "string"
        ? payment.transfer_data.destination
        : payment.transfer_data?.destination?.id;
    if (
      !settings?.stripeConnectAccountId ||
      destination !== settings.stripeConnectAccountId
    )
      throw new Error("Payment recipient does not match the artist.");
    const membership = await tx.query.studioMembers.findFirst({
      where: and(
        eq(schema.studioMembers.userId, plan.artistId),
        eq(schema.studioMembers.status, "active")
      ),
    });
    const now = mysqlDate(new Date());
    for (const item of items) {
      const start = utcDate(item.startsAt);
      const end = new Date(+start + item.durationMinutes * 60000);
      const conflicts = await tx
        .select({ id: schema.appointments.id })
        .from(schema.appointments)
        .where(
          and(
            eq(schema.appointments.artistId, plan.artistId),
            ne(schema.appointments.status, "cancelled"),
            lt(schema.appointments.startTime, mysqlDate(end)),
            gt(schema.appointments.endTime, mysqlDate(start))
          )
        )
        .limit(1);
      if (conflicts.length)
        throw new Error(
          "Paid plan needs reconciliation: a session time is no longer available."
        );
      const [created] = await tx.insert(schema.appointments).values({
        artistId: plan.artistId,
        studioId: membership?.studioId || null,
        clientId: plan.clientId,
        conversationId: plan.conversationId,
        title: `Session ${item.sessionIndex}`,
        startTime: mysqlDate(start),
        endTime: mysqlDate(end),
        timeZone: "Australia/Brisbane",
        status: "confirmed",
        price: Math.round(item.estimateCents / 100),
        depositAmount: Math.round(item.depositCents / 100),
        depositPaid: 1,
        depositPaymentId: payment.id,
        paymentMethod: "stripe",
        paymentStatus: "deposit_paid",
        totalExpectedAmountCents: item.estimateCents,
        totalPaidAmountCents: item.depositCents,
        remainingBalanceCents: item.estimateCents - item.depositCents,
        sessionIndex: item.sessionIndex,
        sessionTotal: items.length,
        sessionPlanId: plan.id,
        createdAt: now,
        updatedAt: now,
      });
      await tx
        .update(schema.sessionPlanItems)
        .set({ appointmentId: created.insertId })
        .where(eq(schema.sessionPlanItems.id, item.id));
      await generateRequiredForms(created.insertId, tx);
    }
    await tx.insert(schema.paymentLedger).values({
      artistId: plan.artistId,
      clientId: plan.clientId,
      transactionType: "deposit",
      amountCents: plan.depositTotalCents,
      platformFeeCents: plan.platformFeeCents || 0,
      artistFeeCents: Number(payment.metadata.artistFeeCents || 0),
      stripePaymentId: payment.id,
      stripeConnectAccountId: settings.stripeConnectAccountId,
      tier: payment.metadata.tier || "free",
      paymentMethod: "card",
    });
    if (plan.messageId) {
      const message = await tx.query.messages.findFirst({
        where: eq(schema.messages.id, plan.messageId),
      });
      const metadata = message?.metadata ? JSON.parse(message.metadata) : {};
      await tx
        .update(schema.messages)
        .set({ metadata: JSON.stringify({ ...metadata, status: "confirmed" }) })
        .where(eq(schema.messages.id, plan.messageId));
    }
    await tx
      .update(schema.sessionPlans)
      .set({ status: "accepted", acceptedAt: now })
      .where(eq(schema.sessionPlans.id, plan.id));
    return { alreadyProcessed: false };
  });
}
