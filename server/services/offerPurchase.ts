import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { TRPCError } from "@trpc/server";
import * as s from "../../drizzle/schema";
import { offerRulesSchema } from "../../shared/offerRules";
import { stripe } from "./stripe";
import { calculateTransactionFees } from "../domain/fees";
import { effectivePaymentTier } from "./paymentEntitlements";
const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");
export async function purchaseVoucher(db: any, id: number, userId: string) {
  const [o] = await db
    .select()
    .from(s.clientOffers)
    .where(eq(s.clientOffers.id, id))
    .for("update");
  if (!o || o.clientId !== userId) throw new TRPCError({ code: "FORBIDDEN" });
  const r = offerRulesSchema.parse(JSON.parse(o.rulesJson));
  if (
    !o.purchaseRequired ||
    r.kind !== "voucher" ||
    r.funding !== "sale" ||
    o.transferTo
  )
    throw new TRPCError({
      code: "CONFLICT",
      message: "This voucher is already purchased or unavailable.",
    });
  if (r.currency !== "AUD")
    throw new Error("This checkout currently supports AUD.");
  const settings = await db.query.artistSettings.findFirst({
    where: eq(s.artistSettings.userId, o.artistId),
  });
  if (
    !settings?.stripeConnectAccountId ||
    settings.stripeConnectOnboardingComplete !== 1
  )
    throw new Error("The artist must finish payment setup first.");
  const tier = await effectivePaymentTier(settings),
    fees = calculateTransactionFees(r.value, tier);
  if (o.purchasePaymentId) {
    const p = await stripe.paymentIntents.retrieve(o.purchasePaymentId);
    if (p.status === "processing" || p.status === "succeeded")
      throw new Error("Your purchase is confirming. Do not pay again.");
    if (p.status === "canceled")
      throw new Error(
        "This voucher checkout was cancelled. Ask for a new voucher."
      );
    return {
      clientSecret: p.client_secret!,
      fees: calculateTransactionFees(
        Number(p.metadata.baseAmountCents),
        p.metadata.tier as any
      ),
    };
  }
  const user = await db.query.users.findFirst({
    where: eq(s.users.id, userId),
  });
  const p = await stripe.paymentIntents.create(
    {
      amount: fees.clientTotalCents,
      currency: "aud",
      payment_method_types: ["card"],
      receipt_email: user?.email || undefined,
      application_fee_amount: fees.stripeApplicationFeeCents,
      transfer_data: { destination: settings.stripeConnectAccountId },
      on_behalf_of: settings.stripeConnectAccountId,
      metadata: {
        type: "gift_voucher",
        offerId: String(id),
        baseAmountCents: String(r.value),
        platformFeeCents: String(fees.platformFeeCents),
        artistFeeCents: String(fees.artistFeeCents),
        tier,
      },
    },
    { idempotencyKey: `gift-voucher-${id}` }
  );
  await db
    .update(s.clientOffers)
    .set({ purchasePaymentId: p.id })
    .where(eq(s.clientOffers.id, id));
  return { clientSecret: p.client_secret!, fees };
}
export async function fulfillVoucherPurchase(db: any, p: Stripe.PaymentIntent) {
  const [o] = await db
    .select()
    .from(s.clientOffers)
    .where(eq(s.clientOffers.id, Number(p.metadata.offerId)))
    .for("update");
  if (!o || o.purchasePaymentId !== p.id)
    throw new Error("Unknown voucher payment.");
  if (o.purchasedAt) return;
  const r = offerRulesSchema.parse(JSON.parse(o.rulesJson));
  const settings = await db.query.artistSettings.findFirst({
    where: eq(s.artistSettings.userId, o.artistId),
  });
  const destination =
    typeof p.transfer_data?.destination === "string"
      ? p.transfer_data.destination
      : p.transfer_data?.destination?.id;
  const base = Number(p.metadata.baseAmountCents),
    fee = Number(p.metadata.platformFeeCents);
  if (
    p.status !== "succeeded" ||
    p.currency !== "aud" ||
    base !== r.value ||
    p.amount_received !== base + fee ||
    destination !== settings?.stripeConnectAccountId
  )
    throw new Error("Voucher payment does not match its issued terms.");
  let expiresAt: string | null = null;
  if (r.validityYears !== null) {
    const expiry = new Date();
    expiry.setUTCFullYear(expiry.getUTCFullYear() + (r.validityYears ?? 3));
    expiresAt = expiry.toISOString();
  }
  await db
    .update(s.clientOffers)
    .set({
      purchaseRequired: 0,
      remainingValue: r.value,
      purchasedAt: now(),
      rulesJson: JSON.stringify({ ...r, expiresAt }),
    })
    .where(eq(s.clientOffers.id, o.id));
  await db
    .insert(s.paymentLedger)
    .values({
      artistId: o.artistId,
      clientId: o.clientId,
      transactionType: "voucher_sale",
      amountCents: base,
      platformFeeCents: fee,
      artistFeeCents: Number(p.metadata.artistFeeCents),
      stripePaymentId: p.id,
      stripeConnectAccountId: destination,
      tier: p.metadata.tier as any,
      paymentMethod: "card",
      metadata: JSON.stringify({ offerId: o.id }),
    });
  await db
    .insert(s.notificationOutbox)
    .values({
      eventType: "push_message",
      status: "pending",
      payloadJson: JSON.stringify({
        targetUserId: o.clientId,
        title: "Your gift voucher is ready",
        body: "Use it on an eligible booking or transfer it from My Tattoos.",
        url: "/bookings",
      }),
    });
}
