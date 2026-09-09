import { effectivePaymentTier } from "../services/paymentEntitlements";
import { z } from "zod";
import { and, eq, desc, lt, gt, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { withDatabaseTransaction, getDb } from "../services/core";
import { requireArtist, requireConversationAccess } from "../services/access";
import * as schema from "../../drizzle/schema";
import { calculateTransactionFees, resolvePaymentTier } from "../domain/fees";
import { assertOfferAvailable } from "../domain/waitlist";
const mysql = (date: Date) => date.toISOString().slice(0, 19).replace("T", " ");
const rowId = z.object({ id: z.number().int().positive() });
export const waitlistRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const artist = ctx.user.role === "artist" || ctx.user.role === "admin";
    const rows = await db
      .select({
        id: schema.waitlistEntries.id,
        conversationId: schema.waitlistEntries.conversationId,
        note: schema.waitlistEntries.note,
        status: schema.waitlistEntries.status,
        startsAt: schema.waitlistEntries.startsAt,
        durationMinutes: schema.waitlistEntries.durationMinutes,
        estimateCents: schema.waitlistEntries.estimateCents,
        depositCents: schema.waitlistEntries.depositCents,
        expiresAt: schema.waitlistEntries.expiresAt,
        sessionPlanId: schema.waitlistEntries.sessionPlanId,
        name: schema.users.name,
        planStatus: schema.sessionPlans.status,
      })
      .from(schema.waitlistEntries)
      .innerJoin(
        schema.users,
        eq(
          schema.users.id,
          artist
            ? schema.waitlistEntries.clientId
            : schema.waitlistEntries.artistId
        )
      )
      .leftJoin(
        schema.sessionPlans,
        eq(schema.sessionPlans.id, schema.waitlistEntries.sessionPlanId)
      )
      .where(
        eq(
          artist
            ? schema.waitlistEntries.artistId
            : schema.waitlistEntries.clientId,
          ctx.user.id
        )
      )
      .orderBy(desc(schema.waitlistEntries.id))
      .limit(100);
    return rows.map(r => ({
      ...r,
      expired:
        r.status === "offered" &&
        (!r.expiresAt || r.expiresAt <= mysql(new Date())),
    }));
  }),
  join: protectedProcedure
    .input(
      z.object({
        conversationId: z.number().int().positive(),
        note: z.string().trim().max(500).default(""),
      })
    )
    .mutation(({ ctx, input }) =>
      withDatabaseTransaction(async db => {
        const conv = await requireConversationAccess(
          db,
          input.conversationId,
          ctx.user.id
        );
        if (ctx.user.id !== conv.clientId)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Clients choose whether to join the waitlist.",
          });
        await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.id, conv.artistId))
          .for("update");
        const entries = await db.query.waitlistEntries.findMany({
          where: and(
            eq(schema.waitlistEntries.conversationId, conv.id),
            eq(schema.waitlistEntries.clientId, ctx.user.id)
          ),
        });
        const current = entries.find(
          e =>
            e.status === "waiting" ||
            (e.status === "offered" &&
              e.expiresAt &&
              e.expiresAt > mysql(new Date()))
        );
        if (current) return { id: current.id };
        const [entry] = await db.insert(schema.waitlistEntries).values({
          artistId: conv.artistId,
          clientId: ctx.user.id,
          conversationId: conv.id,
          note: input.note,
        });
        return { id: entry.insertId };
      })
    ),
  offer: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        startsAt: z.string().datetime(),
        durationMinutes: z.number().int().min(15).max(1440),
        estimateCents: z.number().int().min(100).max(10000000),
        depositCents: z.number().int().min(100),
        expiresInHours: z.number().int().min(1).max(72),
      })
    )
    .mutation(({ ctx, input }) =>
      withDatabaseTransaction(async db => {
        requireArtist(ctx.user);
        await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.id, ctx.user.id))
          .for("update");
        const [entry] = await db
          .select()
          .from(schema.waitlistEntries)
          .where(eq(schema.waitlistEntries.id, input.id))
          .for("update");
        if (!entry || entry.artistId !== ctx.user.id)
          throw new TRPCError({ code: "FORBIDDEN" });
        if (entry.status === "accepted" || entry.status === "cancelled")
          throw new TRPCError({
            code: "CONFLICT",
            message: "This entry cannot receive another offer.",
          });
        const start = new Date(input.startsAt),
          end = new Date(+start + input.durationMinutes * 60000),
          expiry = new Date(
            Math.min(+start, Date.now() + input.expiresInHours * 3600000)
          );
        if (+start <= Date.now() || input.depositCents > input.estimateCents)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Choose a future time and a deposit no greater than the estimate.",
          });
        const overlaps = await db
          .select({ id: schema.appointments.id })
          .from(schema.appointments)
          .where(
            and(
              eq(schema.appointments.artistId, ctx.user.id),
              ne(schema.appointments.status, "cancelled"),
              lt(schema.appointments.startTime, mysql(end)),
              gt(schema.appointments.endTime, mysql(start))
            )
          )
          .limit(1);
        if (overlaps.length)
          throw new TRPCError({
            code: "CONFLICT",
            message: "That time is already booked.",
          });
        await db
          .update(schema.waitlistEntries)
          .set({
            status: "offered",
            startsAt: mysql(start),
            durationMinutes: input.durationMinutes,
            estimateCents: input.estimateCents,
            depositCents: input.depositCents,
            expiresAt: mysql(expiry),
          })
          .where(eq(schema.waitlistEntries.id, entry.id));
        await db.insert(schema.messages).values({
          conversationId: entry.conversationId,
          senderId: ctx.user.id,
          messageType: "text",
          content: `A cancellation slot is available on ${start.toISOString()}. Review your offer in Bookings → Cancellation offers before ${expiry.toISOString()}. The session is confirmed after payment.`,
        });
        await db
          .update(schema.conversations)
          .set({ lastMessageAt: mysql(new Date()) })
          .where(eq(schema.conversations.id, entry.conversationId));
        await db.insert(schema.notificationOutbox).values({
          eventType: "push_message",
          payloadJson: JSON.stringify({
            targetUserId: entry.clientId,
            title: "A cancellation slot is available",
            body: "Your artist has offered you a time. Review it before the offer expires.",
            url: "/waitlist",
          }),
          status: "pending",
        });
        return { offered: true };
      })
    ),
  accept: protectedProcedure.input(rowId).mutation(({ ctx, input }) =>
    withDatabaseTransaction(async db => {
      const initial = await db.query.waitlistEntries.findFirst({
        where: eq(schema.waitlistEntries.id, input.id),
      });
      if (!initial || initial.clientId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });
      await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.id, initial.artistId))
        .for("update");
      const [entry] = await db
        .select()
        .from(schema.waitlistEntries)
        .where(eq(schema.waitlistEntries.id, input.id))
        .for("update");
      if (entry.status === "accepted" && entry.sessionPlanId)
        return { sessionPlanId: entry.sessionPlanId };
      assertOfferAvailable(entry);
      const startsAt = entry.startsAt!,
        end = mysql(
          new Date(
            +new Date(startsAt.replace(" ", "T") + "Z") +
              entry.durationMinutes! * 60000
          )
        );
      const conflicts = await db
        .select({ id: schema.appointments.id })
        .from(schema.appointments)
        .where(
          and(
            eq(schema.appointments.artistId, entry.artistId),
            ne(schema.appointments.status, "cancelled"),
            lt(schema.appointments.startTime, end),
            gt(schema.appointments.endTime, startsAt)
          )
        )
        .limit(1);
      if (conflicts.length)
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "This time has since been booked. Ask your artist for another offer.",
        });
      const settings = await db.query.artistSettings.findFirst({
        where: eq(schema.artistSettings.userId, entry.artistId),
      });
      if (
        !settings?.stripeConnectAccountId ||
        settings.stripeConnectOnboardingComplete !== 1
      )
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Your artist needs to complete payment setup.",
        });
      const fees = calculateTransactionFees(
        entry.depositCents!,
        await effectivePaymentTier(settings)
      );
      const [plan] = await db.insert(schema.sessionPlans).values({
        artistId: entry.artistId,
        clientId: entry.clientId,
        conversationId: entry.conversationId,
        totalEstimateCents: entry.estimateCents!,
        depositTotalCents: entry.depositCents!,
        platformFeeCents: fees.platformFeeCents,
      });
      const session = {
        sessionIndex: 1,
        startsAt: startsAt.replace(" ", "T") + "Z",
        durationMinutes: entry.durationMinutes!,
        estimateCents: entry.estimateCents!,
        depositCents: entry.depositCents!,
      };
      await db
        .insert(schema.sessionPlanItems)
        .values({ ...session, startsAt, sessionPlanId: plan.insertId });
      const [message] = await db.insert(schema.messages).values({
        conversationId: entry.conversationId,
        senderId: entry.artistId,
        messageType: "session_plan",
        content: "Cancellation slot · review and pay the deposit to confirm",
        metadata: JSON.stringify({
          type: "session_plan",
          sessionPlanId: plan.insertId,
          sessionCount: 1,
          totalEstimateCents: entry.estimateCents,
          depositTotalCents: entry.depositCents,
          sessions: [session],
        }),
      });
      await db
        .update(schema.sessionPlans)
        .set({ messageId: message.insertId })
        .where(eq(schema.sessionPlans.id, plan.insertId));
      await db
        .update(schema.waitlistEntries)
        .set({ status: "accepted", sessionPlanId: plan.insertId })
        .where(eq(schema.waitlistEntries.id, entry.id));
      return { sessionPlanId: plan.insertId };
    })
  ),
  leave: protectedProcedure.input(rowId).mutation(({ ctx, input }) =>
    withDatabaseTransaction(async db => {
      const [entry] = await db
        .select()
        .from(schema.waitlistEntries)
        .where(eq(schema.waitlistEntries.id, input.id))
        .for("update");
      if (!entry || ![entry.clientId, entry.artistId].includes(ctx.user.id))
        throw new TRPCError({ code: "FORBIDDEN" });
      if (entry.status === "accepted")
        throw new TRPCError({
          code: "CONFLICT",
          message: "Manage the proposal in your conversation.",
        });
      await db
        .update(schema.waitlistEntries)
        .set({ status: "cancelled" })
        .where(eq(schema.waitlistEntries.id, entry.id));
      return { cancelled: true };
    })
  ),
});
