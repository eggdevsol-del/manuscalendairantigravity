import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { studios, studioMembers } from "../../drizzle/schema";
import { getDb } from "../services/core";
import { createStudioCheckoutSession, createCustomerPortalSession } from "../services/stripe";

export const billingRouter = router({
    /**
     * Creates a checkout session to upgrade a Studio.
     */
    createCheckoutSession: protectedProcedure
        .input(z.object({
            studioId: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });

            // Ensure caller is the owner
            const requester = await db.query.studioMembers.findFirst({
                where: and(
                    eq(studioMembers.studioId, input.studioId),
                    eq(studioMembers.userId, ctx.user.id),
                    eq(studioMembers.role, 'owner')
                )
            });

            if (!requester) {
                throw new TRPCError({ code: "FORBIDDEN", message: "Only studio owners can manage billing." });
            }

            // Create stripe checkout session
            try {
                const checkoutUrl = await createStudioCheckoutSession(input.studioId, ctx.user.email || "");
                return { url: checkoutUrl };
            } catch (error: any) {
                console.error("[Stripe Checkout Error]", error);
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message || "Failed to create checkout session" });
            }
        }),

    /**
     * Creates a customer portal session to manage an existing subscription.
     */
    createPortalSession: protectedProcedure
        .input(z.object({
            studioId: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });

            // Check if user is owner
            const requester = await db.query.studioMembers.findFirst({
                where: and(
                    eq(studioMembers.studioId, input.studioId),
                    eq(studioMembers.userId, ctx.user.id),
                    eq(studioMembers.role, 'owner')
                )
            });

            if (!requester) {
                throw new TRPCError({ code: "FORBIDDEN", message: "Only studio owners can manage billing." });
            }

            // Get the studio's stripe customer id
            const studio = await db.query.studios.findFirst({
                where: eq(studios.id, input.studioId)
            });

            // If there's no subscription (no customer id), we can't create a portal session easily.
            // In a real app, `stripeSubscriptionId` can be used to retrieve the `customer` id from stripe.
            if (!studio || !studio.stripeSubscriptionId) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Studio does not have an active billing subscription to manage." });
            }

            try {
                // Warning: We are passing subscription Id here, but Stripe Billing Portal requires the Customer ID.
                // You would need to make a Stripe API call to retrieve the Subscription->Customer ID first.
                // Let's implement that fetch logic cleanly.
                const { stripe } = await import('../services/stripe');
                const subscription = await stripe.subscriptions.retrieve(studio.stripeSubscriptionId);
                const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

                const portalUrl = await createCustomerPortalSession(customerId);
                return { url: portalUrl };
            } catch (error: any) {
                console.error("[Stripe Portal Error]", error);
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message || "Failed to create customer portal session" });
            }
        }),
});
