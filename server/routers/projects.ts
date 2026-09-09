import { z } from "zod";
import { and, eq, inArray, or, asc } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../services/core";
import { requireConversationAccess } from "../services/access";
import * as schema from "../../drizzle/schema";

export const projectsRouter = router({
  summary: protectedProcedure
    .input(z.object({ conversationId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const conversation = await requireConversationAccess(
        db,
        input.conversationId,
        ctx.user.id
      );
      const [sessions, plans, people, settings, leads] = await Promise.all([
        db
          .select({
            id: schema.appointments.id,
            title: schema.appointments.title,
            startsAt: schema.appointments.startTime,
            endsAt: schema.appointments.endTime,
            status: schema.appointments.status,
            sessionPlanId: schema.appointments.sessionPlanId,
            price: schema.appointments.price,
            expected: schema.appointments.totalExpectedAmountCents,
            paid: schema.appointments.totalPaidAmountCents,
            remaining: schema.appointments.remainingBalanceCents,
            paymentStatus: schema.appointments.paymentStatus,
            depositPaymentId: schema.appointments.depositPaymentId,
            balancePaymentId: schema.appointments.balancePaymentId,
          })
          .from(schema.appointments)
          .where(eq(schema.appointments.conversationId, input.conversationId))
          .orderBy(asc(schema.appointments.startTime)),
        db
          .select()
          .from(schema.sessionPlans)
          .where(eq(schema.sessionPlans.conversationId, input.conversationId)),
        db
          .select({
            id: schema.users.id,
            name: schema.users.name,
            avatar: schema.users.avatar,
          })
          .from(schema.users)
          .where(
            inArray(schema.users.id, [
              conversation.artistId,
              conversation.clientId!,
            ])
          ),
        db.query.artistSettings.findFirst({
          where: eq(schema.artistSettings.userId, conversation.artistId),
        }),
        db
          .select({ paymentId: schema.leads.stripeCheckoutSessionId })
          .from(schema.leads)
          .where(eq(schema.leads.conversationId, input.conversationId)),
      ]);
      const ids = sessions.map(s => s.id);
      const paymentIds = [
        ...new Set(
          [
            ...sessions.flatMap(s => [s.depositPaymentId, s.balancePaymentId]),
            ...plans.map(p => p.stripeSessionId),
            ...leads.map(l => l.paymentId),
          ].filter((id): id is string => !!id)
        ),
      ];
      const links = [
        ...(ids.length ? [inArray(schema.paymentLedger.bookingId, ids)] : []),
        ...(paymentIds.length
          ? [inArray(schema.paymentLedger.stripePaymentId, paymentIds)]
          : []),
      ];
      const [history, forms] = await Promise.all([
        links.length
          ? db
              .select({
                id: schema.paymentLedger.id,
                bookingId: schema.paymentLedger.bookingId,
                type: schema.paymentLedger.transactionType,
                amountCents: schema.paymentLedger.amountCents,
                platformFeeCents: schema.paymentLedger.platformFeeCents,
                method: schema.paymentLedger.paymentMethod,
                createdAt: schema.paymentLedger.createdAt,
              })
              .from(schema.paymentLedger)
              .where(
                and(
                  eq(schema.paymentLedger.artistId, conversation.artistId),
                  inArray(schema.paymentLedger.transactionType, [
                    "deposit",
                    "balance",
                    "refund",
                  ]),
                  or(...links)
                )
              )
              .orderBy(
                asc(schema.paymentLedger.createdAt),
                asc(schema.paymentLedger.id)
              )
          : [],
        ids.length
          ? db
              .select({
                id: schema.consentForms.id,
                appointmentId: schema.consentForms.appointmentId,
                title: schema.consentForms.title,
                status: schema.consentForms.status,
              })
              .from(schema.consentForms)
              .where(inArray(schema.consentForms.appointmentId, ids))
          : [],
      ]);
      return {
        conversationId: conversation.id,
        artist: people.find(p => p.id === conversation.artistId),
        client: people.find(p => p.id === conversation.clientId),
        location: settings?.businessAddress || null,
        sessions: sessions.map(
          ({
            depositPaymentId,
            balancePaymentId,
            price,
            expected,
            paid,
            remaining,
            ...s
          }) => ({
            ...s,
            startsAt: s.startsAt.replace(" ", "T") + "Z",
            endsAt: s.endsAt.replace(" ", "T") + "Z",
            estimateCents: expected ?? Math.round((price || 0) * 100),
            paidCents: paid || 0,
            remainingCents:
              remaining ??
              Math.max(0, (expected ?? (price || 0) * 100) - (paid || 0)),
          })
        ),
        plans: plans.map(p => ({
          id: p.id,
          status: p.status,
          estimateCents: p.totalEstimateCents,
          depositCents: p.depositTotalCents,
          createdAt: p.createdAt,
        })),
        history,
        forms,
      };
    }),
});
