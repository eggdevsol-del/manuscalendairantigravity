/**
 * PaymentIntent Service — Direct PaymentIntent creation for custom checkout UI
 * 
 * These functions mirror the existing `create*CheckoutSession` functions in stripe.ts
 * but create PaymentIntents directly instead of Checkout Sessions.
 * 
 * Key differences from Checkout Sessions:
 * - No iframe — the frontend renders its own UI with Stripe's <PaymentElement />
 * - `stripe.confirmPayment()` returns a Promise (no redirect needed)
 * - Receipt emails are sent via `receipt_email` on the PaymentIntent
 * - Metadata is identical — the webhook handler processes both uniformly
 * 
 * @version 1.0.0
 */

import { stripe } from "./stripe";
import type Stripe from "stripe";

// ── Deposit PaymentIntent ────────────────────────────────────────────────────
export async function createDepositPaymentIntent(opts: {
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
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const applicationFeeCents = opts.platformFeeCents + opts.artistFeeCents;

  const piConfig: Stripe.PaymentIntentCreateParams = {
    amount: opts.clientTotalCents,
    currency: "aud",
    payment_method_types: ["card"],
    receipt_email: opts.clientEmail || undefined,
    description: `Booking Deposit — ${opts.artistName}`,
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
  };

  // Connect routing — route payment to artist
  if (opts.stripeConnectAccountId) {
    piConfig.application_fee_amount = applicationFeeCents;
    piConfig.on_behalf_of = opts.stripeConnectAccountId;
    piConfig.transfer_data = {
      destination: opts.stripeConnectAccountId,
    };
  }

  const pi = await stripe.paymentIntents.create(piConfig);
  return { clientSecret: pi.client_secret!, paymentIntentId: pi.id };
}

// ── Balance PaymentIntent ────────────────────────────────────────────────────
export async function createBalancePaymentIntent(opts: {
  bookingId: number;
  balanceAmountCents: number;
  platformFeeCents: number;
  artistFeeCents: number;
  clientTotalCents: number;
  clientEmail: string;
  artistName: string;
  stripeConnectAccountId?: string | null;
  tier: string;
  balanceToken?: string;
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const applicationFeeCents = opts.platformFeeCents + opts.artistFeeCents;

  const piConfig: Stripe.PaymentIntentCreateParams = {
    amount: opts.clientTotalCents,
    currency: "aud",
    payment_method_types: ["card"],
    receipt_email: opts.clientEmail || undefined,
    description: `Balance Payment — ${opts.artistName}`,
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
  };

  if (opts.stripeConnectAccountId) {
    piConfig.application_fee_amount = applicationFeeCents;
    piConfig.on_behalf_of = opts.stripeConnectAccountId;
    piConfig.transfer_data = {
      destination: opts.stripeConnectAccountId,
    };
  }

  const pi = await stripe.paymentIntents.create(piConfig);
  return { clientSecret: pi.client_secret!, paymentIntentId: pi.id };
}

// ── Storefront Order PaymentIntent ───────────────────────────────────────────
export async function createStorefrontPaymentIntent(opts: {
  orderId: number;
  items: { productName: string; priceCents: number; quantity: number }[];
  artistName: string;
  clientTotalCents: number;
  platformFeeCents: number;
  artistFeeCents: number;
  stripeConnectAccountId?: string;
  clientEmail?: string;
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const applicationFeeCents = opts.platformFeeCents;

  const itemsSummary = opts.items
    .map(i => `${i.quantity}x ${i.productName}`)
    .join(", ");

  const piConfig: Stripe.PaymentIntentCreateParams = {
    amount: opts.clientTotalCents,
    currency: "aud",
    payment_method_types: ["card"],
    receipt_email: opts.clientEmail || undefined,
    description: `Store Order — ${opts.artistName}: ${itemsSummary}`,
    metadata: {
      type: "store_order",
      orderId: String(opts.orderId),
      platformFeeCents: String(opts.platformFeeCents),
      artistFeeCents: String(opts.artistFeeCents),
      stripeConnectAccountId: opts.stripeConnectAccountId || "",
    },
  };

  if (opts.stripeConnectAccountId) {
    piConfig.application_fee_amount = applicationFeeCents;
    piConfig.on_behalf_of = opts.stripeConnectAccountId;
    piConfig.transfer_data = {
      destination: opts.stripeConnectAccountId,
    };
  }

  const pi = await stripe.paymentIntents.create(piConfig);
  return { clientSecret: pi.client_secret!, paymentIntentId: pi.id };
}

// ── Payment Request PaymentIntent ────────────────────────────────────────────
export async function createPaymentRequestPaymentIntent(opts: {
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
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const applicationFeeCents = opts.platformFeeCents + opts.artistFeeCents;

  const piConfig: Stripe.PaymentIntentCreateParams = {
    amount: opts.clientTotalCents,
    currency: "aud",
    payment_method_types: ["card"],
    receipt_email: opts.clientEmail || undefined,
    description: `Session Payment — ${opts.artistName}`,
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
  };

  if (opts.stripeConnectAccountId) {
    piConfig.application_fee_amount = applicationFeeCents;
    piConfig.on_behalf_of = opts.stripeConnectAccountId;
    piConfig.transfer_data = {
      destination: opts.stripeConnectAccountId,
    };
  }

  const pi = await stripe.paymentIntents.create(piConfig);
  return { clientSecret: pi.client_secret!, paymentIntentId: pi.id };
}

// ── Supplier Order PaymentIntent ─────────────────────────────────────────────
export async function createSupplierPaymentIntent(opts: {
  orderId: number;
  items: { productTitle: string; variantTitle?: string; priceCents: number; quantity: number }[];
  supplierName: string;
  totalCents: number;
  platformFeeCents: number;
  currency: string;
  artistEmail: string;
  stripeCustomerId?: string;
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const currencyLower = (opts.currency || "aud").toLowerCase();

  const itemsSummary = opts.items
    .map(i => `${i.quantity}x ${i.productTitle}`)
    .join(", ");

  const piConfig: Stripe.PaymentIntentCreateParams = {
    amount: opts.totalCents,
    currency: currencyLower,
    payment_method_types: ["card"],
    receipt_email: opts.artistEmail || undefined,
    description: `Supplier Order — ${opts.supplierName}: ${itemsSummary}`,
    metadata: {
      type: "supplier_order",
      orderId: String(opts.orderId),
      platformFeeCents: String(opts.platformFeeCents),
      supplierName: opts.supplierName,
    },
  };

  // Attach Stripe customer for saved cards
  if (opts.stripeCustomerId) {
    piConfig.customer = opts.stripeCustomerId;
    piConfig.setup_future_usage = "on_session";
  }

  const pi = await stripe.paymentIntents.create(piConfig);
  return { clientSecret: pi.client_secret!, paymentIntentId: pi.id };
}
