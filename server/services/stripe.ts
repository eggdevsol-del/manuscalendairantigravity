import Stripe from 'stripe';
import { getDb } from './core';
import { eq } from 'drizzle-orm';
import { studios } from '../../drizzle/schema';
import { TRPCError } from '@trpc/server';
import type { Request, Response } from 'express';

// Initialize Stripe with secret key
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_fallback_key', {
    apiVersion: '2026-01-28.clover', // use the latest version available in types
});

/**
 * Creates a Stripe Checkout Session for upgrading to a Studio Plan.
 */
export async function createStudioCheckoutSession(studioId: string, email: string) {
    if (!process.env.VITE_APP_URL) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Missing VITE_APP_URL configuration" });
    }

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        customer_email: email,
        client_reference_id: studioId,
        line_items: [
            {
                // This price ID should be configured in your Stripe Dashboard for a $99 base + $15/seat plan
                // For a base plan with metered billing, you often pass a base price ID here.
                // Assuming you have a pre-configured Product Price ID in .env
                price: process.env.STRIPE_STUDIO_PRICE_ID,
                quantity: 1,
            },
        ],
        success_url: `${process.env.VITE_APP_URL}/studio?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.VITE_APP_URL}/subscriptions?canceled=true`,
        subscription_data: {
            metadata: {
                studioId: studioId,
            }
        }
    });

    return session.url;
}

/**
 * Creates a Stripe Customer Portal session for managing billing.
 */
export async function createCustomerPortalSession(customerId: string) {
    if (!process.env.VITE_APP_URL) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Missing VITE_APP_URL configuration" });
    }

    const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${process.env.VITE_APP_URL}/studio`,
    });

    return session.url;
}

/**
 * Express middleware to handle Stripe Webhook events.
 */
export async function handleStripeWebhook(req: Request, res: Response) {
    const signature = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
        return res.status(400).send(`Webhook Error: Missing signature or secret`);
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body, // This MUST be a raw buffer from express.raw()
            signature,
            webhookSecret
        );
    } catch (err: any) {
        console.error(`⚠️  Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const db = await getDb();
    if (!db) {
        return res.status(500).send('Database connection failed');
    }

    // Handle the event
    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const studioId = session.client_reference_id;
                const subscriptionId = session.subscription as string;

                if (studioId && subscriptionId) {
                    await db.update(studios)
                        .set({
                            stripeSubscriptionId: subscriptionId,
                            subscriptionStatus: 'active',
                            subscriptionTier: 'studio',
                        })
                        .where(eq(studios.id, studioId));
                    console.log(`[Stripe] Upgraded Studio ${studioId} to Active Subscription ${subscriptionId}`);
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const studioId = subscription.metadata.studioId;

                if (studioId) {
                    await db.update(studios)
                        .set({
                            subscriptionStatus: 'canceled',
                            subscriptionTier: 'solo', // Fallback to solo
                        })
                        .where(eq(studios.id, studioId));
                    console.log(`[Stripe] Canceled Subscription for Studio ${studioId}`);
                }
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                const studioId = subscription.metadata.studioId;
                const status = subscription.status; // 'active', 'past_due', 'canceled', 'unpaid'

                if (studioId) {
                    await db.update(studios)
                        .set({
                            subscriptionStatus: status as any,
                        })
                        .where(eq(studios.id, studioId));
                    console.log(`[Stripe] Updated Subscription Status to ${status} for Studio ${studioId}`);
                }
                break;
            }
            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        res.status(200).send('Event processed successfully');
    } catch (error) {
        console.error('[Stripe Webhook Error]', error);
        res.status(500).send('Webhook handler failed');
    }
}
