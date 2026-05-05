import Stripe from "stripe";
import { getDb } from "./core";
import { eq } from "drizzle-orm";
import { studios, artistSettings, leads, messages, paymentLedger, appointments } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";
import type { Request, Response } from "express";

/**
 * REQUIRED_WEBHOOK_EVENTS — Register ALL of these in the Stripe Dashboard.
 *
 * Dashboard → Developers → Webhooks → Add endpoint
 * Endpoint URL: https://your-domain.com/api/stripe/webhook
 *
 * If ANY of these are missing, the corresponding handler in
 * handleStripeWebhook() will never fire, which can cause:
 * - Missed ledger entries (financial reporting gaps)
 * - Undisputed chargebacks going unpatched
 * - Stale Connect account status
 */
export const REQUIRED_WEBHOOK_EVENTS = [
  // ── Payment Events ──
  "checkout.session.completed",   // Deposit + balance payments → ledger write + status update
  "payment_intent.succeeded",     // Direct payment confirmation

  // ── Subscription Events ──
  "customer.subscription.deleted",  // Artist cancels Pro subscription
  "customer.subscription.updated",  // Subscription status changes

  // ── Connect Events ──
  "account.updated",              // Artist Connect onboarding/status changes

  // ── Payout Events (Custom Connect) ──
  "payout.paid",                  // Custom artist payout deposited → email notification
  "payout.failed",                // Custom artist payout failed → email notification

  // ── Refund Events ──
  "charge.refunded",              // Refund issued → negative ledger entry

  // ── Dispute Events (v2.3 §6) ──
  "charge.dispute.created",       // Freeze artist payout, write dispute ledger entry
  "charge.dispute.closed",        // Release payout (won) or deduct (lost)
] as const;

// Initialize Stripe with secret key
export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "sk_test_fallback_key",
  {
    apiVersion: "2026-01-28.clover", // use the latest version available in types
  }
);

const getAppUrl = () => process.env.VITE_APP_URL || process.env.APP_URL || "https://www.tattoi.app";

/**
 * Creates a Stripe Checkout Session for upgrading to a Studio Plan.
 */
export async function createStudioCheckoutSession(
  studioId: string,
  email: string
) {
  const appUrl = getAppUrl();

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
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
    success_url: `${appUrl}/studio?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/subscriptions?canceled=true`,
    subscription_data: {
      metadata: {
        studioId: studioId,
      },
    },
  });

  return session.url;
}

/**
 * Creates a Stripe Checkout Session for upgrading Artist Plans.
 */
export async function createArtistCheckoutSession(
  artistId: string,
  email: string,
  priceId: string
) {
  const appUrl = getAppUrl();

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    customer_email: email,
    client_reference_id: artistId,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/settings/billing?canceled=true`,
    subscription_data: {
      metadata: {
        artistId: artistId,
      },
    },
  });

  return session.url;
}

/**
 * Creates a Stripe Customer Portal session for managing billing.
 * Scoped to: cancel subscription + update payment method only.
 * No plan changes allowed (only one paid tier).
 */
export async function createCustomerPortalSession(customerId: string) {
  const appUrl = getAppUrl();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/subscriptions`,
    // Portal is configured in the Stripe Dashboard → Settings → Customer Portal
    // Ensure only these features are enabled:
    //   ✅ Cancel subscription
    //   ✅ Update payment method
    //   ❌ Switch plans (disabled — only one paid tier)
    //   ❌ Update quantity (N/A)
  });

  return session.url;
}


/**
 * Creates a Stripe Checkout Session for a one-time deposit payment.
 * Now supports Connect routing (§6.1) and per-transaction fees (§4.2).
 *
 * All payments are card-only.
 */
export async function createDepositCheckoutSession(opts: {
  leadId: number;
  depositAmountCents: number;
  platformFeeCents: number;
  artistFeeCents: number;
  clientTotalCents: number;
  clientEmail: string;
  artistName: string;
  depositToken: string;
  messageId?: number;
  stripeConnectAccountId?: string | null;
  tier: string;
  successUrl?: string;
}) {
  const baseUrl = getAppUrl();

  // Combined application fee = platform fee + artist fee (v2.3 §1)
  const applicationFeeCents = opts.platformFeeCents + opts.artistFeeCents;

  // Build the session config
  const sessionConfig: any = {
    ui_mode: "embedded",
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: opts.clientEmail,
    client_reference_id: String(opts.leadId),
    line_items: [
      {
        price_data: {
          currency: "aud",
          product_data: {
            name: `Booking Deposit — ${opts.artistName}`,
            description: "Deposit to secure your appointment",
          },
          unit_amount: opts.clientTotalCents, // Base + platform fee
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "deposit",
      leadId: String(opts.leadId),
      depositToken: opts.depositToken,
      messageId: opts.messageId ? String(opts.messageId) : "",
      platformFeeCents: String(opts.platformFeeCents),
      artistFeeCents: String(opts.artistFeeCents),
      baseAmountCents: String(opts.depositAmountCents),
      stripeConnectAccountId: opts.stripeConnectAccountId || "",
      tier: opts.tier,
    },
    return_url: opts.successUrl 
      ? `${opts.successUrl}${opts.successUrl.includes('?') ? '&' : '?'}status=success&session_id={CHECKOUT_SESSION_ID}`
      : `${baseUrl}/deposit/${opts.depositToken}?status=success&session_id={CHECKOUT_SESSION_ID}`,
  };

  // Connect routing — route payment to artist (§6.1)
  if (opts.stripeConnectAccountId) {
    sessionConfig.payment_intent_data = {
      application_fee_amount: applicationFeeCents,
      transfer_data: {
        destination: opts.stripeConnectAccountId,
      },
    };
  }

  const session = await stripe.checkout.sessions.create(sessionConfig);
  return {
    url: session.url,
    clientSecret: session.client_secret
  };
}

/**
 * Creates a Stripe Checkout Session for a balance payment.
 * All payments are card-only.
 */
export async function createBalanceCheckoutSession(opts: {
  bookingId: number;
  balanceAmountCents: number;
  platformFeeCents: number;
  artistFeeCents: number;
  clientTotalCents: number;
  clientEmail: string;
  artistName: string;
  paymentMethods: string[]; // Card-only, from getAllowedPaymentMethods()
  stripeConnectAccountId?: string | null;
  tier: string;
  balanceToken: string;
}) {
  const baseUrl = getAppUrl();

  // Combined application fee = platform fee + artist fee (v2.3 §1)
  const applicationFeeCents = opts.platformFeeCents + opts.artistFeeCents;

  const sessionConfig: any = {
    payment_method_types: opts.paymentMethods, // Card-only
    mode: "payment",
    customer_email: opts.clientEmail,
    client_reference_id: String(opts.bookingId),
    line_items: [
      {
        price_data: {
          currency: "aud",
          product_data: {
            name: `Balance Payment — ${opts.artistName}`,
            description: "Remaining balance for your booking",
          },
          unit_amount: opts.clientTotalCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "balance",
      bookingId: String(opts.bookingId),
      platformFeeCents: String(opts.platformFeeCents),
      artistFeeCents: String(opts.artistFeeCents),
      baseAmountCents: String(opts.balanceAmountCents),
      stripeConnectAccountId: opts.stripeConnectAccountId || "",
      tier: opts.tier,
      balanceToken: opts.balanceToken,
    },
    success_url: `${baseUrl}/booking/${opts.bookingId}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/booking/${opts.bookingId}?payment=canceled`,
  };

  // Connect routing
  if (opts.stripeConnectAccountId) {
    sessionConfig.payment_intent_data = {
      application_fee_amount: applicationFeeCents,
      transfer_data: {
        destination: opts.stripeConnectAccountId,
      },
    };
  }

  const session = await stripe.checkout.sessions.create(sessionConfig);
  return session.url;
}


/**
 * Express middleware to handle Stripe Webhook events.
 */
export async function handleStripeWebhook(req: Request, res: Response) {
  const signature = req.headers["stripe-signature"];
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
    return res.status(500).send("Database connection failed");
  }

  // Handle the event
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // ── Deposit Payment (one-time) ──────────────────────────
        if (session.metadata?.type === "deposit") {
          const leadId = parseInt(session.metadata.leadId, 10);
          const messageId = session.metadata.messageId ? parseInt(session.metadata.messageId, 10) : undefined;

          if (leadId) {
            const lead = await db.query.leads.findFirst({
              where: eq(leads.id, leadId),
            });
            if (!lead) break;

            const now = new Date().toISOString().slice(0, 19).replace("T", " ");
            await db
              .update(leads)
              .set({
                depositMethod: "stripe",
                depositClaimedAt: now,
                depositVerifiedAt: now,
                stripeCheckoutSessionId: session.id,
                status: "deposit_verified" as any,
                updatedAt: now,
              })
              .where(eq(leads.id, leadId));

            // Update proposal message status to confirmed automatically
            if (messageId) {
              const message = await db.query.messages.findFirst({
                where: eq(messages.id, messageId),
              });

              if (message && message.metadata) {
                try {
                  const meta = typeof message.metadata === 'string'
                    ? JSON.parse(message.metadata)
                    : message.metadata;

                  meta.status = "confirmed";

                  await db.update(messages)
                    .set({ metadata: JSON.stringify(meta) })
                    .where(eq(messages.id, messageId));

                  console.log(`[Stripe] Proposal message ${messageId} confirmed for Lead ${leadId}`);
                } catch (e) {
                  console.error(`[Stripe] Failed to update message ${messageId} metadata`, e);
                }
              }
            }

            // Confirm all pending appointments for this conversation
            const { confirmAppointments } = await import("./appointmentService");
            try {
              if (lead.conversationId) {
                await confirmAppointments(lead.conversationId);
                console.log(`[Stripe] Confirmed appointments for conversation ${lead.conversationId}`);
              }
            } catch (e) {
              console.error(`[Stripe] Failed to confirm appointments for conversation ${lead.conversationId}`, e);
            }

            // ── Ledger Write (§12) ──
            const platformFeeCents = session.metadata.platformFeeCents
              ? parseInt(session.metadata.platformFeeCents, 10)
              : 0;
            const artistFeeCents = session.metadata.artistFeeCents
              ? parseInt(session.metadata.artistFeeCents, 10)
              : 0;
            const baseAmountCents = session.metadata.baseAmountCents
              ? parseInt(session.metadata.baseAmountCents, 10)
              : lead.depositAmount || 0;
            const connectAccountId = session.metadata.stripeConnectAccountId || null;

            await db.insert(paymentLedger).values({
              bookingId: null, // Deposit is on lead, not yet booked
              artistId: lead.artistId,
              clientId: lead.clientId || null,
              transactionType: "deposit",
              amountCents: baseAmountCents,
              platformFeeCents,
              artistFeeCents,
              stripePaymentId: session.payment_intent as string || session.id,
              stripeConnectAccountId: connectAccountId,
              tier: (session.metadata.tier as any) || "free",
              paymentMethod: "card", // Deposits are always card
            });

            console.log(
              `[Stripe] Deposit verified for Lead ${leadId} (Session: ${session.id}), Ledger entry written`
            );
          }
          break;
        }

        // ── Balance Payment ──────────────────────────────────────
        if (session.metadata?.type === "balance") {
          const bookingId = parseInt(session.metadata.bookingId, 10);
          const platformFeeCents = parseInt(session.metadata.platformFeeCents || "0", 10);
          const baseAmountCents = parseInt(session.metadata.baseAmountCents || "0", 10);

          if (bookingId) {
            const now = new Date().toISOString().slice(0, 19).replace("T", " ");
            const booking = await db.query.appointments.findFirst({
              where: eq(appointments.id, bookingId),
            });

            if (booking) {
              const newPaid = (booking.totalPaidAmountCents || 0) + baseAmountCents;
              const remaining = (booking.totalExpectedAmountCents || 0) - newPaid;

              await db.update(appointments).set({
                balancePaymentId: session.payment_intent as string || session.id,
                totalPaidAmountCents: newPaid,
                remainingBalanceCents: Math.max(remaining, 0),
                paymentStatus: remaining <= 0 ? "fully_paid" as any : "deposit_paid" as any,
                clientPaid: remaining <= 0 ? 1 : 0,
                updatedAt: now,
              }).where(eq(appointments.id, bookingId));

              // Ledger write
              const balanceArtistFeeCents = session.metadata.artistFeeCents
                ? parseInt(session.metadata.artistFeeCents, 10)
                : 0;
              const balanceConnectAccountId = session.metadata.stripeConnectAccountId || null;

              await db.insert(paymentLedger).values({
                bookingId,
                artistId: booking.artistId,
                clientId: booking.clientId,
                transactionType: "balance",
                amountCents: baseAmountCents,
                platformFeeCents,
                artistFeeCents: balanceArtistFeeCents,
                stripePaymentId: session.payment_intent as string || session.id,
                stripeConnectAccountId: balanceConnectAccountId,
                tier: (session.metadata.tier as any) || "free",
                paymentMethod: session.payment_method_types?.[0] || "card",
              });

              console.log(`[Stripe] Balance paid for Booking ${bookingId}, remaining: ${remaining}`);
            }
          }
          break;
        }

        // ── Subscription Checkout ────────────────────────────────
        const subscriptionId = session.subscription as string;

        // Handle Studio Checkout
        const studioId = session.metadata?.studioId || (session.subscription && typeof session.subscription !== 'string' ? (session.subscription as any).metadata?.studioId : null);

        if (studioId && subscriptionId) {
          await db
            .update(studios)
            .set({
              stripeSubscriptionId: subscriptionId,
              subscriptionStatus: "active",
              subscriptionTier: "studio",
            })
            .where(eq(studios.id, studioId));
          console.log(
            `[Stripe] Upgraded Studio ${studioId} to Active Subscription ${subscriptionId}`
          );
        }

        // Handle Artist Checkout
        const artistId = session.metadata?.artistId || (session.subscription && typeof session.subscription !== 'string' ? (session.subscription as any).metadata?.artistId : null) || session.client_reference_id;

        if (artistId && subscriptionId && !studioId) {
          await db
            .update(artistSettings)
            .set({
              stripeSubscriptionId: subscriptionId,
              subscriptionStatus: "active",
            })
            .where(eq(artistSettings.userId, artistId));

          console.log(
            `[Stripe] Upgraded Artist ${artistId} to Active Subscription ${subscriptionId}`
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const studioId = subscription.metadata.studioId;
        const artistId = subscription.metadata.artistId;

        if (studioId) {
          await db
            .update(studios)
            .set({
              subscriptionStatus: "canceled",
              subscriptionTier: "solo", // Fallback to solo
            })
            .where(eq(studios.id, studioId));
          console.log(`[Stripe] Canceled Subscription for Studio ${studioId}`);
        }

        if (artistId) {
          await db
            .update(artistSettings)
            .set({
              subscriptionStatus: "canceled",
              subscriptionTier: "basic", // Fallback to basic
            })
            .where(eq(artistSettings.userId, artistId));
          console.log(`[Stripe] Canceled Subscription for Artist ${artistId}`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const studioId = subscription.metadata.studioId;
        const artistId = subscription.metadata.artistId;
        const status = subscription.status; // 'active', 'past_due', 'canceled', 'unpaid'

        if (studioId) {
          await db
            .update(studios)
            .set({
              subscriptionStatus: status as any,
            })
            .where(eq(studios.id, studioId));
          console.log(
            `[Stripe] Updated Subscription Status to ${status} for Studio ${studioId}`
          );
        }

        if (artistId) {
          // Identify the tier based on the price ID in the subscription
          const priceId = subscription.items.data[0]?.price.id;
          let newTier = "basic";
          // These should ideally match process.env variables, making a rough mapping for safety:
          if (priceId === process.env.STRIPE_PRO_PRICE_ID) newTier = "pro";
          if (priceId === process.env.STRIPE_ELITE_PRICE_ID) newTier = "elite";

          await db
            .update(artistSettings)
            .set({
              subscriptionStatus: status as any,
              subscriptionTier: status === "active" || status === "trialing" ? (newTier as any) : "basic",
            })
            .where(eq(artistSettings.userId, artistId));
          console.log(
            `[Stripe] Updated Subscription Status to ${status} (Tier: ${newTier}) for Artist ${artistId}`
          );
        }
        break;
      }
      // ── Stripe Connect: Account Updated ─────────────────────
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const { syncAccountStatusToDb } = await import("./stripeConnect");
        await syncAccountStatusToDb(account.id);
        break;
      }

      // ── Refund Ledger Write ─────────────────────────────────
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const refundAmount = charge.amount_refunded || 0;

        if (refundAmount > 0) {
          await db.insert(paymentLedger).values({
            transactionType: "refund",
            amountCents: -refundAmount, // Negative for refunds
            platformFeeCents: 0,
            artistFeeCents: 0,
            stripePaymentId: charge.id,
            metadata: JSON.stringify({ refundReason: charge.metadata?.refundReason || "unknown" }),
          });
          console.log(`[Stripe] Refund ledger entry: ${charge.id}, amount: -${refundAmount}`);
        }
        break;
      }

      // ── Dispute Handling (v2.3 §6) ─────────────────────────
      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;

        // Write dispute ledger entry
        await db.insert(paymentLedger).values({
          transactionType: "dispute",
          amountCents: dispute.amount, // Disputed amount (positive — held)
          platformFeeCents: 0,
          artistFeeCents: 0,
          stripePaymentId: chargeId || dispute.id,
          payoutStatus: "held",
          metadata: JSON.stringify({
            disputeId: dispute.id,
            reason: dispute.reason,
            status: dispute.status,
          }),
        });

        console.log(
          `[Stripe] Dispute created: ${dispute.id}, amount: ${dispute.amount}, charge: ${chargeId}`
        );
        break;
      }

      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
        const won = dispute.status === "won";

        // Update ledger: release payout if won, deduct if lost
        await db.insert(paymentLedger).values({
          transactionType: "dispute",
          amountCents: won ? 0 : -(dispute.amount), // Lost = deduct from artist
          platformFeeCents: 0,
          artistFeeCents: 0,
          stripePaymentId: chargeId || dispute.id,
          payoutStatus: won ? "paid" : "held",
          metadata: JSON.stringify({
            disputeId: dispute.id,
            outcome: won ? "won" : "lost",
            status: dispute.status,
          }),
        });

        console.log(
          `[Stripe] Dispute closed: ${dispute.id}, outcome: ${won ? "WON" : "LOST"}`
        );
        break;
      }

      // ── Payout Notifications (Custom accounts) ──────────────
      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout;
        const connectAccountId = event.account;
        if (!connectAccountId) break;

        // Send email for Custom accounts (they have no Stripe dashboard)
        const payoutArtist = await db
          .select({
            userId: artistSettings.userId,
            businessEmail: artistSettings.businessEmail,
            stripeConnectAccountType: artistSettings.stripeConnectAccountType,
          })
          .from(artistSettings)
          .where(eq(artistSettings.stripeConnectAccountId, connectAccountId))
          .then((rows: any[]) => rows[0]);

        if (payoutArtist?.stripeConnectAccountType === "custom") {
          const { sendEmail } = await import("./email");
          const amountFormatted = `$${((payout.amount || 0) / 100).toFixed(2)}`;
          await sendEmail({
            to: payoutArtist.businessEmail || "",
            subject: `Payout of ${amountFormatted} has been deposited`,
            body: `Your payout of ${amountFormatted} ${(payout.currency || "aud").toUpperCase()} has been deposited to your bank account.`,
          });
        }

        console.log(
          `[Stripe] Payout paid: ${payout.id}, amount: ${payout.amount}, account: ${connectAccountId}`
        );
        break;
      }

      case "payout.failed": {
        const payout = event.data.object as Stripe.Payout;
        const connectAccountId = event.account;
        if (!connectAccountId) break;

        const payoutArtist = await db
          .select({
            userId: artistSettings.userId,
            businessEmail: artistSettings.businessEmail,
            stripeConnectAccountType: artistSettings.stripeConnectAccountType,
          })
          .from(artistSettings)
          .where(eq(artistSettings.stripeConnectAccountId, connectAccountId))
          .then((rows: any[]) => rows[0]);

        if (payoutArtist?.stripeConnectAccountType === "custom") {
          const { sendEmail } = await import("./email");
          const amountFormatted = `$${((payout.amount || 0) / 100).toFixed(2)}`;
          await sendEmail({
            to: payoutArtist.businessEmail || "",
            subject: `Payout of ${amountFormatted} failed`,
            body: `Your payout of ${amountFormatted} ${(payout.currency || "aud").toUpperCase()} has failed. Failure reason: ${payout.failure_message || "unknown"}. Please check your bank details in the app.`,
          });
        }

        console.log(
          `[Stripe] Payout failed: ${payout.id}, reason: ${payout.failure_message}, account: ${connectAccountId}`
        );
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.status(200).send("Event processed successfully");
  } catch (error) {
    console.error("[Stripe Webhook Error]", error);
    res.status(500).send("Webhook handler failed");
  }
}
