import {
  isDesignProjectName,
  designProjectName,
} from "../../shared/projectNames";
import { rescheduledSittingIds } from "../services/rescheduledSittings";
import { sittingFinancials } from "../services/sittingFinancials";
import {
  paymentProjectKeys,
  paymentSessions,
  briefProjectKeys,
} from "../services/projectAttribution";
import { generateProjectName } from "../services/llmEnrichment";
import { readPresentedPlans } from "../services/sessionPlanPresentation";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq, inArray, or, asc, desc, gt } from "drizzle-orm";
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
            projectName: schema.appointments.projectName,
            startTime: schema.appointments.startTime,
            endTime: schema.appointments.endTime,
            timeZone: schema.appointments.timeZone,
            status: schema.appointments.status,
            conversationId: schema.appointments.conversationId,
            totalPaidAmountCents: schema.appointments.totalPaidAmountCents,
            amountPaid: schema.appointments.amountPaid,
            depositPaid: schema.appointments.depositPaid,
            depositAmount: schema.appointments.depositAmount,
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
        sessions: sessions.map(
          ({
            totalPaidAmountCents,
            amountPaid,
            depositPaid,
            depositAmount,
            ...session
          }) => ({
            ...session,
            paidCents: sittingFinancials({
              totalPaidAmountCents,
              amountPaid,
              depositPaid,
              depositAmount,
            }).paidCents,
          })
        ),
        notes,
        forms,
      };
    }),
  nameProject: protectedProcedure
    .input(
      z.object({
        conversationId: z.number().int().positive(),
        sessionPlanId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await requireConversationAccess(db, input.conversationId, ctx.user.id);
      const plan = await db.query.sessionPlans.findFirst({
        where: and(
          eq(schema.sessionPlans.id, input.sessionPlanId),
          eq(schema.sessionPlans.conversationId, input.conversationId)
        ),
      });
      if (!plan?.messageId)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This imported project needs an artist-provided name.",
        });
      const message = await db.query.messages.findFirst({
        where: eq(schema.messages.id, plan.messageId),
      });
      let metadata: Record<string, any> = {};
      try {
        metadata = JSON.parse(message?.metadata || "{}");
      } catch {}
      const existing = await db.query.appointments.findFirst({
        where: eq(schema.appointments.sessionPlanId, plan.id),
      });
      // Keep an older project's context separate from later tattoos in the same chat.
      const laterPlan = plan.createdAt
        ? await db.query.sessionPlans.findFirst({
            where: and(
              eq(schema.sessionPlans.conversationId, input.conversationId),
              gt(schema.sessionPlans.createdAt, plan.createdAt)
            ),
            orderBy: [asc(schema.sessionPlans.createdAt)],
          })
        : undefined;
      const saved = existing?.projectName || metadata.projectName;
      const name = isDesignProjectName(saved)
        ? saved
        : await generateProjectName(
            db,
            input.conversationId,
            undefined,
            laterPlan ? plan.createdAt || undefined : undefined
          );
      await db
        .update(schema.messages)
        .set({ metadata: JSON.stringify({ ...metadata, projectName: name }) })
        .where(eq(schema.messages.id, plan.messageId));
      await db
        .update(schema.appointments)
        .set({ projectName: name })
        .where(and(eq(schema.appointments.sessionPlanId, plan.id)));
      return { projectName: name };
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
            projectName: schema.appointments.projectName,
            startsAt: schema.appointments.startTime,
            endsAt: schema.appointments.endTime,
            status: schema.appointments.status,
            sessionPlanId: schema.appointments.sessionPlanId,
            sessionIndex: schema.appointments.sessionIndex,
            sessionTotal: schema.appointments.sessionTotal,
            price: schema.appointments.price,
            expected: schema.appointments.totalExpectedAmountCents,
            paid: schema.appointments.totalPaidAmountCents,
            amountPaid: schema.appointments.amountPaid,
            depositPaid: schema.appointments.depositPaid,
            depositAmount: schema.appointments.depositAmount,
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
      const detailedPlans = plans.length
        ? await db.query.sessionPlans.findMany({
            where: inArray(
              schema.sessionPlans.id,
              plans.map(p => p.id)
            ),
            with: { items: true, message: true },
          })
        : [];
      const presentedPlans = await readPresentedPlans(db, detailedPlans);
      const ids = sessions.map(s => s.id);
      const rescheduled = await rescheduledSittingIds(db, ids);
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
      const [history, forms, requests] = await Promise.all([
        links.length
          ? db
              .select({
                id: schema.paymentLedger.id,
                bookingId: schema.paymentLedger.bookingId,
                stripePaymentId: schema.paymentLedger.stripePaymentId,
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
        ids.length
          ? db
              .select({
                id: schema.paymentRequests.id,
                token: schema.paymentRequests.token,
                appointmentId: schema.paymentRequests.appointmentId,
                amountCents: schema.paymentRequests.amountCents,
                expiresAt: schema.paymentRequests.expiresAt,
              })
              .from(schema.paymentRequests)
              .where(
                and(
                  inArray(schema.paymentRequests.appointmentId, ids),
                  eq(schema.paymentRequests.status, "pending")
                )
              )
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
            amountPaid,
            depositPaid,
            depositAmount,
            remaining,
            ...s
          }) => ({
            ...s,
            projectName: designProjectName(s.projectName),
            pendingRequest:
              requests.find(
                r =>
                  r.appointmentId === s.id &&
                  (!r.expiresAt ||
                    new Date(r.expiresAt.replace(" ", "T") + "Z") > new Date())
              ) || null,
            rescheduled: rescheduled.has(s.id),
            startsAt: s.startsAt.replace(" ", "T") + "Z",
            endsAt: s.endsAt.replace(" ", "T") + "Z",
            ...sittingFinancials({
              totalExpectedAmountCents: expected,
              totalPaidAmountCents: paid,
              remainingBalanceCents: remaining,
              price,
              amountPaid,
              depositPaid,
              depositAmount,
              paymentStatus: s.paymentStatus,
            }),
          })
        ),
        plans: presentedPlans.map(p => ({
          id: p.id,
          status: p.status,
          requiresDeposit: p.requiresDeposit,
          depositRecorded: p.depositRecorded,
          paymentState: p.paymentState,
          projectName: p.projectName,
          estimateCents: p.totalEstimateCents,
          depositCents: p.depositTotalCents,
          createdAt: p.createdAt,
        })),
        history: history.map(({ stripePaymentId, ...entry }) => ({
          ...entry,
          sittingIds: paymentSessions(
            { ...entry, stripePaymentId },
            sessions
          ).map(s => s.id),
          projectKeys: paymentProjectKeys(
            { ...entry, stripePaymentId },
            sessions,
            plans
          ),
        })),
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
          const projectKeys = briefProjectKeys(
            { ...lead, paymentId },
            detailedPlans
          );
          return { ...lead, images, projectKeys };
        }),
      };
    }),
});
