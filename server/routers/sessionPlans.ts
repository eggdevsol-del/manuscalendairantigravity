import { effectivePaymentTier } from "../services/paymentEntitlements";
import { calculateTransactionFees, resolvePaymentTier } from "../domain/fees";
import { withDatabaseTransaction } from "../services/core";
import { stripe } from "../services/stripe";
import {
  publicUserColumns,
  requireConversationAccess,
  requireArtist,
} from "../services/access";
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
    .input(
      z.object({
        clientId: z.string().optional(), // Resolved from conversation if not provided
        conversationId: z.number(),
        serviceName: z.string().optional(), // For display context
        sessions: z
          .array(
            z.object({
              sessionIndex: z.number().int().positive(),
              startsAt: z.string().datetime(), // ISO datetime
              durationMinutes: z.number().int().positive().max(1440),
              estimateCents: z.number().int().nonnegative(),
              depositCents: z.number().int().nonnegative(),
            })
          )
          .min(1)
          .max(52),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      return database.transaction(async dbRef => {
        requireArtist(ctx.user);
        const conversation = await requireConversationAccess(
          dbRef,
          input.conversationId,
          ctx.user.id,
          true
        );
        if (input.clientId && input.clientId !== conversation.clientId)
          throw new TRPCError({ code: "FORBIDDEN" });
        const artistId = ctx.user.id;

        // Resolve clientId from conversation if not explicitly provided
        let clientId = input.clientId;
        if (!clientId) {
          const convo = await dbRef.query.conversations.findFirst({
            where: eq(schema.conversations.id, input.conversationId),
          });
          if (!convo?.clientId)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Could not determine client from conversation",
            });
          clientId = convo.clientId;
        }

        // Calculate totals
        const totalEstimateCents = input.sessions.reduce(
          (sum, s) => sum + s.estimateCents,
          0
        );
        const depositTotalCents = input.sessions.reduce(
          (sum, s) => sum + s.depositCents,
          0
        );

        // Calculate platform fee (2% of deposit)
        const settings = await dbRef.query.artistSettings.findFirst({
          where: eq(schema.artistSettings.userId, artistId),
        });
        const platformFeeCents = calculateTransactionFees(
          depositTotalCents,
          await effectivePaymentTier(settings)
        ).platformFeeCents;
        const sorted = [...input.sessions].sort(
          (a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)
        );
        if (
          new Set(input.sessions.map(s => s.sessionIndex)).size !==
            input.sessions.length ||
          sorted.some(
            (s, i) =>
              s.depositCents > s.estimateCents ||
              (i > 0 &&
                +new Date(s.startsAt) <
                  +new Date(sorted[i - 1].startsAt) +
                    sorted[i - 1].durationMinutes * 60000)
          )
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Sessions must not overlap; deposits cannot exceed the estimate.",
          });

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
          const startsAtMySQL = new Date(session.startsAt)
            .toISOString()
            .slice(0, 19)
            .replace("T", " ");
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
        const sessionSummary = input.sessions
          .map(
            s =>
              `Session ${s.sessionIndex}: ${s.startsAt} · ${s.durationMinutes / 60}hrs`
          )
          .join("\n");

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
        await dbRef
          .update(schema.sessionPlans)
          .set({ messageId: msgResult.insertId })
          .where(eq(schema.sessionPlans.id, planId));

        return { sessionPlanId: planId, messageId: msgResult.insertId };
      });
    }),

  /**
   * Client accepts a session plan — creates a Stripe checkout session for the aggregated deposit.
   * Returns the clientSecret for the embedded checkout.
   */
  accept: protectedProcedure
    .input(
      z.object({
        sessionPlanId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) =>
      withDatabaseTransaction(async dbRef => {
        await dbRef
          .select({ id: schema.sessionPlans.id })
          .from(schema.sessionPlans)
          .where(eq(schema.sessionPlans.id, input.sessionPlanId))
          .for("update");

        // Fetch the plan with items
        const plan = await dbRef.query.sessionPlans.findFirst({
          where: eq(schema.sessionPlans.id, input.sessionPlanId),
          with: { items: true },
        });

        if (!plan)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Session plan not found",
          });
        if (plan.clientId !== ctx.user.id)
          throw new TRPCError({ code: "FORBIDDEN" });
        if (plan.status !== "pending")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Plan is no longer pending",
          });

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

        const artistName =
          artistSettings?.displayName || artist?.name || "Artist";
        const clientEmail = client?.email || "";
        const tier = await effectivePaymentTier(artistSettings);

        // Platform fee (already calculated at plan creation)
        const platformFeeCents = plan.platformFeeCents ?? 0;
        const artistFeeCents = calculateTransactionFees(
          plan.depositTotalCents,
          resolvePaymentTier(tier)
        ).artistFeeCents;
        const clientTotalCents = plan.depositTotalCents + platformFeeCents;

        if (
          !artistSettings?.stripeConnectAccountId ||
          artistSettings.stripeConnectOnboardingComplete !== 1
        )
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Your artist needs to finish payment setup before you can pay.",
          });

        // Generate a unique deposit token
        const depositToken = `sp_${plan.id}`;

        // Create Stripe PaymentIntent (custom checkout)
        if (plan.depositTotalCents < 100)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "A card deposit must be at least AUD $1. Ask your artist to revise the plan.",
          });
        const existingPayment = plan.stripeSessionId
          ? await stripe.paymentIntents.retrieve(plan.stripeSessionId)
          : null;
        if (
          existingPayment?.status === "succeeded" ||
          existingPayment?.status === "processing"
        )
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "This payment is already processing. Check Bookings for confirmation; do not pay again.",
          });
        if (existingPayment?.status === "canceled")
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "This checkout was cancelled. Ask your artist for a new plan.",
          });
        const paymentResult = existingPayment?.client_secret
          ? {
              clientSecret: existingPayment.client_secret,
              paymentIntentId: existingPayment.id,
            }
          : await createDepositPaymentIntent({
              leadId: plan.id,
              sessionPlanId: plan.id,
              idempotencyKey: `session-plan-${plan.id}-deposit`,
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
        await dbRef
          .update(schema.sessionPlans)
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
      })
    ),

  /**
   * Client declines a session plan.
   */
  decline: protectedProcedure
    .input(z.object({ sessionPlanId: z.number() }))
    .mutation(async ({ ctx, input }) =>
      withDatabaseTransaction(async dbRef => {
        await dbRef
          .select({ id: schema.sessionPlans.id })
          .from(schema.sessionPlans)
          .where(eq(schema.sessionPlans.id, input.sessionPlanId))
          .for("update");

        const plan = await dbRef.query.sessionPlans.findFirst({
          where: eq(schema.sessionPlans.id, input.sessionPlanId),
        });

        if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
        if (plan.clientId !== ctx.user.id)
          throw new TRPCError({ code: "FORBIDDEN" });
        if (plan.status !== "pending")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Plan is no longer pending",
          });

        if (plan.stripeSessionId) {
          const payment = await stripe.paymentIntents.retrieve(
            plan.stripeSessionId
          );
          if (payment.status === "processing" || payment.status === "succeeded")
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "Payment is processing. Wait for confirmation before changing this plan.",
            });
          if (payment.status !== "canceled")
            await stripe.paymentIntents.cancel(payment.id);
        }
        await dbRef
          .update(schema.sessionPlans)
          .set({ status: "declined" })
          .where(eq(schema.sessionPlans.id, plan.id));

        // Insert system message
        if (plan.conversationId) {
          await dbRef.insert(schema.messages).values({
            conversationId: plan.conversationId,
            senderId: ctx.user.id,
            content: "Session plan declined",
            messageType: "system",
            metadata: JSON.stringify({
              type: "session_plan_declined",
              sessionPlanId: plan.id,
            }),
          });
        }

        return { success: true };
      })
    ),

  /**
   * Artist withdraws a session plan (e.g. sent in error, dates changed).
   */
  withdraw: protectedProcedure
    .input(z.object({ sessionPlanId: z.number() }))
    .mutation(async ({ ctx, input }) =>
      withDatabaseTransaction(async dbRef => {
        await dbRef
          .select({ id: schema.sessionPlans.id })
          .from(schema.sessionPlans)
          .where(eq(schema.sessionPlans.id, input.sessionPlanId))
          .for("update");

        const plan = await dbRef.query.sessionPlans.findFirst({
          where: eq(schema.sessionPlans.id, input.sessionPlanId),
        });

        if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
        if (plan.artistId !== ctx.user.id)
          throw new TRPCError({ code: "FORBIDDEN" });
        if (plan.status !== "pending")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Plan is no longer pending",
          });

        if (plan.stripeSessionId) {
          const payment = await stripe.paymentIntents.retrieve(
            plan.stripeSessionId
          );
          if (payment.status === "processing" || payment.status === "succeeded")
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "Payment is processing. Wait for confirmation before changing this plan.",
            });
          if (payment.status !== "canceled")
            await stripe.paymentIntents.cancel(payment.id);
        }
        await dbRef
          .update(schema.sessionPlans)
          .set({ status: "withdrawn" })
          .where(eq(schema.sessionPlans.id, plan.id));

        // Insert system message
        if (plan.conversationId) {
          await dbRef.insert(schema.messages).values({
            conversationId: plan.conversationId,
            senderId: ctx.user.id,
            content: "Session plan withdrawn",
            messageType: "system",
            metadata: JSON.stringify({
              type: "session_plan_withdrawn",
              sessionPlanId: plan.id,
            }),
          });
        }

        return { success: true };
      })
    ),

  /**
   * Get session plans for a conversation (used by chat to render plan cards).
   */
  getByConversation: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ ctx, input }) => {
      const dbRef = await db.getDb();
      if (!dbRef) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await requireConversationAccess(dbRef, input.conversationId, ctx.user.id);
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
  getByClient: protectedProcedure.query(async ({ ctx }) => {
    const dbRef = await db.getDb();
    if (!dbRef) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const plans = await dbRef.query.sessionPlans.findMany({
      where: eq(schema.sessionPlans.clientId, ctx.user.id),
      with: {
        items: true,
        artist: { columns: publicUserColumns },
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
          artist: { columns: publicUserColumns },
          client: { columns: publicUserColumns },
        },
      });

      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      if (plan.artistId !== ctx.user.id && plan.clientId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return plan;
    }),
});
