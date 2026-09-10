import { and, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  paymentLedger,
  sessionPlans,
  sessionPlanItems,
} from "../../drizzle/schema";
import { getDb } from "./core";
import { stripe } from "./stripe";

/** Preview the whole original charge, including its fee and every bundled session. */
export async function previewArtistRefund(artistId: string, ledgerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const entry = await db.query.paymentLedger.findFirst({
    where: and(
      eq(paymentLedger.id, ledgerId),
      eq(paymentLedger.artistId, artistId)
    ),
  });
  if (!entry || entry.artistId !== artistId)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Transaction not found.",
    });
  if (
    !entry.stripePaymentId ||
    !["deposit", "balance", "store_order"].includes(entry.transactionType)
  )
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This transaction cannot be refunded here.",
    });
  const payment = entry.stripePaymentId.startsWith("pi_")
    ? await stripe.paymentIntents.retrieve(entry.stripePaymentId)
    : null;
  const chargeId = payment
    ? typeof payment.latest_charge === "string"
      ? payment.latest_charge
      : payment.latest_charge?.id
    : entry.stripePaymentId.startsWith("ch_")
      ? entry.stripePaymentId
      : null;
  if (!chargeId)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This payment has no settled charge.",
    });
  const charge = await stripe.charges.retrieve(chargeId);
  const paymentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!paymentId || !charge.paid || !charge.captured || charge.disputed)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This payment needs review in Stripe before it can be refunded.",
    });
  const originals = await db.query.paymentLedger.findMany({
    where: and(
      eq(paymentLedger.stripePaymentId, paymentId),
      inArray(paymentLedger.transactionType, [
        "deposit",
        "balance",
        "store_order",
      ])
    ),
  });
  // The webhook reconciler expects one original base-amount entry per payment.
  // Refuse ambiguous historical records instead of refunding someone else's allocation.
  if (
    originals.length !== 1 ||
    originals[0].id !== entry.id ||
    entry.amountCents + entry.platformFeeCents !== charge.amount
  )
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "The payment and ledger need reconciliation before a refund. Contact support with this transaction ID.",
    });
  const plan = await db.query.sessionPlans.findFirst({
    where: eq(sessionPlans.stripeSessionId, paymentId),
  });
  const items = plan
    ? await db.query.sessionPlanItems.findMany({
        where: eq(sessionPlanItems.sessionPlanId, plan.id),
      })
    : [];
  if (
    entry.transactionType === "deposit" &&
    !entry.bookingId &&
    (!items.length ||
      items.some(item => !item.appointmentId) ||
      items.reduce((sum, item) => sum + item.depositCents, 0) !==
        entry.amountCents)
  )
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "This deposit’s appointment records need reconciliation before a refund.",
    });
  return {
    chargeId,
    paymentId,
    amountCents: charge.amount - charge.amount_refunded,
    currency: charge.currency,
    alreadyRefundedCents: charge.amount_refunded,
    sessionCount: entry.bookingId ? 1 : items.length,
    reverseTransfer: !!charge.transfer,
    refundApplicationFee: !!charge.application_fee,
  };
}

export async function requestArtistRefund(
  artistId: string,
  ledgerId: number,
  expectedAmountCents: number
) {
  const preview = await previewArtistRefund(artistId, ledgerId);
  if (preview.amountCents <= 0)
    throw new TRPCError({
      code: "CONFLICT",
      message: "This payment has already been refunded. Refresh the history.",
    });
  if (preview.amountCents !== expectedAmountCents)
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "The refundable amount changed. Review the latest amount before continuing.",
    });
  const refund = await stripe.refunds.create(
    {
      charge: preview.chargeId,
      amount: preview.amountCents,
      ...(preview.reverseTransfer ? { reverse_transfer: true } : {}),
      ...(preview.refundApplicationFee ? { refund_application_fee: true } : {}),
      metadata: { artistId, ledgerId: String(ledgerId) },
    },
    {
      idempotencyKey: `artist-refund:${preview.chargeId}:${preview.alreadyRefundedCents}`,
    }
  );
  // charge.refunded is the only writer of refund ledger and booking adjustments.
  return {
    success: refund.status === "succeeded",
    refundId: refund.id,
    status: refund.status,
    amountCents: refund.amount,
    currency: refund.currency,
  };
}
