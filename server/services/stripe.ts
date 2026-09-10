import { PAYMENT_TIERS } from "../../shared/fees";
import {
  changeOrderInventory,
  releaseExpiredStoreOrder,
} from "./storeInventory";
import { or } from "drizzle-orm";
import { inArray } from "drizzle-orm";
import { reconcileChargeRefund } from "./refundReconciliation";
import { notificationOutbox } from "../../drizzle/schema";
import { settledBalance } from "../domain/paymentState";
import { processWebhookOnce } from "./webhookProcessing";
import { fulfillSessionPlan } from "./sessionPlanFulfillment";
import Stripe from "stripe";
import { getDb } from "./core";
import { eq, and } from "drizzle-orm";
import {
  studios,
  artistSettings,
  leads,
  messages,
  paymentLedger,
  appointments,
  orders,
  products,
  orderItems,
  users,
  conversations,
  merchants,
  sessionPlans,
  sessionPlanItems,
} from "../../drizzle/schema";
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
  "checkout.session.expired", // Release stock reserved by abandoned store checkouts
  "checkout.session.completed", // Deposit + balance payments → ledger write + status update
  "payment_intent.succeeded", // Direct payment confirmation

  // ── Subscription Events ──
  "customer.subscription.deleted", // Artist cancels Pro subscription
  "customer.subscription.updated", // Subscription status changes

  // ── Connect Events ──
  "account.updated", // Artist Connect onboarding/status changes

  // ── Payout Events (Custom Connect) ──
  "payout.paid", // Custom artist payout deposited → email notification
  "payout.failed", // Custom artist payout failed → email notification

  // ── Refund Events ──
  "charge.refunded", // Refund issued → negative ledger entry

  // ── Dispute Events (v2.3 §6) ──
  "charge.dispute.created", // Freeze artist payout, write dispute ledger entry
  "charge.dispute.closed", // Release payout (won) or deduct (lost)
] as const;

// Initialize Stripe with secret key
export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "sk_test_fallback_key",
  {
    apiVersion: "2026-01-28.clover", // use the latest version available in types
  }
);

const getAppUrl = () =>
  process.env.VITE_APP_URL || process.env.APP_URL || "https://www.tattoi.app";

/**
 * Creates a Stripe Checkout Session for upgrading to a Studio Plan.
 */
export async function createStudioCheckoutSession(
  studioId: string,
  email: string
) {
  if (!process.env.STRIPE_STUDIO_PRICE_ID)
    throw new Error("Studio billing is not configured yet.");
  const price = await stripe.prices.retrieve(
    process.env.STRIPE_STUDIO_PRICE_ID!
  );
  if (
    !price.active ||
    price.currency !== "aud" ||
    price.unit_amount !== PAYMENT_TIERS.top.subscriptionPriceCents ||
    price.recurring?.interval !== "month" ||
    price.recurring.interval_count !== 1
  )
    throw new Error(
      "Studio price configuration does not match the displayed plan."
    );
  const appUrl = getAppUrl();

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    customer_email: email,
    client_reference_id: studioId,
    metadata: { studioId },
    line_items: [
      {
        price: process.env.STRIPE_STUDIO_PRICE_ID,
        quantity: 1,
      },
    ],
    ui_mode: "custom",
    return_url: `${appUrl}/studio?success=true&session_id={CHECKOUT_SESSION_ID}`,
    subscription_data: {
      metadata: {
        studioId: studioId,
      },
    },
  });

  return { clientSecret: session.client_secret!, sessionId: session.id };
}

/**
 * Creates a Stripe Checkout Session for upgrading Artist Plans.
 */
export async function createArtistCheckoutSession(
  artistId: string,
  email: string,
  priceId: string,
  customerId?: string
) {
  if (!priceId || priceId !== process.env.STRIPE_PRO_PRICE_ID)
    throw new Error("Pro billing is not configured.");
  const price = await stripe.prices.retrieve(priceId);
  if (
    !price.active ||
    price.currency !== "aud" ||
    price.unit_amount !== PAYMENT_TIERS.pro.subscriptionPriceCents ||
    price.recurring?.interval !== "month" ||
    price.recurring.interval_count !== 1
  )
    throw new Error(
      "Pro price configuration does not match the displayed plan."
    );
  const appUrl = getAppUrl();

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    ...(customerId ? { customer: customerId } : { customer_email: email }),
    client_reference_id: artistId,
    metadata: { artistId, tier: "pro" },
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    ui_mode: "custom",
    return_url: `${appUrl}/subscriptions?success=true&session_id={CHECKOUT_SESSION_ID}`,
    subscription_data: {
      metadata: {
        artistId: artistId,
        tier: "pro",
      },
    },
  });

  return { clientSecret: session.client_secret!, sessionId: session.id };
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
    ui_mode: "custom",
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
      ? `${opts.successUrl}${opts.successUrl.includes("?") ? "&" : "?"}status=success&session_id={CHECKOUT_SESSION_ID}`
      : `${baseUrl}/deposit/${opts.depositToken}?status=success&session_id={CHECKOUT_SESSION_ID}`,
  };

  // Connect routing — route payment to artist (§6.1)
  if (opts.stripeConnectAccountId) {
    sessionConfig.payment_intent_data = {
      application_fee_amount: applicationFeeCents,
      on_behalf_of: opts.stripeConnectAccountId,
      transfer_data: {
        destination: opts.stripeConnectAccountId,
      },
    };
  }

  const session = await stripe.checkout.sessions.create(sessionConfig);
  return {
    url: session.url,
    clientSecret: session.client_secret,
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
  balanceToken?: string;
  returnUrl?: string;
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
      balanceToken: opts.balanceToken || "",
    },
    ui_mode: "custom",
    return_url: opts.returnUrl
      ? `${opts.returnUrl}${opts.returnUrl.includes("?") ? "&" : "?"}status=success&session_id={CHECKOUT_SESSION_ID}`
      : `${baseUrl}/balance/${opts.bookingId}?status=success&session_id={CHECKOUT_SESSION_ID}`,
  };

  // Connect routing
  if (opts.stripeConnectAccountId) {
    sessionConfig.payment_intent_data = {
      application_fee_amount: applicationFeeCents,
      on_behalf_of: opts.stripeConnectAccountId,
      transfer_data: {
        destination: opts.stripeConnectAccountId,
      },
    };
  }

  const session = await stripe.checkout.sessions.create(sessionConfig);
  return {
    url: session.url,
    clientSecret: session.client_secret,
  };
}

export async function createStorefrontCheckoutSession(opts: {
  orderId: number;
  items: {
    productId: number;
    productName: string;
    priceCents: number;
    quantity: number;
  }[];
  artistName: string;
  clientTotalCents: number;
  platformFeeCents: number;
  artistFeeCents: number;
  shippingCostCents: number;
  fulfillmentMethod: "pickup" | "delivery" | "digital";
  stripeConnectAccountId?: string;
  slug: string;
  currency?: string;
  stockReserved?: boolean;
  returnPath?: string;
}): Promise<{
  url: string | null;
  clientSecret: string | null;
  sessionId: string;
}> {
  const baseUrl =
    process.env.APP_URL || process.env.VITE_APP_URL || "https://www.tattoi.app";

  // If using connect, GST/platform fee goes to platform account
  const applicationFeeCents = opts.platformFeeCents + opts.artistFeeCents;

  const line_items = opts.items.map(item => ({
    price_data: {
      currency: opts.currency || "aud",
      product_data: {
        name: `${item.productName} — ${opts.artistName}`,
      },
      unit_amount: item.priceCents,
    },
    quantity: item.quantity,
  }));

  if (opts.platformFeeCents > 0)
    line_items.push({
      price_data: {
        currency: opts.currency || "aud",
        product_data: { name: "Platform fee" },
        unit_amount: opts.platformFeeCents,
      },
      quantity: 1,
    });
  const sessionConfig: Stripe.Checkout.SessionCreateParams = {
    payment_method_types: ["card"], // 'apple_pay' and 'google_pay' are auto-handled by Stripe through Elements when available
    mode: "payment",
    expires_at: Math.floor(Date.now() / 1000) + 1800,
    line_items,
    metadata: {
      type: "store_order",
      stockReserved: opts.stockReserved ? "1" : "0",
      orderId: String(opts.orderId),
      platformFeeCents: String(opts.platformFeeCents),
      artistFeeCents: String(opts.artistFeeCents),
      stripeConnectAccountId: opts.stripeConnectAccountId || "",
    },
    phone_number_collection: {
      enabled: true,
    },
    ui_mode: "custom",
    return_url: `${baseUrl}${opts.returnPath || `/shop/${opts.slug}`}?status=success&session_id={CHECKOUT_SESSION_ID}&order_id=${opts.orderId}`,
  };

  if (opts.fulfillmentMethod === "delivery") {
    sessionConfig.shipping_address_collection = {
      allowed_countries: ["AU", "NZ", "US", "GB", "CA"],
    };

    if (opts.shippingCostCents >= 0) {
      sessionConfig.shipping_options = [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: {
              amount: opts.shippingCostCents,
              currency: opts.currency || "aud",
            },
            display_name:
              opts.shippingCostCents === 0
                ? "Free Shipping"
                : "Standard Shipping",
          },
        },
      ];
    }
  }

  // Connect routing
  if (opts.stripeConnectAccountId) {
    sessionConfig.payment_intent_data = {
      application_fee_amount: applicationFeeCents,
      on_behalf_of: opts.stripeConnectAccountId,
      transfer_data: {
        destination: opts.stripeConnectAccountId,
      },
    };
  }

  const session = await stripe.checkout.sessions.create(sessionConfig, {
    idempotencyKey: `store-order-${opts.orderId}`,
  });
  return {
    url: session.url,
    clientSecret: session.client_secret,
    sessionId: session.id,
  };
}

/**
 * Creates a Stripe Checkout Session for an artist-initiated payment request.
 * Follows the same pattern as createBalanceCheckoutSession.
 */
export async function createPaymentRequestCheckoutSession(opts: {
  requestId: number;
  appointmentId: number;
  amountCents: number;
  platformFeeCents: number;
  artistFeeCents: number;
  clientTotalCents: number;
  clientEmail: string;
  artistName: string;
  stripeConnectAccountId?: string;
  tier: string;
  token: string;
  previousSessionId?: string;
}): Promise<{
  url: string | null;
  clientSecret: string | null;
  sessionId: string;
}> {
  const baseUrl = getAppUrl();

  // Combined application fee = platform fee + artist fee
  const applicationFeeCents = opts.platformFeeCents + opts.artistFeeCents;

  const sessionConfig: any = {
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: opts.clientEmail || undefined,
    client_reference_id: String(opts.appointmentId),
    line_items: [
      {
        price_data: {
          currency: "aud",
          product_data: {
            name: `Session Payment — ${opts.artistName}`,
            description: `Payment request for your upcoming session`,
          },
          unit_amount: opts.clientTotalCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "payment_request",
      requestId: String(opts.requestId),
      appointmentId: String(opts.appointmentId),
      platformFeeCents: String(opts.platformFeeCents),
      artistFeeCents: String(opts.artistFeeCents),
      baseAmountCents: String(opts.amountCents),
      stripeConnectAccountId: opts.stripeConnectAccountId || "",
      tier: opts.tier,
    },
    ui_mode: "custom",
    return_url: `${baseUrl}/pay/${opts.token}?status=success&session_id={CHECKOUT_SESSION_ID}`,
  };

  // Connect routing — route payment to artist
  if (opts.stripeConnectAccountId) {
    sessionConfig.payment_intent_data = {
      application_fee_amount: applicationFeeCents,
      on_behalf_of: opts.stripeConnectAccountId,
      transfer_data: {
        destination: opts.stripeConnectAccountId,
      },
    };
  }

  const session = await stripe.checkout.sessions.create(sessionConfig, {
    idempotencyKey: `payment-request:${opts.requestId}:${opts.previousSessionId || "initial"}:${opts.clientTotalCents}`,
  });
  return {
    url: session.url,
    clientSecret: session.client_secret,
    sessionId: session.id,
  };
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

  // Receipts and all database effects commit together; retries roll back cleanly.
  try {
    await processWebhookOnce(event, async db => {
      // Different payments for the same booking must not lose one another's balance updates.
      const meta = (event.data.object as { metadata?: Record<string, string> })
        .metadata;
      const bookingId = Number(meta?.bookingId || meta?.appointmentId);
      if (Number.isSafeInteger(bookingId) && bookingId > 0)
        await db
          .select({ id: appointments.id })
          .from(appointments)
          .where(eq(appointments.id, bookingId))
          .for("update");

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          if (session.mode === "payment" && session.payment_status !== "paid")
            break;

          // ── Deposit Payment (one-time) ──────────────────────────
          if (session.metadata?.type === "deposit") {
            const leadId = parseInt(session.metadata.leadId, 10);
            const messageId = session.metadata.messageId
              ? parseInt(session.metadata.messageId, 10)
              : undefined;

            if (leadId) {
              const lead = await db.query.leads.findFirst({
                where: eq(leads.id, leadId),
              });
              if (!lead) throw new Error("Deposit lead was not found.");

              const now = new Date()
                .toISOString()
                .slice(0, 19)
                .replace("T", " ");
              const nowDate = new Date();
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
                    const meta =
                      typeof message.metadata === "string"
                        ? JSON.parse(message.metadata)
                        : message.metadata;

                    meta.status = "confirmed";

                    await db
                      .update(messages)
                      .set({ metadata: JSON.stringify(meta) })
                      .where(eq(messages.id, messageId));

                    console.log(
                      `[Stripe] Proposal message ${messageId} confirmed for Lead ${leadId}`
                    );
                  } catch (e) {
                    console.error(
                      `[Stripe] Failed to update message ${messageId} metadata`,
                      e
                    );
                  }
                }
              }

              // Confirm all pending appointments for this conversation
              const { confirmAppointments } =
                await import("./appointmentService");
              try {
                if (lead.conversationId) {
                  await confirmAppointments(lead.conversationId);
                  console.log(
                    `[Stripe] Confirmed appointments for conversation ${lead.conversationId}`
                  );
                }
              } catch (e) {
                throw e;
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
              const connectAccountId =
                session.metadata.stripeConnectAccountId || null;

              await db.insert(paymentLedger).values({
                bookingId: null, // Deposit is on lead, not yet booked
                artistId: lead.artistId,
                clientId: lead.clientId || null,
                transactionType: "deposit",
                amountCents: baseAmountCents,
                platformFeeCents,
                artistFeeCents,
                stripePaymentId:
                  (session.payment_intent as string) || session.id,
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
            const platformFeeCents = parseInt(
              session.metadata.platformFeeCents || "0",
              10
            );
            const baseAmountCents = parseInt(
              session.metadata.baseAmountCents || "0",
              10
            );

            if (bookingId) {
              const now = new Date()
                .toISOString()
                .slice(0, 19)
                .replace("T", " ");
              const nowDate = new Date();
              const booking = await db.query.appointments.findFirst({
                where: eq(appointments.id, bookingId),
              });

              if (booking) {
                const newPaid =
                  (booking.totalPaidAmountCents || 0) + baseAmountCents;
                const remaining =
                  (booking.totalExpectedAmountCents || 0) - newPaid;
                const isFullyPaid = remaining <= 0;

                await db
                  .update(appointments)
                  .set({
                    balancePaymentId:
                      (session.payment_intent as string) || session.id,
                    ...settledBalance(booking, baseAmountCents),
                    updatedAt: now,
                  })
                  .where(eq(appointments.id, bookingId));

                // Auto-generate QLD procedure log on full payment
                if (isFullyPaid && booking.status === "completed") {
                  const { createProcedureLog } =
                    await import("./appointmentService");
                  try {
                    await createProcedureLog(bookingId);
                    console.log(
                      `[Stripe] Procedure log created for Booking ${bookingId}`
                    );
                  } catch (e) {
                    console.error(
                      `[Stripe] Failed to create procedure log for Booking ${bookingId}`,
                      e
                    );
                  }
                }

                // Ledger write
                const balanceArtistFeeCents = session.metadata.artistFeeCents
                  ? parseInt(session.metadata.artistFeeCents, 10)
                  : 0;
                const balanceConnectAccountId =
                  session.metadata.stripeConnectAccountId || null;

                await db.insert(paymentLedger).values({
                  bookingId,
                  artistId: booking.artistId,
                  clientId: booking.clientId,
                  transactionType: "balance",
                  amountCents: baseAmountCents,
                  platformFeeCents,
                  artistFeeCents: balanceArtistFeeCents,
                  stripePaymentId:
                    (session.payment_intent as string) || session.id,
                  stripeConnectAccountId: balanceConnectAccountId,
                  tier: (session.metadata.tier as any) || "free",
                  paymentMethod: "electronic transfer",
                });

                console.log(
                  `[Stripe] Balance paid for Booking ${bookingId}, remaining: ${remaining}`
                );
              }
            }
            break;
          }

          // ── Store Order ──────────────────────────────────────────
          if (session.metadata?.type === "store_order") {
            const orderId = parseInt(session.metadata.orderId, 10);
            const platformFeeCents = parseInt(
              session.metadata.platformFeeCents || "0",
              10
            );
            const artistFeeCents = parseInt(
              session.metadata.artistFeeCents || "0",
              10
            );
            const connectAccountId =
              session.metadata.stripeConnectAccountId || null;

            if (orderId) {
              const order = await db.query.orders.findFirst({
                where: eq(orders.id, orderId),
              });
              if (order) {
                const [locked] = await db
                  .select()
                  .from(orders)
                  .where(eq(orders.id, orderId))
                  .for("update");
                if (
                  locked.stripeCheckoutSessionId &&
                  locked.stripeCheckoutSessionId !== session.id
                )
                  throw new Error("Order checkout identity does not match.");
                if (locked.status !== "pending") break;
                const expected =
                  locked.totalAmountCents +
                  (session.metadata?.stockReserved === "1"
                    ? locked.platformFeeCents
                    : 0);
                if (session.amount_total !== expected)
                  throw new Error("Order payment amount does not match.");
                const nowStr = new Date()
                  .toISOString()
                  .slice(0, 19)
                  .replace("T", " ");
                const nowDate = new Date();

                // 1. Update Order Status, Shipping Address, and Buyer Details
                const shippingDetails =
                  session.collected_information?.shipping_details ||
                  (session as any).shipping_details;
                const customerDetails = session.customer_details;

                const buyerName =
                  shippingDetails?.name || customerDetails?.name || null;
                const buyerEmail = customerDetails?.email || null;
                const buyerPhone =
                  customerDetails?.phone || shippingDetails?.phone || null;

                let addressJson = null;
                // Aggressively capture address, preferring explicit shipping_details
                const addressToUse =
                  shippingDetails?.address || customerDetails?.address;
                if (addressToUse) {
                  addressJson = JSON.stringify({
                    name: buyerName,
                    ...addressToUse,
                  });
                }

                await db
                  .update(orders)
                  .set({
                    status: "paid",
                    shippingAddress: addressJson,
                    buyerName,
                    buyerEmail,
                    buyerPhone,
                    stripeCheckoutSessionId: session.id,
                    stripePaymentIntentId:
                      (session.payment_intent as string) || null,
                    updatedAt: nowDate,
                  })
                  .where(eq(orders.id, orderId));

                if (session.metadata?.stockReserved !== "1")
                  await changeOrderInventory(db, orderId, -1);

                // Associate conversations only with the authenticated checkout owner, never an unverified billing email.
                if (order.clientId && order.clientId !== order.artistId) {
                  const buyer = await db.query.users.findFirst({
                    where: eq(users.id, order.clientId),
                  });
                  if (buyer?.role === "client") {
                    const existing = await db.query.conversations.findFirst({
                      where: and(
                        eq(conversations.artistId, order.artistId),
                        eq(conversations.clientId, order.clientId)
                      ),
                    });
                    if (!existing)
                      await db.insert(conversations).values({
                        artistId: order.artistId,
                        clientId: order.clientId,
                      });
                  }
                }

                // 4. Write to Payment Ledger
                await db.insert(paymentLedger).values({
                  artistId: order.artistId,
                  transactionType: "store_order",
                  amountCents: order.totalAmountCents,
                  platformFeeCents,
                  artistFeeCents,
                  stripePaymentId:
                    (session.payment_intent as string) || session.id,
                  stripeConnectAccountId: connectAccountId,
                  paymentMethod: session.payment_method_types?.[0] || "card",
                });

                console.log(
                  `[Stripe] Store Order ${orderId} completed successfully`
                );
              }
            }
            break;
          }

          // ── Supplier Order (artist → supplier via DOTS) ───────────
          if (session.metadata?.type === "supplier_order") {
            const orderId = parseInt(session.metadata.orderId, 10);
            const platformFeeCents = parseInt(
              session.metadata.platformFeeCents || "0",
              10
            );

            if (orderId) {
              const { supplierOrders, suppliers, merchants } =
                await import("../../drizzle/schema");

              const order = await db.query.supplierOrders.findFirst({
                where: eq(supplierOrders.id, orderId),
                with: { items: true, supplier: true },
              });

              if (order && order.status !== "paid") {
                // 1. Update order status
                const shippingDetails =
                  session.collected_information?.shipping_details ||
                  (session as any).shipping_details;
                await db
                  .update(supplierOrders)
                  .set({
                    status: "paid",
                    stripePaymentIntentId:
                      (session.payment_intent as string) || null,
                    stripeCheckoutSessionId: session.id,
                    shippingAddress: shippingDetails
                      ? JSON.stringify(shippingDetails)
                      : null,
                    shippingName: shippingDetails?.name || null,
                  })
                  .where(eq(supplierOrders.id, orderId));

                // 2. Write to Payment Ledger
                await db.insert(paymentLedger).values({
                  artistId: order.artistId,
                  transactionType: "store_order",
                  amountCents: order.totalCents,
                  platformFeeCents,
                  artistFeeCents: 0,
                  stripePaymentId:
                    (session.payment_intent as string) || session.id,
                  paymentMethod: session.payment_method_types?.[0] || "card",
                });

                // Commit fulfilment work with the payment receipt; retry provider failures.
                if (order.supplier?.merchantId)
                  await db.insert(notificationOutbox).values({
                    eventType: "shopify_supplier_order",
                    payloadJson: JSON.stringify({ orderId }),
                  });

                console.log(
                  `[Stripe] Supplier Order ${orderId} completed successfully`
                );
              }
            }
            break;
          }

          // ── Payment Request (artist-initiated charge) ────────────
          if (session.metadata?.type === "payment_request") {
            const requestId = parseInt(session.metadata.requestId, 10);
            const appointmentId = parseInt(session.metadata.appointmentId, 10);
            const baseAmountCents = parseInt(
              session.metadata.baseAmountCents || "0",
              10
            );
            const platformFeeCents = parseInt(
              session.metadata.platformFeeCents || "0",
              10
            );
            const artistFeeCents = parseInt(
              session.metadata.artistFeeCents || "0",
              10
            );
            const connectAccountId =
              session.metadata.stripeConnectAccountId || null;

            if (requestId && appointmentId) {
              const now = new Date()
                .toISOString()
                .slice(0, 19)
                .replace("T", " ");

              // 1. Mark payment request as paid
              const { paymentRequests } = await import("../../drizzle/schema");
              await db
                .update(paymentRequests)
                .set({
                  status: "paid" as any,
                  paidAt: now,
                  stripeCheckoutSessionId: session.id,
                })
                .where(eq(paymentRequests.id, requestId));

              // 2. Update appointment balance
              const booking = await db.query.appointments.findFirst({
                where: eq(appointments.id, appointmentId),
              });

              if (booking) {
                const newPaid =
                  (booking.totalPaidAmountCents || 0) + baseAmountCents;
                const expected =
                  booking.totalExpectedAmountCents ||
                  (booking.price ? booking.price * 100 : 0);
                const remaining = Math.max(0, expected - newPaid);
                const isFullyPaid = remaining <= 0;

                await db
                  .update(appointments)
                  .set({
                    amountPaid: Math.round(newPaid / 100),
                    ...settledBalance(booking, baseAmountCents),
                    updatedAt: now,
                  })
                  .where(eq(appointments.id, appointmentId));

                // 3. Write to payment ledger
                await db.insert(paymentLedger).values({
                  bookingId: appointmentId,
                  artistId: booking.artistId,
                  clientId: booking.clientId,
                  transactionType: "balance",
                  amountCents: baseAmountCents,
                  platformFeeCents,
                  artistFeeCents,
                  stripePaymentId:
                    (session.payment_intent as string) || session.id,
                  stripeConnectAccountId: connectAccountId,
                  tier: (session.metadata.tier as any) || "free",
                  paymentMethod: "card",
                });

                await db.insert(notificationOutbox).values({
                  eventType: "push_message",
                  payloadJson: JSON.stringify({
                    targetUserId: booking.artistId,
                    title: "Payment received",
                    body: `Your client paid $${(baseAmountCents / 100).toFixed(2)}.`,
                    url: `/chat/${booking.conversationId}`,
                    data: { type: "payment_received", appointmentId },
                  }),
                });

                console.log(
                  `[Stripe] Payment request ${requestId} completed for Booking ${appointmentId}, paid: ${baseAmountCents}c`
                );
              }
            }
            break;
          }

          // ── Subscription Checkout ────────────────────────────────
          const subscriptionId = session.subscription as string;

          // Handle Studio Checkout
          const studioId =
            session.metadata?.studioId ||
            (session.subscription && typeof session.subscription !== "string"
              ? (session.subscription as any).metadata?.studioId
              : null);

          if (studioId && subscriptionId) {
            const subscription =
              await stripe.subscriptions.retrieve(subscriptionId);
            if (
              !subscription.items.data.some(
                item => item.price.id === process.env.STRIPE_STUDIO_PRICE_ID
              )
            )
              throw new Error(
                "Studio subscription price does not match configuration."
              );
            await db
              .update(studios)
              .set({
                stripeSubscriptionId: subscriptionId,
                subscriptionStatus:
                  subscription.status === "trialing"
                    ? "trialing"
                    : subscription.status === "active"
                      ? "active"
                      : "past_due",
                subscriptionTier: "studio",
              })
              .where(eq(studios.id, studioId));
            if (["active", "trialing"].includes(subscription.status)) {
              const { studioMembers } = await import("../../drizzle/schema");
              const members = await db.query.studioMembers.findMany({
                where: and(
                  eq(studioMembers.studioId, studioId),
                  eq(studioMembers.status, "active")
                ),
              });
              for (const member of members)
                await db.insert(notificationOutbox).values({
                  eventType: "studio_cancel_pro_renewal",
                  payloadJson: JSON.stringify({ userId: member.userId }),
                });
            }
            console.log(
              `[Stripe] Upgraded Studio ${studioId} to Active Subscription ${subscriptionId}`
            );
          }

          // Handle Artist Checkout
          const artistId =
            session.metadata?.artistId ||
            (session.subscription && typeof session.subscription !== "string"
              ? (session.subscription as any).metadata?.artistId
              : null) ||
            session.client_reference_id;

          if (artistId && subscriptionId && !studioId) {
            const subscription =
              await stripe.subscriptions.retrieve(subscriptionId);
            const isPro = subscription.items.data.some(
              item => item.price.id === process.env.STRIPE_PRO_PRICE_ID
            );
            await db
              .update(artistSettings)
              .set({
                stripeSubscriptionId: subscriptionId,
                subscriptionStatus:
                  subscription.status === "trialing"
                    ? "trialing"
                    : subscription.status === "active"
                      ? "active"
                      : "past_due",
                subscriptionTier:
                  isPro && ["active", "trialing"].includes(subscription.status)
                    ? "pro"
                    : "basic",
              })
              .where(eq(artistSettings.userId, artistId));

            console.log(
              `[Stripe] Upgraded Artist ${artistId} to Active Subscription ${subscriptionId}`
            );
          }
          break;
        }

        // ── PaymentIntent.succeeded — Custom checkout (Payment Elements) ────
        // Handles the same payment types as checkout.session.completed above,
        // using identical metadata keys. This replaces Embedded Checkout.
        case "payment_intent.succeeded": {
          const pi = event.data.object as Stripe.PaymentIntent;
          const piMeta = pi.metadata || {};
          // Prefer the stored provider ID, including plans issued before explicit metadata existed.
          const paidPlan = await db.query.sessionPlans.findFirst({
            where: eq(sessionPlans.stripeSessionId, pi.id),
          });
          if (paidPlan) {
            await fulfillSessionPlan(db, paidPlan.id, pi);
            break;
          }
          if (piMeta.type === "session_plan_deposit")
            throw new Error(
              "Session plan payment is not yet linked. Retry webhook."
            );

          // ── Deposit Payment ──
          if (piMeta.type === "deposit") {
            const leadId = parseInt(piMeta.leadId, 10);
            const messageId = piMeta.messageId
              ? parseInt(piMeta.messageId, 10)
              : undefined;

            if (leadId) {
              const lead = await db.query.leads.findFirst({
                where: eq(leads.id, leadId),
              });
              if (!lead) throw new Error("Deposit lead was not found.");

              const now = new Date()
                .toISOString()
                .slice(0, 19)
                .replace("T", " ");
              const nowDate = new Date();
              await db
                .update(leads)
                .set({
                  depositMethod: "stripe",
                  depositClaimedAt: now,
                  depositVerifiedAt: now,
                  stripeCheckoutSessionId: pi.id,
                  status: "deposit_verified" as any,
                  updatedAt: now,
                })
                .where(eq(leads.id, leadId));

              if (messageId) {
                const message = await db.query.messages.findFirst({
                  where: eq(messages.id, messageId),
                });
                if (message && message.metadata) {
                  try {
                    const meta =
                      typeof message.metadata === "string"
                        ? JSON.parse(message.metadata)
                        : message.metadata;
                    meta.status = "confirmed";
                    await db
                      .update(messages)
                      .set({ metadata: JSON.stringify(meta) })
                      .where(eq(messages.id, messageId));
                  } catch (e) {
                    console.error(
                      `[Stripe PI] Failed to update message ${messageId}`,
                      e
                    );
                  }
                }
              }

              // Confirm appointments
              const { confirmAppointments } =
                await import("./appointmentService");
              try {
                if (lead.conversationId) {
                  await confirmAppointments(lead.conversationId);
                }
              } catch (e) {
                throw e;
              }

              // Ledger write
              const platformFeeCents = piMeta.platformFeeCents
                ? parseInt(piMeta.platformFeeCents, 10)
                : 0;
              const artistFeeCents = piMeta.artistFeeCents
                ? parseInt(piMeta.artistFeeCents, 10)
                : 0;
              const baseAmountCents = piMeta.baseAmountCents
                ? parseInt(piMeta.baseAmountCents, 10)
                : lead.depositAmount || 0;
              const connectAccountId = piMeta.stripeConnectAccountId || null;

              await db.insert(paymentLedger).values({
                bookingId: null,
                artistId: lead.artistId,
                clientId: lead.clientId || null,
                transactionType: "deposit",
                amountCents: baseAmountCents,
                platformFeeCents,
                artistFeeCents,
                stripePaymentId: pi.id,
                stripeConnectAccountId: connectAccountId,
                tier: (piMeta.tier as any) || "free",
                paymentMethod: "card",
              });

              console.log(`[Stripe PI] Deposit verified for Lead ${leadId}`);
            }
            break;
          }

          // ── Balance Payment ──
          if (piMeta.type === "balance") {
            const bookingId = parseInt(piMeta.bookingId, 10);
            const platformFeeCents = parseInt(
              piMeta.platformFeeCents || "0",
              10
            );
            const baseAmountCents = parseInt(piMeta.baseAmountCents || "0", 10);

            if (bookingId) {
              const now = new Date()
                .toISOString()
                .slice(0, 19)
                .replace("T", " ");
              const booking = await db.query.appointments.findFirst({
                where: eq(appointments.id, bookingId),
              });

              if (booking) {
                const newPaid =
                  (booking.totalPaidAmountCents || 0) + baseAmountCents;
                const remaining =
                  (booking.totalExpectedAmountCents || 0) - newPaid;
                const isFullyPaid = remaining <= 0;

                await db
                  .update(appointments)
                  .set({
                    balancePaymentId: pi.id,
                    ...settledBalance(booking, baseAmountCents),
                    updatedAt: now,
                  })
                  .where(eq(appointments.id, bookingId));

                if (isFullyPaid && booking.status === "completed") {
                  const { createProcedureLog } =
                    await import("./appointmentService");
                  try {
                    await createProcedureLog(bookingId);
                  } catch (e) {
                    console.error(`[Stripe PI] Procedure log failed`, e);
                  }
                }

                const balanceArtistFeeCents = piMeta.artistFeeCents
                  ? parseInt(piMeta.artistFeeCents, 10)
                  : 0;
                await db.insert(paymentLedger).values({
                  bookingId,
                  artistId: booking.artistId,
                  clientId: booking.clientId,
                  transactionType: "balance",
                  amountCents: baseAmountCents,
                  platformFeeCents,
                  artistFeeCents: balanceArtistFeeCents,
                  stripePaymentId: pi.id,
                  stripeConnectAccountId: piMeta.stripeConnectAccountId || null,
                  tier: (piMeta.tier as any) || "free",
                  paymentMethod: "electronic transfer",
                });

                console.log(
                  `[Stripe PI] Balance paid for Booking ${bookingId}`
                );
              }
            }
            break;
          }

          // ── Store Order ──
          if (piMeta.type === "store_order") {
            const orderId = parseInt(piMeta.orderId, 10);
            const platformFeeCents = parseInt(
              piMeta.platformFeeCents || "0",
              10
            );
            const artistFeeCents = parseInt(piMeta.artistFeeCents || "0", 10);
            const connectAccountId = piMeta.stripeConnectAccountId || null;

            if (orderId) {
              const order = await db.query.orders.findFirst({
                where: eq(orders.id, orderId),
              });
              if (order) {
                const [locked] = await db
                  .select()
                  .from(orders)
                  .where(eq(orders.id, orderId))
                  .for("update");
                if (
                  locked.stripePaymentIntentId &&
                  locked.stripePaymentIntentId !== pi.id
                )
                  throw new Error("Order payment identity does not match.");
                if (locked.stripeCheckoutSessionId)
                  throw new Error(
                    "Checkout orders must be fulfilled by their Checkout event."
                  );
                if (locked.status !== "pending") break;
                if (pi.amount_received !== locked.totalAmountCents)
                  throw new Error("Order payment amount does not match.");
                const nowStr = new Date()
                  .toISOString()
                  .slice(0, 19)
                  .replace("T", " ");
                const nowDate = new Date();

                await db
                  .update(orders)
                  .set({
                    status: "paid",
                    stripePaymentIntentId: pi.id,
                    updatedAt: nowDate,
                  })
                  .where(eq(orders.id, orderId));

                await changeOrderInventory(db, orderId, -1);

                // Ledger write
                await db.insert(paymentLedger).values({
                  artistId: order.artistId,
                  transactionType: "store_order",
                  amountCents: order.totalAmountCents,
                  platformFeeCents,
                  artistFeeCents,
                  stripePaymentId: pi.id,
                  stripeConnectAccountId: connectAccountId,
                  paymentMethod: "card",
                });

                console.log(`[Stripe PI] Store Order ${orderId} completed`);
              }
            }
            break;
          }

          // ── Supplier Order ──
          if (piMeta.type === "supplier_order") {
            const orderId = parseInt(piMeta.orderId, 10);
            const platformFeeCents = parseInt(
              piMeta.platformFeeCents || "0",
              10
            );

            if (orderId) {
              const { supplierOrders } = await import("../../drizzle/schema");
              const order = await db.query.supplierOrders.findFirst({
                where: eq(supplierOrders.id, orderId),
                with: { items: true, supplier: true },
              });

              if (order && order.status !== "paid") {
                await db
                  .update(supplierOrders)
                  .set({
                    status: "paid",
                    stripePaymentIntentId: pi.id,
                  })
                  .where(eq(supplierOrders.id, orderId));

                await db.insert(paymentLedger).values({
                  artistId: order.artistId,
                  transactionType: "store_order",
                  amountCents: order.totalCents,
                  platformFeeCents,
                  artistFeeCents: 0,
                  stripePaymentId: pi.id,
                  paymentMethod: "card",
                });

                if (order.supplier?.merchantId)
                  await db.insert(notificationOutbox).values({
                    eventType: "shopify_supplier_order",
                    payloadJson: JSON.stringify({ orderId }),
                  });

                console.log(`[Stripe PI] Supplier Order ${orderId} completed`);
              }
            }
            break;
          }

          // ── Payment Request ──
          if (piMeta.type === "payment_request") {
            const requestId = parseInt(piMeta.requestId, 10);
            const appointmentId = parseInt(piMeta.appointmentId, 10);
            const baseAmountCents = parseInt(piMeta.baseAmountCents || "0", 10);
            const platformFeeCents = parseInt(
              piMeta.platformFeeCents || "0",
              10
            );
            const artistFeeCents = parseInt(piMeta.artistFeeCents || "0", 10);
            const connectAccountId = piMeta.stripeConnectAccountId || null;

            if (requestId && appointmentId) {
              const now = new Date()
                .toISOString()
                .slice(0, 19)
                .replace("T", " ");
              const { paymentRequests } = await import("../../drizzle/schema");
              await db
                .update(paymentRequests)
                .set({
                  status: "paid" as any,
                  paidAt: now,
                  stripeCheckoutSessionId: pi.id,
                })
                .where(eq(paymentRequests.id, requestId));

              const booking = await db.query.appointments.findFirst({
                where: eq(appointments.id, appointmentId),
              });

              if (booking) {
                const newPaid =
                  (booking.totalPaidAmountCents || 0) + baseAmountCents;
                const expected =
                  booking.totalExpectedAmountCents ||
                  (booking.price ? booking.price * 100 : 0);
                const remaining = Math.max(0, expected - newPaid);
                const isFullyPaid = remaining <= 0;

                await db
                  .update(appointments)
                  .set({
                    amountPaid: Math.round(newPaid / 100),
                    ...settledBalance(booking, baseAmountCents),
                    updatedAt: now,
                  })
                  .where(eq(appointments.id, appointmentId));

                await db.insert(paymentLedger).values({
                  bookingId: appointmentId,
                  artistId: booking.artistId,
                  clientId: booking.clientId,
                  transactionType: "balance",
                  amountCents: baseAmountCents,
                  platformFeeCents,
                  artistFeeCents,
                  stripePaymentId: pi.id,
                  stripeConnectAccountId: connectAccountId,
                  tier: (piMeta.tier as any) || "free",
                  paymentMethod: "card",
                });

                console.log(
                  `[Stripe PI] Payment request ${requestId} completed for Booking ${appointmentId}`
                );
              }
            }
            break;
          }

          console.log(
            `[Stripe PI] Unhandled payment_intent type: ${piMeta.type}`
          );
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
              .where(
                and(
                  eq(studios.id, studioId),
                  eq(studios.stripeSubscriptionId, subscription.id)
                )
              );
            console.log(
              `[Stripe] Canceled Subscription for Studio ${studioId}`
            );
          }

          if (artistId) {
            await db
              .update(artistSettings)
              .set({
                subscriptionStatus: "canceled",
                subscriptionTier: "basic", // Fallback to basic
              })
              .where(
                and(
                  eq(artistSettings.userId, artistId),
                  eq(artistSettings.stripeSubscriptionId, subscription.id)
                )
              );
            console.log(
              `[Stripe] Canceled Subscription for Artist ${artistId}`
            );
          }
          break;
        }

        case "customer.subscription.updated": {
          const subscription = await stripe.subscriptions.retrieve(
            (event.data.object as Stripe.Subscription).id
          );
          const studioId = subscription.metadata.studioId;
          const artistId = subscription.metadata.artistId;
          const status = subscription.status; // 'active', 'past_due', 'canceled', 'unpaid'

          if (studioId) {
            await db
              .update(studios)
              .set({
                subscriptionStatus:
                  status === "active" ||
                  status === "trialing" ||
                  status === "canceled"
                    ? status
                    : "past_due",
              })
              .where(
                and(
                  eq(studios.id, studioId),
                  eq(studios.stripeSubscriptionId, subscription.id)
                )
              );
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
            if (priceId === process.env.STRIPE_ELITE_PRICE_ID)
              newTier = "elite";

            await db
              .update(artistSettings)
              .set({
                subscriptionStatus:
                  status === "active" ||
                  status === "trialing" ||
                  status === "canceled"
                    ? status
                    : "past_due",
                subscriptionTier:
                  status === "active" || status === "trialing"
                    ? (newTier as any)
                    : "basic",
              })
              .where(
                and(
                  eq(artistSettings.userId, artistId),
                  eq(artistSettings.stripeSubscriptionId, subscription.id)
                )
              );
            console.log(
              `[Stripe] Updated Subscription Status to ${status} (Tier: ${newTier}) for Artist ${artistId}`
            );
          }
          break;
        }
        // ── Stripe Connect: Account Updated ─────────────────────
        case "account.updated": {
          const account = event.data.object as Stripe.Account;

          // 1. Check if it's a Merchant
          const merchant = await db.query.merchants.findFirst({
            where: eq(merchants.stripeAccountId, account.id),
          });

          if (merchant) {
            const ready =
              account.charges_enabled === true &&
              account.payouts_enabled === true;
            if (merchant.status !== "suspended") {
              await db
                .update(merchants)
                .set({ status: ready ? "active" : "pending" })
                .where(eq(merchants.id, merchant.id));
              if (ready && merchant.status !== "active") {
                const user = await db.query.users.findFirst({
                  where: eq(users.id, merchant.userId),
                });
                if (user?.email) {
                  const { notificationOutbox } =
                    await import("../../drizzle/schema");
                  await db.insert(notificationOutbox).values({
                    eventType: "email",
                    payloadJson: JSON.stringify({
                      to: user.email,
                      subject: "Your store can accept payments",
                      body: "Stripe payments and payouts are ready. Review and publish your products from your Tattoi catalogue.",
                    }),
                  });
                }
              }
            }
          } else {
            // 2. If not Merchant, assume Artist and sync
            const { syncAccountStatusToDb } = await import("./stripeConnect");
            await syncAccountStatusToDb(account.id);
          }
          break;
        }

        // ── Refund Ledger Write ─────────────────────────────────
        case "checkout.session.expired": {
          const expired = event.data.object as Stripe.Checkout.Session;
          if (
            expired.metadata?.type === "store_order" &&
            expired.metadata.stockReserved === "1"
          )
            await releaseExpiredStoreOrder(
              db,
              Number(expired.metadata.orderId),
              expired.id
            );
          break;
        }

        case "charge.refunded": {
          const charge = event.data.object as Stripe.Charge;
          const feeId =
            typeof charge.application_fee === "string"
              ? charge.application_fee
              : charge.application_fee?.id;
          const fee = feeId
            ? await stripe.applicationFees.retrieve(feeId)
            : null;
          await reconcileChargeRefund(db, charge, fee?.amount_refunded || 0);
          break;
        }

        case "application_fee.refunded": {
          const fee = event.data.object as Stripe.ApplicationFee;
          const chargeId =
            typeof fee.charge === "string" ? fee.charge : fee.charge.id;
          const charge = await stripe.charges.retrieve(chargeId);
          await reconcileChargeRefund(db, charge, fee.amount_refunded);
          break;
        }

        // ── Dispute Handling (v2.3 §6) ─────────────────────────
        case "charge.dispute.created": {
          const dispute = event.data.object as Stripe.Dispute;
          const chargeId =
            typeof dispute.charge === "string"
              ? dispute.charge
              : dispute.charge?.id;

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
          const chargeId =
            typeof dispute.charge === "string"
              ? dispute.charge
              : dispute.charge?.id;
          const won = dispute.status === "won";

          // Update ledger: release payout if won, deduct if lost
          await db.insert(paymentLedger).values({
            transactionType: "dispute",
            amountCents: won ? 0 : -dispute.amount, // Lost = deduct from artist
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
            const sendEmail = async (payload: {
              to: string;
              subject: string;
              body: string;
            }) => {
              await db.insert(notificationOutbox).values({
                eventType: "email",
                payloadJson: JSON.stringify(payload),
                status: "pending",
              });
            };
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
            const sendEmail = async (payload: {
              to: string;
              subject: string;
              body: string;
            }) => {
              await db.insert(notificationOutbox).values({
                eventType: "email",
                payloadJson: JSON.stringify(payload),
                status: "pending",
              });
            };
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
    });
    res.status(200).send("Event processed successfully");
  } catch (error) {
    console.error("[Stripe Webhook Error]", error);
    res.status(500).send("Webhook handler failed");
  }
}

// ── Supplier Order Checkout ──────────────────────────────────

/**
 * Creates a Stripe Checkout Session for an artist purchasing from a supplier.
 * Payment goes directly to DOTS platform (no Connect split).
 * Supports saved cards via stripeCustomerId.
 */
export async function createSupplierCheckoutSession(opts: {
  orderId: number;
  items: {
    productTitle: string;
    variantTitle?: string;
    priceCents: number;
    quantity: number;
  }[];
  supplierName: string;
  subtotalCents: number;
  platformFeeCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  stripeCustomerId?: string;
  artistEmail: string;
}): Promise<{ clientSecret: string | null; sessionId: string }> {
  const baseUrl = getAppUrl();
  const currencyLower = (opts.currency || "aud").toLowerCase();

  // Build line items for Stripe
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] =
    opts.items.map(item => ({
      price_data: {
        currency: currencyLower,
        product_data: {
          name: item.variantTitle
            ? `${item.productTitle} — ${item.variantTitle}`
            : item.productTitle,
          description: `From ${opts.supplierName}`,
        },
        unit_amount: item.priceCents,
      },
      quantity: item.quantity,
    }));

  // Add platform fee as a visible line item
  if (opts.platformFeeCents > 0) {
    line_items.push({
      price_data: {
        currency: currencyLower,
        product_data: {
          name: "d.o.t.s service fee",
        },
        unit_amount: opts.platformFeeCents,
      },
      quantity: 1,
    });
  }

  // Add shipping as a line item if > 0
  // (We use shipping_options for the shipping display)

  const sessionConfig: Stripe.Checkout.SessionCreateParams = {
    payment_method_types: ["card"],
    mode: "payment",
    line_items,
    metadata: {
      type: "supplier_order",
      orderId: String(opts.orderId),
      platformFeeCents: String(opts.platformFeeCents),
      supplierName: opts.supplierName,
    },
    ui_mode: "custom",
    return_url: `${baseUrl}/dashboard?supplier_order=success&order_id=${opts.orderId}&session_id={CHECKOUT_SESSION_ID}`,
    // Collect shipping address
    shipping_address_collection: {
      allowed_countries: ["AU", "NZ", "US", "GB", "CA"],
    },
  };

  // Shipping options
  if (opts.shippingCents >= 0) {
    sessionConfig.shipping_options = [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: {
            amount: opts.shippingCents,
            currency: currencyLower,
          },
          display_name:
            opts.shippingCents === 0 ? "Free Shipping" : "Standard Shipping",
        },
      },
    ];
  }

  // Attach Stripe customer for saved cards
  if (opts.stripeCustomerId) {
    sessionConfig.customer = opts.stripeCustomerId;
    sessionConfig.payment_intent_data = {
      setup_future_usage: "on_session",
    };
  } else {
    // No customer yet — collect email and create one
    sessionConfig.customer_email = opts.artistEmail;
    sessionConfig.payment_intent_data = {
      setup_future_usage: "on_session",
    };
  }

  const session = await stripe.checkout.sessions.create(sessionConfig);
  return { clientSecret: session.client_secret, sessionId: session.id };
}

/**
 * Retrieve Stripe Customer ID for an artist, creating one if needed.
 */
export async function getOrCreateStripeCustomer(
  artistId: string,
  email: string,
  name: string
): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const settings = await db.query.artistSettings.findFirst({
    where: eq(artistSettings.userId, artistId),
  });

  if (settings?.stripeCustomerId) {
    return settings.stripeCustomerId;
  }

  // Create a new Stripe customer
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      artistId,
      source: "dots_supplier_checkout",
    },
  });

  // Save to artist settings
  await db
    .update(artistSettings)
    .set({ stripeCustomerId: customer.id })
    .where(eq(artistSettings.userId, artistId));

  return customer.id;
}
