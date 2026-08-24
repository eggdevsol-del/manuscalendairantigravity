import Stripe from "stripe";
import { getDb } from "./core";
import { eq, and } from "drizzle-orm";
import { studios, artistSettings, leads, messages, paymentLedger, appointments, orders, products, orderItems, users, conversations, merchants, sessionPlans, sessionPlanItems } from "../../drizzle/schema";
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
      on_behalf_of: opts.stripeConnectAccountId,
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
    ui_mode: "embedded",
    return_url: opts.returnUrl
      ? `${opts.returnUrl}${opts.returnUrl.includes('?') ? '&' : '?'}status=success&session_id={CHECKOUT_SESSION_ID}`
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
    clientSecret: session.client_secret
  };
}

export async function createStorefrontCheckoutSession(opts: {
  orderId: number;
  items: { productId: number; productName: string; priceCents: number; quantity: number }[];
  artistName: string;
  clientTotalCents: number;
  platformFeeCents: number;
  artistFeeCents: number;
  shippingCostCents: number;
  fulfillmentMethod: "pickup" | "delivery" | "digital";
  stripeConnectAccountId?: string;
  slug: string;
}): Promise<{ url: string | null; clientSecret: string | null }> {
  const baseUrl = process.env.APP_URL || process.env.VITE_APP_URL || "https://www.tattoi.app";

  // If using connect, GST/platform fee goes to platform account
  const applicationFeeCents = opts.platformFeeCents;

  const line_items = opts.items.map(item => ({
    price_data: {
      currency: "aud",
      product_data: {
        name: `${item.productName} — ${opts.artistName}`,
      },
      unit_amount: item.priceCents,
    },
    quantity: item.quantity,
  }));

  const sessionConfig: Stripe.Checkout.SessionCreateParams = {
    payment_method_types: ["card"], // 'apple_pay' and 'google_pay' are auto-handled by Stripe in embedded mode if available
    mode: "payment",
    line_items,
    metadata: {
      type: "store_order",
      orderId: String(opts.orderId),
      platformFeeCents: String(opts.platformFeeCents),
      artistFeeCents: String(opts.artistFeeCents),
      stripeConnectAccountId: opts.stripeConnectAccountId || "",
    },
    phone_number_collection: {
      enabled: true,
    },
    ui_mode: "embedded",
    return_url: `${baseUrl}/shop/${opts.slug}?status=success&session_id={CHECKOUT_SESSION_ID}&order_id=${opts.orderId}`,
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
              currency: "aud",
            },
            display_name: opts.shippingCostCents === 0 ? "Free Shipping" : "Standard Shipping",
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

  const session = await stripe.checkout.sessions.create(sessionConfig);
  return { url: session.url, clientSecret: session.client_secret };
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
}): Promise<{ url: string | null; clientSecret: string | null; sessionId: string }> {
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
    ui_mode: "embedded",
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

  const session = await stripe.checkout.sessions.create(sessionConfig);
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
            const nowDate = new Date();
            const booking = await db.query.appointments.findFirst({
              where: eq(appointments.id, bookingId),
            });

            if (booking) {
              const newPaid = (booking.totalPaidAmountCents || 0) + baseAmountCents;
              const remaining = (booking.totalExpectedAmountCents || 0) - newPaid;
              const isFullyPaid = remaining <= 0;

              await db.update(appointments).set({
                balancePaymentId: session.payment_intent as string || session.id,
                totalPaidAmountCents: newPaid,
                remainingBalanceCents: Math.max(remaining, 0),
                paymentStatus: isFullyPaid ? "fully_paid" as any : "deposit_paid" as any,
                clientPaid: isFullyPaid ? 1 : 0,
                // Set completion time automatically when fully paid
                ...(isFullyPaid ? {
                  actualEndTime: now,
                  status: "completed" as any,
                  paymentMethod: "electronic transfer" as any,
                } : {}),
                updatedAt: now,
              }).where(eq(appointments.id, bookingId));

              // Auto-generate QLD procedure log on full payment
              if (isFullyPaid) {
                const { createProcedureLog } = await import("./appointmentService");
                try {
                  await createProcedureLog(bookingId);
                  console.log(`[Stripe] Procedure log created for Booking ${bookingId}`);
                } catch (e) {
                  console.error(`[Stripe] Failed to create procedure log for Booking ${bookingId}`, e);
                }
              }

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
                paymentMethod: "electronic transfer",
              });

              console.log(`[Stripe] Balance paid for Booking ${bookingId}, remaining: ${remaining}`);
            }
          }
          break;
        }

        // ── Store Order ──────────────────────────────────────────
        if (session.metadata?.type === "store_order") {
          const orderId = parseInt(session.metadata.orderId, 10);
          const platformFeeCents = parseInt(session.metadata.platformFeeCents || "0", 10);
          const artistFeeCents = parseInt(session.metadata.artistFeeCents || "0", 10);
          const connectAccountId = session.metadata.stripeConnectAccountId || null;

          if (orderId) {
            const order = await db.query.orders.findFirst({
              where: eq(orders.id, orderId),
            });
            if (order) {
              const nowStr = new Date().toISOString().slice(0, 19).replace("T", " ");
              const nowDate = new Date();

              // 1. Update Order Status, Shipping Address, and Buyer Details
              const shippingDetails = (session as any).shipping_details;
              const customerDetails = session.customer_details;

              const buyerName = shippingDetails?.name || customerDetails?.name || null;
              const buyerEmail = customerDetails?.email || null;
              const buyerPhone = customerDetails?.phone || shippingDetails?.phone || null;

              let addressJson = null;
              // Aggressively capture address, preferring explicit shipping_details
              const addressToUse = shippingDetails?.address || customerDetails?.address;
              if (addressToUse) {
                addressJson = JSON.stringify({
                  name: buyerName,
                  ...addressToUse
                });
              }

              await db.update(orders).set({
                status: "paid",
                shippingAddress: addressJson,
                buyerName,
                buyerEmail,
                buyerPhone,
                stripeCheckoutSessionId: session.id,
                stripePaymentIntentId: session.payment_intent as string || null,
                updatedAt: nowDate,
              }).where(eq(orders.id, orderId));

              // 2. Decrement Inventory for all order items
              const items = await db.query.orderItems.findMany({
                where: (orderItems, { eq }) => eq(orderItems.orderId, orderId),
              });

              for (const item of items) {
                if (!item.productId) continue;
                const product = await db.query.products.findFirst({
                  where: eq(products.id, item.productId),
                });
                if (product && product.inventoryCount >= item.quantity) {
                  await db.update(products).set({
                    inventoryCount: product.inventoryCount - item.quantity,
                    updatedAt: nowDate,
                  }).where(eq(products.id, product.id));
                }
              }

              // 3. Auto-link client if user exists with this email
              if (buyerEmail) {
                const existingUser = await db.query.users.findFirst({
                  where: eq(users.email, buyerEmail),
                });
                if (existingUser) {
                  // update order with clientId
                  await db.update(orders).set({ clientId: existingUser.id }).where(eq(orders.id, orderId));
                  // Check if conversation exists
                  const existingConv = await db.query.conversations.findFirst({
                    where: and(
                      eq(conversations.artistId, order.artistId),
                      eq(conversations.clientId, existingUser.id)
                    )
                  });
                  if (!existingConv) {
                    await db.insert(conversations).values({
                      artistId: order.artistId,
                      clientId: existingUser.id,
                    });
                  }
                }
              }

              // 4. Write to Payment Ledger
              await db.insert(paymentLedger).values({
                artistId: order.artistId,
                transactionType: "store_order",
                amountCents: order.totalAmountCents,
                platformFeeCents,
                artistFeeCents,
                stripePaymentId: session.payment_intent as string || session.id,
                stripeConnectAccountId: connectAccountId,
                paymentMethod: session.payment_method_types?.[0] || "card",
              });

              console.log(`[Stripe] Store Order ${orderId} completed successfully`);
            }
          }
          break;
        }

        // ── Supplier Order (artist → supplier via DOTS) ───────────
        if (session.metadata?.type === "supplier_order") {
          const orderId = parseInt(session.metadata.orderId, 10);
          const platformFeeCents = parseInt(session.metadata.platformFeeCents || "0", 10);

          if (orderId) {
            const { supplierOrders, suppliers, merchants } = await import("../../drizzle/schema");

            const order = await db.query.supplierOrders.findFirst({
              where: eq(supplierOrders.id, orderId),
              with: { items: true, supplier: true },
            });

            if (order && order.status !== "paid") {
              // 1. Update order status
              const shippingDetails = (session as any).shipping_details;
              await db.update(supplierOrders).set({
                status: "paid",
                stripePaymentIntentId: session.payment_intent as string || null,
                stripeCheckoutSessionId: session.id,
                shippingAddress: shippingDetails ? JSON.stringify(shippingDetails) : null,
                shippingName: shippingDetails?.name || null,
              }).where(eq(supplierOrders.id, orderId));

              // 2. Write to Payment Ledger
              await db.insert(paymentLedger).values({
                artistId: order.artistId,
                transactionType: "store_order" as any,
                amountCents: order.totalCents,
                platformFeeCents,
                artistFeeCents: 0,
                stripePaymentId: session.payment_intent as string || session.id,
                paymentMethod: session.payment_method_types?.[0] || "card",
              });

              // 3. Create Shopify draft order if supplier has Shopify connected
              if (order.supplier?.merchantId) {
                try {
                  const merchant = await db.query.merchants.findFirst({
                    where: eq(merchants.id, order.supplier.merchantId),
                  });

                  if (merchant?.shopifyDomain && merchant?.shopifyToken) {
                    const { createShopifyDraftOrder } = await import("./shopifyAdminApi");

                    const stripeAddr = shippingDetails?.address;
                    const shippingAddress = stripeAddr ? {
                      first_name: shippingDetails?.name?.split(" ")[0] || "",
                      last_name: shippingDetails?.name?.split(" ").slice(1).join(" ") || "",
                      address1: stripeAddr.line1 || "",
                      address2: stripeAddr.line2 || undefined,
                      city: stripeAddr.city || "",
                      province: stripeAddr.state || "",
                      zip: stripeAddr.postal_code || "",
                      country: stripeAddr.country || "",
                    } : undefined;

                    const artistUser = await db.query.users.findFirst({
                      where: eq(users.id, order.artistId),
                    });

                    const result = await createShopifyDraftOrder(
                      merchant.shopifyDomain,
                      merchant.shopifyToken,
                      {
                        lineItems: order.items
                          .filter((item: any) => item.shopifyVariantId)
                          .map((item: any) => ({
                            shopifyVariantId: item.shopifyVariantId!,
                            quantity: item.quantity,
                          })),
                        shippingAddress,
                        note: `Order via d.o.t.s — Artist: ${artistUser?.name || "Unknown"}`,
                        email: artistUser?.email || undefined,
                      }
                    );

                    if (result) {
                      await db.update(supplierOrders).set({
                        shopifyDraftOrderId: result.draftOrderId,
                        shopifyDraftOrderName: result.draftOrderName,
                      }).where(eq(supplierOrders.id, orderId));
                    }
                  }
                } catch (shopifyError: any) {
                  console.error(`[Stripe] Shopify draft order failed for supplier order ${orderId}:`, shopifyError.message);
                }
              }

              console.log(`[Stripe] Supplier Order ${orderId} completed successfully`);
            }
          }
          break;
        }

        // ── Payment Request (artist-initiated charge) ────────────
        if (session.metadata?.type === "payment_request") {
          const requestId = parseInt(session.metadata.requestId, 10);
          const appointmentId = parseInt(session.metadata.appointmentId, 10);
          const baseAmountCents = parseInt(session.metadata.baseAmountCents || "0", 10);
          const platformFeeCents = parseInt(session.metadata.platformFeeCents || "0", 10);
          const artistFeeCents = parseInt(session.metadata.artistFeeCents || "0", 10);
          const connectAccountId = session.metadata.stripeConnectAccountId || null;

          if (requestId && appointmentId) {
            const now = new Date().toISOString().slice(0, 19).replace("T", " ");

            // 1. Mark payment request as paid
            const { paymentRequests } = await import("../../drizzle/schema");
            await db.update(paymentRequests).set({
              status: "paid" as any,
              paidAt: now,
              stripeCheckoutSessionId: session.id,
            }).where(eq(paymentRequests.id, requestId));

            // 2. Update appointment balance
            const booking = await db.query.appointments.findFirst({
              where: eq(appointments.id, appointmentId),
            });

            if (booking) {
              const newPaid = (booking.totalPaidAmountCents || 0) + baseAmountCents;
              const expected = booking.totalExpectedAmountCents || (booking.price ? booking.price * 100 : 0);
              const remaining = Math.max(0, expected - newPaid);
              const isFullyPaid = remaining <= 0;

              await db.update(appointments).set({
                totalPaidAmountCents: newPaid,
                remainingBalanceCents: remaining,
                paymentStatus: isFullyPaid ? "fully_paid" as any : "deposit_paid" as any,
                clientPaid: isFullyPaid ? 1 : 0,
                amountPaid: Math.round(newPaid / 100),
                ...(isFullyPaid ? {
                  actualEndTime: now,
                  status: "completed" as any,
                  paymentMethod: "stripe" as any,
                } : {}),
                updatedAt: now,
              }).where(eq(appointments.id, appointmentId));

              // 3. Write to payment ledger
              await db.insert(paymentLedger).values({
                bookingId: appointmentId,
                artistId: booking.artistId,
                clientId: booking.clientId,
                transactionType: "balance",
                amountCents: baseAmountCents,
                platformFeeCents,
                artistFeeCents,
                stripePaymentId: session.payment_intent as string || session.id,
                stripeConnectAccountId: connectAccountId,
                tier: (session.metadata.tier as any) || "free",
                paymentMethod: "card",
              });

              // 4. Send push notification to artist
              try {
                const { sendPushNotification } = await import("./pushService");
                const client = await db.query.users.findFirst({
                  where: eq(users.id, booking.clientId),
                });
                const formatCents = (c: number) => `$${(c / 100).toLocaleString("en-AU", { minimumFractionDigits: 0 })}`;
                await sendPushNotification(booking.artistId, {
                  title: "Payment Received 💰",
                  body: `${client?.name || "Your client"} paid ${formatCents(baseAmountCents)}`,
                  data: { type: "payment_received", appointmentId },
                });
              } catch (e) {
                console.warn("[Stripe] Push to artist failed:", e);
              }

              console.log(`[Stripe] Payment request ${requestId} completed for Booking ${appointmentId}, paid: ${baseAmountCents}c`);
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

      // ── PaymentIntent.succeeded — Custom checkout (Payment Elements) ────
      // Handles the same payment types as checkout.session.completed above,
      // using identical metadata keys. This replaces Embedded Checkout.
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const piMeta = pi.metadata || {};

        // ── Deposit Payment ──
        if (piMeta.type === "deposit") {
          const leadId = parseInt(piMeta.leadId, 10);
          const messageId = piMeta.messageId ? parseInt(piMeta.messageId, 10) : undefined;

          if (leadId) {
            const lead = await db.query.leads.findFirst({
              where: eq(leads.id, leadId),
            });
            if (!lead) {
              // ── SESSION PLAN FALLBACK ──────────────────────────────
              // sessionPlans.accept() reuses the "deposit" type with plan.id as leadId.
              // If no lead exists with this ID, check if it's a session plan payment.
              const plan = await db.query.sessionPlans.findFirst({
                where: eq(sessionPlans.id, leadId),
                with: { items: true },
              });

              if (plan) {
                // ── Idempotency guard: skip if already processed ──
                if (plan.status === "accepted") {
                  console.log(`[Stripe PI] Session plan ${plan.id} already accepted — skipping (webhook retry)`);
                  break;
                }

                // Double-check: any appointments already exist for this plan?
                const existingAppts = await db.query.appointments.findMany({
                  where: eq(appointments.sessionPlanId, plan.id),
                });
                if (existingAppts.length > 0) {
                  console.log(`[Stripe PI] Session plan ${plan.id} already has ${existingAppts.length} appointments — skipping`);
                  // Still mark as accepted if somehow missed
                  await db.update(sessionPlans)
                    .set({ status: "accepted", acceptedAt: new Date().toISOString().slice(0, 19).replace("T", " "), stripeSessionId: pi.id })
                    .where(eq(sessionPlans.id, plan.id));
                  break;
                }

                console.log(`[Stripe PI] Session plan ${plan.id} deposit payment received`);
                const now = new Date().toISOString().slice(0, 19).replace("T", " ");

                // 1. Update plan status → accepted
                await db.update(sessionPlans)
                  .set({
                    status: "accepted",
                    acceptedAt: now,
                    stripeSessionId: pi.id,
                  })
                  .where(eq(sessionPlans.id, plan.id));

                // 2. Create confirmed appointments for each session item
                const planItems = plan.items || [];
                for (const item of planItems) {
                  const startDate = new Date(item.startsAt);
                  const endDate = new Date(startDate.getTime() + item.durationMinutes * 60 * 1000);
                  const startStr = startDate.toISOString().slice(0, 19).replace("T", " ");
                  const endStr = endDate.toISOString().slice(0, 19).replace("T", " ");
                  const depositCentsDollars = Math.round(item.depositCents / 100);

                  const [apptResult] = await db.insert(appointments).values({
                    conversationId: plan.conversationId,
                    artistId: plan.artistId,
                    clientId: plan.clientId,
                    title: `Session ${item.sessionIndex}`,
                    startTime: startStr,
                    endTime: endStr,
                    timeZone: "Australia/Brisbane",
                    status: "confirmed",
                    price: Math.round(item.estimateCents / 100),
                    depositAmount: depositCentsDollars,
                    depositPaid: 1,
                    confirmationSent: 0,
                    sessionIndex: item.sessionIndex,
                    sessionTotal: planItems.length,
                    sessionPlanId: plan.id,
                    depositPaymentId: pi.id,
                    totalExpectedAmountCents: item.estimateCents,
                    totalPaidAmountCents: item.depositCents,
                    remainingBalanceCents: item.estimateCents - item.depositCents,
                    paymentStatus: "deposit_paid",
                    paymentMethod: "stripe",
                    createdAt: now,
                    updatedAt: now,
                  });

                  // Link the appointment back to the session plan item
                  await db.update(sessionPlanItems)
                    .set({ appointmentId: apptResult.insertId })
                    .where(eq(sessionPlanItems.id, item.id));

                  console.log(`[Stripe PI] Created appointment ${apptResult.insertId} for session ${item.sessionIndex}`);
                }

                // 3. Update the session plan chat message metadata → confirmed
                if (plan.messageId) {
                  const msg = await db.query.messages.findFirst({
                    where: eq(messages.id, plan.messageId),
                  });
                  if (msg?.metadata) {
                    try {
                      const meta = typeof msg.metadata === "string"
                        ? JSON.parse(msg.metadata)
                        : msg.metadata;
                      meta.status = "confirmed";
                      await db.update(messages)
                        .set({ metadata: JSON.stringify(meta) })
                        .where(eq(messages.id, plan.messageId));
                      console.log(`[Stripe PI] Session plan message ${plan.messageId} confirmed`);
                    } catch (e) {
                      console.error(`[Stripe PI] Failed to update session plan message`, e);
                    }
                  }
                }

                // 4. Ledger write
                const spPlatformFee = piMeta.platformFeeCents ? parseInt(piMeta.platformFeeCents, 10) : (plan.platformFeeCents || 0);
                const spArtistFee = piMeta.artistFeeCents ? parseInt(piMeta.artistFeeCents, 10) : 0;
                const spBaseAmount = piMeta.baseAmountCents ? parseInt(piMeta.baseAmountCents, 10) : plan.depositTotalCents;
                const spConnectId = piMeta.stripeConnectAccountId || null;

                await db.insert(paymentLedger).values({
                  bookingId: null,
                  artistId: plan.artistId,
                  clientId: plan.clientId,
                  transactionType: "deposit",
                  amountCents: spBaseAmount,
                  platformFeeCents: spPlatformFee,
                  artistFeeCents: spArtistFee,
                  stripePaymentId: pi.id,
                  stripeConnectAccountId: spConnectId,
                  tier: (piMeta.tier as any) || "free",
                  paymentMethod: "card",
                });

                console.log(`[Stripe PI] Session plan ${plan.id} fully confirmed with ${planItems.length} appointments`);
              } else {
                console.warn(`[Stripe PI] No lead or session plan found for ID ${leadId}`);
              }
              break;
            }

            const now = new Date().toISOString().slice(0, 19).replace("T", " ");
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
                  const meta = typeof message.metadata === 'string'
                    ? JSON.parse(message.metadata)
                    : message.metadata;
                  meta.status = "confirmed";
                  await db.update(messages)
                    .set({ metadata: JSON.stringify(meta) })
                    .where(eq(messages.id, messageId));
                } catch (e) {
                  console.error(`[Stripe PI] Failed to update message ${messageId}`, e);
                }
              }
            }

            // Confirm appointments
            const { confirmAppointments } = await import("./appointmentService");
            try {
              if (lead.conversationId) {
                await confirmAppointments(lead.conversationId);
              }
            } catch (e) {
              console.error(`[Stripe PI] Failed to confirm appointments`, e);
            }

            // Ledger write
            const platformFeeCents = piMeta.platformFeeCents ? parseInt(piMeta.platformFeeCents, 10) : 0;
            const artistFeeCents = piMeta.artistFeeCents ? parseInt(piMeta.artistFeeCents, 10) : 0;
            const baseAmountCents = piMeta.baseAmountCents ? parseInt(piMeta.baseAmountCents, 10) : lead.depositAmount || 0;
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
          const platformFeeCents = parseInt(piMeta.platformFeeCents || "0", 10);
          const baseAmountCents = parseInt(piMeta.baseAmountCents || "0", 10);

          if (bookingId) {
            const now = new Date().toISOString().slice(0, 19).replace("T", " ");
            const booking = await db.query.appointments.findFirst({
              where: eq(appointments.id, bookingId),
            });

            if (booking) {
              const newPaid = (booking.totalPaidAmountCents || 0) + baseAmountCents;
              const remaining = (booking.totalExpectedAmountCents || 0) - newPaid;
              const isFullyPaid = remaining <= 0;

              await db.update(appointments).set({
                balancePaymentId: pi.id,
                totalPaidAmountCents: newPaid,
                remainingBalanceCents: Math.max(remaining, 0),
                paymentStatus: isFullyPaid ? "fully_paid" as any : "deposit_paid" as any,
                clientPaid: isFullyPaid ? 1 : 0,
                ...(isFullyPaid ? {
                  actualEndTime: now,
                  status: "completed" as any,
                  paymentMethod: "electronic transfer" as any,
                } : {}),
                updatedAt: now,
              }).where(eq(appointments.id, bookingId));

              if (isFullyPaid) {
                const { createProcedureLog } = await import("./appointmentService");
                try { await createProcedureLog(bookingId); } catch (e) {
                  console.error(`[Stripe PI] Procedure log failed`, e);
                }
              }

              const balanceArtistFeeCents = piMeta.artistFeeCents ? parseInt(piMeta.artistFeeCents, 10) : 0;
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

              console.log(`[Stripe PI] Balance paid for Booking ${bookingId}`);
            }
          }
          break;
        }

        // ── Store Order ──
        if (piMeta.type === "store_order") {
          const orderId = parseInt(piMeta.orderId, 10);
          const platformFeeCents = parseInt(piMeta.platformFeeCents || "0", 10);
          const artistFeeCents = parseInt(piMeta.artistFeeCents || "0", 10);
          const connectAccountId = piMeta.stripeConnectAccountId || null;

          if (orderId) {
            const order = await db.query.orders.findFirst({
              where: eq(orders.id, orderId),
            });
            if (order) {
              const nowStr = new Date().toISOString().slice(0, 19).replace("T", " ");
              const nowDate = new Date();

              await db.update(orders).set({
                status: "paid",
                stripePaymentIntentId: pi.id,
                updatedAt: nowDate,
              }).where(eq(orders.id, orderId));

              // Decrement inventory
              const items = await db.query.orderItems.findMany({
                where: (orderItems, { eq }) => eq(orderItems.orderId, orderId),
              });
              for (const item of items) {
                if (!item.productId) continue;
                const product = await db.query.products.findFirst({
                  where: eq(products.id, item.productId),
                });
                if (product && product.inventoryCount >= item.quantity) {
                  await db.update(products).set({
                    inventoryCount: product.inventoryCount - item.quantity,
                    updatedAt: nowDate,
                  }).where(eq(products.id, product.id));
                }
              }

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
          const platformFeeCents = parseInt(piMeta.platformFeeCents || "0", 10);

          if (orderId) {
            const { supplierOrders } = await import("../../drizzle/schema");
            const order = await db.query.supplierOrders.findFirst({
              where: eq(supplierOrders.id, orderId),
              with: { items: true, supplier: true },
            });

            if (order && order.status !== "paid") {
              await db.update(supplierOrders).set({
                status: "paid",
                stripePaymentIntentId: pi.id,
              }).where(eq(supplierOrders.id, orderId));

              await db.insert(paymentLedger).values({
                artistId: order.artistId,
                transactionType: "store_order" as any,
                amountCents: order.totalCents,
                platformFeeCents,
                artistFeeCents: 0,
                stripePaymentId: pi.id,
                paymentMethod: "card",
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
          const platformFeeCents = parseInt(piMeta.platformFeeCents || "0", 10);
          const artistFeeCents = parseInt(piMeta.artistFeeCents || "0", 10);
          const connectAccountId = piMeta.stripeConnectAccountId || null;

          if (requestId && appointmentId) {
            const now = new Date().toISOString().slice(0, 19).replace("T", " ");
            const { paymentRequests } = await import("../../drizzle/schema");
            await db.update(paymentRequests).set({
              status: "paid" as any,
              paidAt: now,
              stripeCheckoutSessionId: pi.id,
            }).where(eq(paymentRequests.id, requestId));

            const booking = await db.query.appointments.findFirst({
              where: eq(appointments.id, appointmentId),
            });

            if (booking) {
              const newPaid = (booking.totalPaidAmountCents || 0) + baseAmountCents;
              const expected = booking.totalExpectedAmountCents || (booking.price ? booking.price * 100 : 0);
              const remaining = Math.max(0, expected - newPaid);
              const isFullyPaid = remaining <= 0;

              await db.update(appointments).set({
                totalPaidAmountCents: newPaid,
                remainingBalanceCents: remaining,
                paymentStatus: isFullyPaid ? "fully_paid" as any : "deposit_paid" as any,
                clientPaid: isFullyPaid ? 1 : 0,
                amountPaid: Math.round(newPaid / 100),
                ...(isFullyPaid ? {
                  actualEndTime: now,
                  status: "completed" as any,
                  paymentMethod: "stripe" as any,
                } : {}),
                updatedAt: now,
              }).where(eq(appointments.id, appointmentId));

              await db.insert(paymentLedger).values({
                bookingId: appointmentId,
                artistId: booking.artistId,
                clientId: booking.clientId,
                transactionType: "balance" as any,
                amountCents: baseAmountCents,
                platformFeeCents,
                artistFeeCents,
                stripePaymentId: pi.id,
                stripeConnectAccountId: connectAccountId,
                tier: (piMeta.tier as any) || "free",
                paymentMethod: "card",
              });

              console.log(`[Stripe PI] Payment request ${requestId} completed for Booking ${appointmentId}`);
            }
          }
          break;
        }

        console.log(`[Stripe PI] Unhandled payment_intent type: ${piMeta.type}`);
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
        
        // 1. Check if it's a Merchant
        const merchant = await db.query.merchants.findFirst({
          where: eq(merchants.stripeAccountId, account.id),
        });

        if (merchant) {
          // If already active, it's idempotent, so skip
          if (merchant.status !== 'active') {
            const chargesEnabled = account.charges_enabled === true;
            const payoutsEnabled = account.payouts_enabled === true;

            if (chargesEnabled && payoutsEnabled) {
              await db.transaction(async (tx) => {
                // Activate products
                await tx.update(products)
                  .set({ isActive: 1 })
                  .where(
                    and(
                      eq(products.artistId, merchant.userId),
                      eq(products.ownerType, 'merchant')
                    )
                  );
                
                // Activate merchant
                await tx.update(merchants)
                  .set({ status: 'active' })
                  .where(eq(merchants.id, merchant.id));
                  
                // Push notification to outbox
                const user = await tx.query.users.findFirst({ where: eq(users.id, merchant.userId) });
                if (user?.email) {
                  const { notificationOutbox } = await import("../../drizzle/schema");
                  await tx.insert(notificationOutbox).values({
                    eventType: "merchant_store_live",
                    payloadJson: JSON.stringify({
                      to: user.email,
                      subject: "Your store is now live",
                      body: "Your Stripe account is fully verified. Your products are now active and you can accept payments.",
                    }),
                  });
                }
              });

              console.log(`[Stripe Webhook] Merchant ${merchant.id} verified. Products activated.`);
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

        // ── Studio Settlement Processing ──
        try {
          const { handleArtistPayoutWebhook } = await import("./studioSettlement");
          await handleArtistPayoutWebhook(event, payout, connectAccountId);
        } catch (settleErr: any) {
          console.error("[Stripe Webhook] Studio settlement error on payout.paid:", settleErr);
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

// ── Supplier Order Checkout ──────────────────────────────────

/**
 * Creates a Stripe Checkout Session for an artist purchasing from a supplier.
 * Payment goes directly to DOTS platform (no Connect split).
 * Supports saved cards via stripeCustomerId.
 */
export async function createSupplierCheckoutSession(opts: {
  orderId: number;
  items: { productTitle: string; variantTitle?: string; priceCents: number; quantity: number }[];
  supplierName: string;
  subtotalCents: number;
  platformFeeCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  stripeCustomerId?: string;
  artistEmail: string;
}): Promise<{ clientSecret: string | null }> {
  const baseUrl = getAppUrl();
  const currencyLower = (opts.currency || "aud").toLowerCase();

  // Build line items for Stripe
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = opts.items.map(item => ({
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
    ui_mode: "embedded",
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
          display_name: opts.shippingCents === 0 ? "Free Shipping" : "Standard Shipping",
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
  return { clientSecret: session.client_secret };
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
  await db.update(artistSettings)
    .set({ stripeCustomerId: customer.id })
    .where(eq(artistSettings.userId, artistId));

  return customer.id;
}
