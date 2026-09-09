import { PAYMENT_TIERS } from "../../shared/fees";
import { effectivePaymentTier } from "../services/paymentEntitlements";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { studios, studioMembers } from "../../drizzle/schema";
import { getDb, withDatabaseTransaction } from "../services/core";
import {
  createStudioCheckoutSession,
  createArtistCheckoutSession,
  createCustomerPortalSession,
  stripe,
} from "../services/stripe";
import { artistSettings } from "../../drizzle/schema";

export const billingRouter = router({
  artistOffer: protectedProcedure.query(async () => {
    const id = process.env.STRIPE_PRO_PRICE_ID;
    if (!id) return null;
    const price = await stripe.prices.retrieve(id);
    if (
      !price.active ||
      price.currency !== "aud" ||
      price.unit_amount !== PAYMENT_TIERS.pro.subscriptionPriceCents ||
      price.recurring?.interval !== "month" ||
      price.recurring.interval_count !== 1
    )
      return null;
    return { amountCents: price.unit_amount, currency: price.currency };
  }),
  studioOffer: protectedProcedure.query(async () => {
    const priceId = process.env.STRIPE_STUDIO_PRICE_ID;
    if (!priceId) return null;
    const price = await stripe.prices.retrieve(priceId);
    if (
      !price.active ||
      price.currency !== "aud" ||
      price.unit_amount !== PAYMENT_TIERS.top.subscriptionPriceCents ||
      price.recurring?.interval !== "month" ||
      price.recurring.interval_count !== 1
    )
      return null;
    return {
      amountCents: price.unit_amount,
      currency: price.currency,
      interval: price.recurring.interval,
      intervalCount: price.recurring.interval_count,
    };
  }),
  /**
   * Get current subscription status for the logged-in artist.
   */
  subscriptionStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database connection failed",
      });

    const settings = await db.query.artistSettings.findFirst({
      where: eq(artistSettings.userId, ctx.user.id),
    });

    const rawTier = settings?.subscriptionTier || "basic";
    const { resolvePaymentTier, PAYMENT_TIERS } =
      await import("../domain/fees");
    const tier = await effectivePaymentTier(settings);
    const tierConfig = PAYMENT_TIERS[tier];

    let renewalDate: string | null = null;
    let cancelAtPeriodEnd = false;

    // If active subscription, fetch renewal date from Stripe
    if (settings?.stripeSubscriptionId) {
      try {
        const sub = await stripe.subscriptions.retrieve(
          settings.stripeSubscriptionId
        );
        renewalDate = new Date(
          ((sub as any).current_period_end ||
            sub.items.data[0]?.current_period_end) * 1000
        ).toISOString();
        cancelAtPeriodEnd = (sub as any).cancel_at_period_end;
      } catch {
        // Subscription may have been deleted
      }
    }

    return {
      tier,
      tierLabel: tierConfig.label,
      artistFeeRate: tierConfig.artistFeeRate,
      platformFeeRate: tierConfig.platformFeeRate,

      subscriptionPriceCents: tierConfig.subscriptionPriceCents,
      stripeSubscriptionId: settings?.stripeSubscriptionId || null,
      renewalDate,
      cancelAtPeriodEnd,
      isActive: tier !== "free",
    };
  }),

  /**
   * Creates a checkout session to upgrade a Studio.
   */
  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        studioId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) =>
      withDatabaseTransaction(async db => {
        if (!db)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database connection failed",
          });

        // Ensure caller is the owner
        const requester = await db.query.studioMembers.findFirst({
          where: and(
            eq(studioMembers.studioId, input.studioId),
            eq(studioMembers.userId, ctx.user.id),
            eq(studioMembers.role, "owner"),
            eq(studioMembers.status, "active")
          ),
        });

        if (!requester) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only studio owners can manage billing.",
          });
        }

        const [studio] = await db
          .select()
          .from(studios)
          .where(eq(studios.id, input.studioId))
          .for("update");
        if (!studio) throw new TRPCError({ code: "NOT_FOUND" });
        if (
          studio.stripeSubscriptionId &&
          [
            "active",
            "trialing",
            "past_due",
            "unpaid",
            "paused",
            "incomplete",
          ].includes(studio.subscriptionStatus || "")
        )
          throw new TRPCError({
            code: "CONFLICT",
            message: "Manage the existing subscription in billing.",
          });
        if (studio.stripeCheckoutSessionId) {
          const existing = await stripe.checkout.sessions.retrieve(
            studio.stripeCheckoutSessionId
          );
          if (existing.status === "open") {
            if (existing.ui_mode === "custom" && existing.client_secret)
              return {
                clientSecret: existing.client_secret,
                sessionId: existing.id,
              };
            await stripe.checkout.sessions.expire(existing.id);
          }
          if (existing.status === "complete" && !studio.stripeSubscriptionId)
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "Your checkout is complete. Refresh studio status while payment confirmation arrives.",
            });
        }
        // Create stripe checkout session
        try {
          const checkout = await createStudioCheckoutSession(
            input.studioId,
            ctx.user.email || ""
          );
          await db
            .update(studios)
            .set({ stripeCheckoutSessionId: checkout.sessionId })
            .where(eq(studios.id, input.studioId));
          return checkout;
        } catch (error: any) {
          console.error("[Stripe Checkout Error]", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "Failed to create checkout session",
          });
        }
      })
    ),

  /**
   * Creates a customer portal session to manage an existing subscription.
   */
  createPortalSession: protectedProcedure
    .input(
      z.object({
        studioId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection failed",
        });

      // Check if user is owner
      const requester = await db.query.studioMembers.findFirst({
        where: and(
          eq(studioMembers.studioId, input.studioId),
          eq(studioMembers.userId, ctx.user.id),
          eq(studioMembers.role, "owner"),
          eq(studioMembers.status, "active")
        ),
      });

      if (!requester) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only studio owners can manage billing.",
        });
      }

      // Get the studio's stripe customer id
      const studio = await db.query.studios.findFirst({
        where: eq(studios.id, input.studioId),
      });

      // If there's no subscription (no customer id), we can't create a portal session easily.
      // In a real app, `stripeSubscriptionId` can be used to retrieve the `customer` id from stripe.
      if (!studio || !studio.stripeSubscriptionId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Studio does not have an active billing subscription to manage.",
        });
      }

      try {
        // Warning: We are passing subscription Id here, but Stripe Billing Portal requires the Customer ID.
        // You would need to make a Stripe API call to retrieve the Subscription->Customer ID first.
        // Let's implement that fetch logic cleanly.
        const { stripe } = await import("../services/stripe");
        const subscription = await stripe.subscriptions.retrieve(
          studio.stripeSubscriptionId
        );
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;

        const portalUrl = await createCustomerPortalSession(customerId);
        return { url: portalUrl };
      } catch (error: any) {
        console.error("[Stripe Portal Error]", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to create customer portal session",
        });
      }
    }),

  /**
   * Creates a checkout session to upgrade an Artist Plan.
   */
  createArtistCheckoutSession: protectedProcedure
    .input(
      z.object({
        priceId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) =>
      withDatabaseTransaction(async db => {
        if (!db)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database connection failed",
          });

        if (ctx.user.role !== "artist") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only artists can upgrade artist plans.",
          });
        }

        await db
          .insert(artistSettings)
          .values({ userId: ctx.user.id, workSchedule: "{}", services: "[]" })
          .onDuplicateKeyUpdate({ set: { userId: ctx.user.id } });
        const [settings] = await db
          .select()
          .from(artistSettings)
          .where(eq(artistSettings.userId, ctx.user.id))
          .for("update");
        if (!settings)
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Complete artist setup first.",
          });
        if ((await effectivePaymentTier(settings)) !== "free")
          throw new TRPCError({
            code: "CONFLICT",
            message: "Your current plan already includes these benefits.",
          });
        if (
          settings.stripeSubscriptionId &&
          settings.subscriptionStatus !== "canceled"
        )
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Manage your existing subscription to update payment or reactivate it.",
          });
        let customerId = settings.stripeCustomerId;
        if (!customerId) {
          const customer = await stripe.customers.create({
            email: ctx.user.email || undefined,
            metadata: { artistId: ctx.user.id },
          });
          customerId = customer.id;
          await db
            .update(artistSettings)
            .set({ stripeCustomerId: customerId })
            .where(eq(artistSettings.userId, ctx.user.id));
        }
        const sessions = await stripe.checkout.sessions.list({
          customer: customerId,
          limit: 100,
        });
        const completed = sessions.data.find(
          session =>
            session.mode === "subscription" &&
            session.status === "complete" &&
            session.metadata?.artistId === ctx.user.id &&
            session.subscription !== settings.stripeSubscriptionId
        );
        if (completed)
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Payment completed. Refresh your plan while confirmation arrives.",
          });
        const existing = sessions.data.find(
          session =>
            session.mode === "subscription" &&
            session.status === "open" &&
            session.metadata?.artistId === ctx.user.id
        );
        if (existing) {
          if (existing.ui_mode === "custom" && existing.client_secret)
            return {
              clientSecret: existing.client_secret,
              sessionId: existing.id,
            };
          await stripe.checkout.sessions.expire(existing.id);
        }
        try {
          const checkoutUrl = await createArtistCheckoutSession(
            ctx.user.id,
            ctx.user.email || "",
            process.env.STRIPE_PRO_PRICE_ID || "",
            customerId
          );
          return checkoutUrl;
        } catch (error: any) {
          console.error("[Stripe Artist Checkout Error]", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              error.message || "Failed to create artist checkout session",
          });
        }
      })
    ),

  /**
   * Creates a portal session for an Artist.
   */
  createArtistPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database connection failed",
      });

    if (ctx.user.role !== "artist") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only artists can manage artist plans.",
      });
    }

    const settings = await db.query.artistSettings.findFirst({
      where: eq(artistSettings.userId, ctx.user.id),
    });

    if (!settings || !settings.stripeSubscriptionId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You do not have an active billing subscription to manage.",
      });
    }

    try {
      const { stripe } = await import("../services/stripe");
      const subscription = await stripe.subscriptions.retrieve(
        settings.stripeSubscriptionId
      );
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;

      const portalUrl = await createCustomerPortalSession(customerId);
      return { url: portalUrl };
    } catch (error: any) {
      console.error("[Stripe Artist Portal Error]", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error.message || "Failed to create artist customer portal session",
      });
    }
  }),
});
