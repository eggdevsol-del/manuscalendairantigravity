import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { eq, and, desc, inArray } from "drizzle-orm";
import * as schema from "../../drizzle/schema";
import { createDepositPaymentIntent } from "../services/paymentIntents";

export const sessionPlansRouter = router({
  /**
   * Artist creates a session plan and sends it to the client in their conversation.
   * Creates sessionPlan + sessionPlanItems rows, inserts a session_plan message.
   */
  create: protectedProcedure
    .input(z.object({
      clientId: z.string().optional(), // Resolved from conversation if not provided
      conversationId: z.number(),
      serviceName: z.string().optional(), // For display context
      sessions: z.array(z.object({
        sessionIndex: z.number(),
        startsAt: z.string(), // ISO datetime
        durationMinutes: z.number(),
        estimateCents: z.number(),
        depositCents: z.number(),
      })).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const dbRef = await db.getDb();
      if (!dbRef) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const artistId = ctx.user.id;

      // Resolve clientId from conversation if not explicitly provided
      let clientId = input.clientId;
      if (!clientId) {
        const convo = await dbRef.query.conversations.findFirst({
          where: eq(schema.conversations.id, input.conversationId),
        });
        if (!convo?.clientId) throw new TRPCError({ code: "BAD_REQUEST", message: "Could not determine client from conversation" });
        clientId = convo.clientId;
      }

      // Calculate totals
      const totalEstimateCents = input.sessions.reduce((sum, s) => sum + s.estimateCents, 0);
      const depositTotalCents = input.sessions.reduce((sum, s) => sum + s.depositCents, 0);

      // Calculate platform fee (2% of deposit)
      const platformFeeCents = Math.round(depositTotalCents * 0.02);

      // Create the session plan
      const [planResult] = await dbRef.insert(schema.sessionPlans).values({
        artistId,
        clientId,
        conversationId: input.conversationId,
        totalEstimateCents,
        depositTotalCents,
        platformFeeCents,
      });
      const planId = planResult.insertId;

      // Create plan items
      for (const session of input.sessions) {
        // Convert ISO datetime → MySQL format (YYYY-MM-DD HH:MM:SS)
        const startsAtMySQL = new Date(session.startsAt).toISOString().slice(0, 19).replace('T', ' ');
        await dbRef.insert(schema.sessionPlanItems).values({
          sessionPlanId: planId,
          sessionIndex: session.sessionIndex,
          startsAt: startsAtMySQL,
          durationMinutes: session.durationMinutes,
          estimateCents: session.estimateCents,
          depositCents: session.depositCents,
        });
      }

      // Insert session_plan message in the conversation
      const sessionSummary = input.sessions.map(s =>
        `Session ${s.sessionIndex}: ${s.startsAt} · ${s.durationMinutes / 60}hrs`
      ).join('\n');

      const [msgResult] = await dbRef.insert(schema.messages).values({
        conversationId: input.conversationId,
        senderId: artistId,
        content: `${input.sessions.length} sessions · $${(totalEstimateCents / 100).toFixed(2)}`,
        messageType: "session_plan",
        metadata: JSON.stringify({
          type: "session_plan",
          sessionPlanId: planId,
          sessionCount: input.sessions.length,
          totalEstimateCents,
          depositTotalCents,
          sessions: input.sessions,
        }),
      });

      // Link message to the plan
      await dbRef.update(schema.sessionPlans)
        .set({ messageId: msgResult.insertId })
        .where(eq(schema.sessionPlans.id, planId));

      return { sessionPlanId: planId, messageId: msgResult.insertId };
    }),

  /**
   * Client accepts a session plan — creates a Stripe checkout session for the aggregated deposit.
   * Returns the clientSecret for the embedded checkout.
   */
  accept: protectedProcedure
    .input(z.object({
      sessionPlanId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const dbRef = await db.getDb();
      if (!dbRef) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Fetch the plan with items
      const plan = await dbRef.query.sessionPlans.findFirst({
        where: eq(schema.sessionPlans.id, input.sessionPlanId),
        with: { items: true },
      });

      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Session plan not found" });
      if (plan.clientId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (plan.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Plan is no longer pending" });

      // Get artist settings for Stripe Connect
      const artistSettings = await dbRef.query.artistSettings.findFirst({
        where: eq(schema.artistSettings.userId, plan.artistId),
      });

      // Get artist user for name
      const artist = await dbRef.query.users.findFirst({
        where: eq(schema.users.id, plan.artistId),
      });

      // Get client email
      const client = await dbRef.query.users.findFirst({
        where: eq(schema.users.id, ctx.user.id),
      });

      const artistName = artistSettings?.displayName || artist?.name || "Artist";
      const clientEmail = client?.email || "";
      const tier = artistSettings?.subscriptionTier || "basic";

      // Platform fee (already calculated at plan creation)
      const platformFeeCents = plan.platformFeeCents || Math.round(plan.depositTotalCents * 0.02);
      const artistFeeCents = 0; // Artist doesn't pay extra
      const clientTotalCents = plan.depositTotalCents + platformFeeCents;

      // Generate a unique deposit token
      const depositToken = `sp_${plan.id}_${Date.now()}`;

      // Create Stripe PaymentIntent (custom checkout)
      const paymentResult = await createDepositPaymentIntent({
        leadId: plan.id, // We reuse leadId field for session plan ID
        depositAmountCents: plan.depositTotalCents,
        platformFeeCents,
        artistFeeCents,
        clientTotalCents,
        clientEmail,
        artistName,
        depositToken,
        stripeConnectAccountId: artistSettings?.stripeConnectAccountId,
        tier,
      });

      // Store the Stripe PaymentIntent ID on the plan
      await dbRef.update(schema.sessionPlans)
        .set({ stripeSessionId: paymentResult.paymentIntentId })
        .where(eq(schema.sessionPlans.id, plan.id));

      return {
        clientSecret: paymentResult.clientSecret,
        depositTotalCents: plan.depositTotalCents,
        platformFeeCents,
        totalCents: clientTotalCents,
        items: plan.items.map(item => ({
          sessionIndex: item.sessionIndex,
          durationMinutes: item.durationMinutes,
          depositCents: item.depositCents,
          estimateCents: item.estimateCents,
          startsAt: item.startsAt,
        })),
      };
    }),

  /**
   * Client declines a session plan.
   */
  decline: protectedProcedure
    .input(z.object({ sessionPlanId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const dbRef = await db.getDb();
      if (!dbRef) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const plan = await dbRef.query.sessionPlans.findFirst({
        where: eq(schema.sessionPlans.id, input.sessionPlanId),
      });

      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      if (plan.clientId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (plan.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Plan is no longer pending" });

      await dbRef.update(schema.sessionPlans)
        .set({ status: "declined" })
        .where(eq(schema.sessionPlans.id, plan.id));

      // Insert system message
      if (plan.conversationId) {
        await dbRef.insert(schema.messages).values({
          conversationId: plan.conversationId,
          senderId: ctx.user.id,
          content: "Session plan declined",
          messageType: "system",
          metadata: JSON.stringify({ type: "session_plan_declined", sessionPlanId: plan.id }),
        });
      }

      return { success: true };
    }),

  /**
   * Artist withdraws a session plan (e.g. sent in error, dates changed).
   */
  withdraw: protectedProcedure
    .input(z.object({ sessionPlanId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const dbRef = await db.getDb();
      if (!dbRef) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const plan = await dbRef.query.sessionPlans.findFirst({
        where: eq(schema.sessionPlans.id, input.sessionPlanId),
      });

      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      if (plan.artistId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (plan.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Plan is no longer pending" });

      await dbRef.update(schema.sessionPlans)
        .set({ status: "withdrawn" })
        .where(eq(schema.sessionPlans.id, plan.id));

      // Insert system message
      if (plan.conversationId) {
        await dbRef.insert(schema.messages).values({
          conversationId: plan.conversationId,
          senderId: ctx.user.id,
          content: "Session plan withdrawn",
          messageType: "system",
          metadata: JSON.stringify({ type: "session_plan_withdrawn", sessionPlanId: plan.id }),
        });
      }

      return { success: true };
    }),

  /**
   * Get session plans for a conversation (used by chat to render plan cards).
   */
  getByConversation: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ ctx, input }) => {
      const dbRef = await db.getDb();
      if (!dbRef) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const plans = await dbRef.query.sessionPlans.findMany({
        where: eq(schema.sessionPlans.conversationId, input.conversationId),
        with: { items: true },
        orderBy: desc(schema.sessionPlans.createdAt),
      });

      return plans;
    }),

  /**
   * Get all session plans for the current user as a client (for Bookings page).
   */
  getByClient: protectedProcedure
    .query(async ({ ctx }) => {
      const dbRef = await db.getDb();
      if (!dbRef) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const plans = await dbRef.query.sessionPlans.findMany({
        where: eq(schema.sessionPlans.clientId, ctx.user.id),
        with: {
          items: true,
          artist: true,
        },
        orderBy: desc(schema.sessionPlans.createdAt),
      });

      return plans;
    }),

  /**
   * Get a single session plan by ID with full details.
   */
  getById: protectedProcedure
    .input(z.object({ sessionPlanId: z.number() }))
    .query(async ({ ctx, input }) => {
      const dbRef = await db.getDb();
      if (!dbRef) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const plan = await dbRef.query.sessionPlans.findFirst({
        where: eq(schema.sessionPlans.id, input.sessionPlanId),
        with: {
          items: true,
          artist: true,
          client: true,
        },
      });

      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      if (plan.artistId !== ctx.user.id && plan.clientId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return plan;
    }),
});
