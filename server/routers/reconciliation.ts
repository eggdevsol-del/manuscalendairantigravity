import { z } from "zod";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../services/core";
import {
  sessionPlans,
  notificationOutbox,
  consentForms,
} from "../../drizzle/schema";
import { stripe } from "../services/stripe";
import { fulfillSessionPlan } from "../services/sessionPlanFulfillment";
import { TRPCError } from "@trpc/server";
export const reconciliationRouter = router({
  overview: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const [plans, notifications, forms] = await Promise.all([
      db
        .select({
          id: sessionPlans.id,
          artistId: sessionPlans.artistId,
          clientId: sessionPlans.clientId,
          totalCents: sessionPlans.depositTotalCents,
          createdAt: sessionPlans.createdAt,
        })
        .from(sessionPlans)
        .where(
          and(
            eq(sessionPlans.status, "pending"),
            isNotNull(sessionPlans.stripeSessionId)
          )
        )
        .orderBy(desc(sessionPlans.createdAt))
        .limit(100),
      db
        .select({
          id: notificationOutbox.id,
          eventType: notificationOutbox.eventType,
          attemptCount: notificationOutbox.attemptCount,
          createdAt: notificationOutbox.createdAt,
        })
        .from(notificationOutbox)
        .where(eq(notificationOutbox.status, "failed"))
        .orderBy(desc(notificationOutbox.createdAt))
        .limit(100),
      db
        .select({
          id: consentForms.id,
          appointmentId: consentForms.appointmentId,
          title: consentForms.title,
          createdAt: consentForms.createdAt,
        })
        .from(consentForms)
        .where(eq(consentForms.status, "pending"))
        .orderBy(desc(consentForms.createdAt))
        .limit(100),
    ]);
    return { plans, notifications, forms };
  }),
  reconcilePlan: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const plan = await db.query.sessionPlans.findFirst({
        where: eq(sessionPlans.id, input.id),
      });
      if (!plan?.stripeSessionId) throw new TRPCError({ code: "NOT_FOUND" });
      const payment = await stripe.paymentIntents.retrieve(
        plan.stripeSessionId
      );
      if (payment.status !== "succeeded")
        return {
          confirmed: false,
          message: `Stripe status: ${payment.status}. No booking changes made.`,
        };
      await fulfillSessionPlan(db, plan.id, payment);
      return {
        confirmed: true,
        message: "Payment verified and every session confirmed.",
      };
    }),
  retryNotification: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [result] = await db
        .update(notificationOutbox)
        .set({
          status: "pending",
          attemptCount: 0,
          nextAttemptAt: new Date()
            .toISOString()
            .slice(0, 19)
            .replace("T", " "),
        })
        .where(
          and(
            eq(notificationOutbox.id, input.id),
            eq(notificationOutbox.status, "failed")
          )
        );
      if (!result.affectedRows)
        throw new TRPCError({
          code: "CONFLICT",
          message: "This notification is no longer awaiting retry.",
        });
      return { queued: true };
    }),
});
