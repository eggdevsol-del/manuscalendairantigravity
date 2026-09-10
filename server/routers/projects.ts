import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq, inArray, or, asc, desc } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../services/core";
import { requireConversationAccess, requireArtist } from "../services/access";
import * as schema from "../../drizzle/schema";

export const projectsRouter = router({
  clientWorkspace: protectedProcedure
    .input(z.object({ clientId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      requireArtist(ctx.user);
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const relationships = await db
        .select({ id: schema.conversations.id })
        .from(schema.conversations)
        .where(
          and(
            eq(schema.conversations.artistId, ctx.user.id),
            eq(schema.conversations.clientId, input.clientId)
          )
        );
      if (!relationships.length)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This client is not in your client list.",
        });
      const [people, sessions, notes, forms] = await Promise.all([
        db
          .select({
            id: schema.users.id,
            name: schema.users.name,
            email: schema.users.email,
            phone: schema.users.phone,
            avatar: schema.users.avatar,
            birthday: schema.users.birthday,
          })
          .from(schema.users)
          .where(eq(schema.users.id, input.clientId)),
        db
          .select({
            id: schema.appointments.id,
            title: schema.appointments.title,
            startTime: schema.appointments.startTime,
            endTime: schema.appointments.endTime,
            timeZone: schema.appointments.timeZone,
            status: schema.appointments.status,
            conversationId: schema.appointments.conversationId,
            paidCents: schema.appointments.totalPaidAmountCents,
          })
          .from(schema.appointments)
          .where(
            and(
              eq(schema.appointments.artistId, ctx.user.id),
              eq(schema.appointments.clientId, input.clientId)
            )
          )
          .orderBy(desc(schema.appointments.startTime)),
        db
          .select()
          .from(schema.clientNotes)
          .where(
            and(
              eq(schema.clientNotes.artistId, ctx.user.id),
              eq(schema.clientNotes.clientId, input.clientId)
            )
          )
          .orderBy(desc(schema.clientNotes.createdAt)),
        db
          .select({
            id: schema.consentForms.id,
            title: schema.consentForms.title,
            status: schema.consentForms.status,
            appointmentId: schema.consentForms.appointmentId,
          })
          .from(schema.consentForms)
          .where(
            and(
              eq(schema.consentForms.artistId, ctx.user.id),
              eq(schema.consentForms.clientId, input.clientId)
            )
          ),
      ]);
      return {
        client: people[0],
        conversationId: relationships[0].id,
        sessions,
        notes,
        forms,
      };
    }),
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
            timeZone: schema.appointments.timeZone,
            description: schema.appointments.description,
            title: schema.appointments.title,
            startsAt: schema.appointments.startTime,
            endsAt: schema.appointments.endTime,
            status: schema.appointments.status,
            sessionPlanId: schema.appointments.sessionPlanId,
            sessionIndex: schema.appointments.sessionIndex,
            sessionTotal: schema.appointments.sessionTotal,
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
          .select({
            paymentId: schema.leads.stripeCheckoutSessionId,
            id: schema.leads.id,
            description: schema.leads.projectDescription,
            placement: schema.leads.placement,
            references: schema.leads.referenceImages,
          })
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
        briefs: leads.map(({ paymentId, references, ...lead }) => {
          let images: string[] = [];
          try {
            const parsed = JSON.parse(references || "[]");
            if (Array.isArray(parsed))
              images = parsed.filter(
                (url): url is string =>
                  typeof url === "string" && /^https?:\/\//.test(url)
              );
          } catch {}
          return { ...lead, images };
        }),
      };
    }),
});
