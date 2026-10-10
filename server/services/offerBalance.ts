import { artistCanAcceptPayments } from "./artistPaymentReadiness";
import { and, eq, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type Stripe from "stripe";
import * as s from "../../drizzle/schema";
import {
  offerRulesSchema,
  offerEligibility,
  quoteOffer,
} from "../../shared/offerRules";
import { offersEnabled, requireOffersEnabled } from "./offerAvailability";
import { stripe } from "./stripe";
import { calculateTransactionFees } from "../domain/fees";
import { effectivePaymentTier } from "./paymentEntitlements";
import { withDatabaseTransaction } from "./core";
const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const iso = (v: string) => (v.includes("T") ? v : v.replace(" ", "T") + "Z");
const fail = (message: string): never => {
  throw new TRPCError({ code: "CONFLICT", message });
};
export const bookingAmounts = (b: any) => {
  const expected = b.totalExpectedAmountCents ?? (b.price || 0) * 100;
  const paid =
    b.totalPaidAmountCents ||
    (b.depositPaid ? (b.depositAmount || 0) * 100 : 0);
  return { expected, paid, remaining: Math.max(0, expected - paid) };
};
async function ownedBooking(db: any, id: number, userId: string) {
  const [b] = await db
    .select()
    .from(s.appointments)
    .where(eq(s.appointments.id, id))
    .for("update");
  if (!b || b.clientId !== userId) throw new TRPCError({ code: "FORBIDDEN" });
  if (
    ["cancelled", "no-show"].includes(b.status) ||
    b.paymentStatus === "refunded"
  )
    fail("This booking is unavailable for payment.");
  return b;
}
async function balanceQuote(
  db: any,
  b: any,
  offerId: number | null,
  requestId?: number
) {
  const original = bookingAmounts(b);
  let due = original.remaining;
  if (requestId) {
    const [request] = await db
      .select()
      .from(s.paymentRequests)
      .where(eq(s.paymentRequests.id, requestId))
      .for("update");
    if (
      !request ||
      request.appointmentId !== b.id ||
      request.clientId !== b.clientId ||
      request.status !== "pending" ||
      request.amountCents > due
    )
      fail("This payment request changed. Refresh before paying.");
    due = request.amountCents;
  }
  if (due <= 0) fail("No balance is due.");
  let discountCents = 0,
    creditCents = 0,
    offer: any = null;
  if (offerId) {
    [offer] = await db
      .select()
      .from(s.clientOffers)
      .where(eq(s.clientOffers.id, offerId))
      .for("update");
    if (
      !offer ||
      offer.clientId !== b.clientId ||
      offer.artistId !== b.artistId
    )
      throw new TRPCError({ code: "FORBIDDEN" });
    if (
      offer.transferTo ||
      offer.reservedPlanId ||
      offer.reservedBalanceId ||
      offer.purchaseRequired ||
      offer.remainingValue <= 0
    )
      fail("This offer is not available.");
    const r = offerRulesSchema.parse(JSON.parse(offer.rulesJson));
    if (r.currency !== "AUD") fail("This booking is billed in AUD.");
    const reason = offerEligibility(r, iso(offer.issuedAt), iso(b.createdAt), [
      iso(b.startTime),
    ]);
    if (reason) fail(reason);
    const priorBalance = await db
      .select()
      .from(s.offerBalanceCheckouts)
      .where(
        and(
          eq(s.offerBalanceCheckouts.bookingId, b.id),
          eq(s.offerBalanceCheckouts.status, "paid")
        )
      );
    const priorPlan = b.sessionPlanId
      ? await db.query.offerApplications.findFirst({
          where: and(
            eq(s.offerApplications.planId, b.sessionPlanId),
            eq(s.offerApplications.status, "redeemed")
          ),
        })
      : null;
    const previous = [
      ...priorBalance
        .filter((x: any) => x.offerId)
        .map((x: any) => JSON.parse(x.quoteJson)),
      ...(priorPlan ? [JSON.parse(priorPlan.quoteJson)] : []),
    ];
    if (
      previous.length &&
      (!r.allowStacking ||
        (r.kind === "discount" && previous.some(q => q.discountCents > 0)))
    )
      fail(
        "This booking already has an offer. These terms do not allow another discount or combined credit."
      );
    const q = quoteOffer(r, offer.remainingValue, [
      { id: b.id, estimateCents: due, depositCents: due },
    ]);
    discountCents = q.discountCents;
    creditCents = q.creditCents;
  }
  const cashCents = due - discountCents - creditCents;
  if (cashCents > 0 && cashCents < 100)
    fail(
      "The remaining card amount is below $1. Ask your artist to adjust the payment request."
    );
  const settings = await db.query.artistSettings.findFirst({
    where: eq(s.artistSettings.userId, b.artistId),
  });
  const tier = await effectivePaymentTier(settings);
  const fees = cashCents
    ? calculateTransactionFees(cashCents, tier)
    : {
        baseAmountCents: 0,
        platformFeeCents: 0,
        artistFeeCents: 0,
        clientTotalCents: 0,
        stripeApplicationFeeCents: 0,
        artistPayoutCents: 0,
        tier,
      };
  return {
    ...fees,
    due,
    discountCents,
    creditCents,
    cashCents,
    totalCents: fees.clientTotalCents,
    platformFeeCents: fees.platformFeeCents,
    artistFeeCents: fees.artistFeeCents,
    tier,
    destination: settings?.stripeConnectAccountId || null,
    ready: settings?.stripeConnectOnboardingComplete === 1,
    original,
    offerId: offer?.id || null,
  };
}
export async function getBalanceOffers(
  db: any,
  id: number,
  userId: string,
  selected: number | null = null,
  requestId?: number
) {
  requireOffersEnabled();
  const b = await ownedBooking(db, id, userId);
  const offers = await db
    .select()
    .from(s.clientOffers)
    .where(
      and(
        eq(s.clientOffers.clientId, userId),
        eq(s.clientOffers.artistId, b.artistId)
      )
    );
  const choices = [];
  for (const o of offers) {
    if (o.remainingValue <= 0 || o.purchaseRequired) continue;
    let reason: string | null = null;
    try {
      await balanceQuote(db, b, o.id, requestId);
    } catch (e) {
      if (!(e instanceof TRPCError)) throw e;
      reason = e.message;
    }
    choices.push({
      id: o.id,
      name: offerRulesSchema.parse(JSON.parse(o.rulesJson)).name,
      reason,
    });
  }
  const active = await db.query.offerBalanceCheckouts.findFirst({
    where: eq(s.offerBalanceCheckouts.activeKey, String(id)),
  });
  return {
    choices,
    quote: active
      ? JSON.parse(active.quoteJson)
      : await balanceQuote(db, b, selected, requestId),
    active: !!active,
  };
}
/** Retire legacy payable links before starting the canonical balance checkout. */
async function retireLegacyPayments(db: any, b: any) {
  const requests = await db
    .select()
    .from(s.paymentRequests)
    .where(
      and(
        eq(s.paymentRequests.appointmentId, b.id),
        eq(s.paymentRequests.status, "pending")
      )
    )
    .for("update");
  for (const r of requests) {
    if (!r.stripeCheckoutSessionId) continue;
    const checkout = await stripe.checkout.sessions.retrieve(
      r.stripeCheckoutSessionId
    );
    if (checkout.status === "complete")
      fail("A payment is confirming. Refresh before paying again.");
    if (checkout.status === "open")
      await stripe.checkout.sessions.expire(checkout.id);
  }
  // Search covers pre-rollout intents which were not stored on the appointment.
  for await (const p of stripe.paymentIntents.search({
    query: `metadata['bookingId']:'${b.id}'`,
    limit: 100,
  })) {
    if (p.metadata.type !== "balance") continue;
    if (p.status === "processing")
      fail("A balance payment is processing. Please wait.");
    if (p.status === "succeeded") {
      const entry = await db.query.paymentLedger.findFirst({
        where: eq(s.paymentLedger.stripePaymentId, p.id),
      });
      if (!entry) fail("A previous payment is still being confirmed.");
    } else if (p.status !== "canceled")
      await stripe.paymentIntents.cancel(p.id);
  }
}
export async function startOfferBalance(
  db: any,
  id: number,
  userId: string,
  offerId: number | null,
  requestId?: number
) {
  requireOffersEnabled();
  const b = await ownedBooking(db, id, userId);
  const active = await db.query.offerBalanceCheckouts.findFirst({
    where: eq(s.offerBalanceCheckouts.activeKey, String(id)),
  });
  if (active) {
    if (active.offerId !== offerId || active.requestId !== (requestId ?? null))
      fail(
        "A different checkout is already open. Cancel it before changing offers."
      );
    if (!active.paymentId) fail("Checkout is being prepared. Please retry.");
    const p = await stripe.paymentIntents.retrieve(active.paymentId);
    if (["processing", "succeeded"].includes(p.status))
      fail("Payment is confirming. Do not pay again.");
    if (p.status === "canceled")
      fail("Cancel this checkout before starting again.");
    return {
      ...JSON.parse(active.quoteJson),
      clientSecret: p.client_secret,
      confirmed: false,
    };
  }
  const quote = await balanceQuote(db, b, offerId, requestId);
  if (quote.cashCents && !(await artistCanAcceptPayments({ stripeConnectAccountId: quote.destination })))
    fail("Your artist needs to finish payment setup.");
  await retireLegacyPayments(db, b);
  const [created] = await db
    .insert(s.offerBalanceCheckouts)
    .values({
      bookingId: id,
      requestId: requestId || null,
      offerId,
      activeKey: String(id),
      clientId: userId,
      artistId: b.artistId,
      quoteJson: JSON.stringify(quote),
      originalJson: JSON.stringify(b),
      status: "reserved",
      createdAt: now(),
    });
  if (offerId)
    await db
      .update(s.clientOffers)
      .set({ reservedBalanceId: created.insertId })
      .where(eq(s.clientOffers.id, offerId));
  if (!quote.cashCents) {
    await settleOfferBalance(db, created.insertId, null, userId);
    return { ...quote, clientSecret: null, confirmed: true };
  }
  const user = await db.query.users.findFirst({
    where: eq(s.users.id, userId),
  });
  const payment = await stripe.paymentIntents.create(
    {
      amount: quote.totalCents,
      currency: "aud",
      payment_method_types: ["card"],
      receipt_email: user?.email || undefined,
      application_fee_amount: quote.platformFeeCents + quote.artistFeeCents,
      transfer_data: { destination: quote.destination! },
      on_behalf_of: quote.destination!,
      metadata: {
        type: "offer_balance",
        bookingId: String(id),
        offerBalanceId: String(created.insertId),
      },
    },
    { idempotencyKey: `offer-balance-${created.insertId}` }
  );
  await db
    .update(s.offerBalanceCheckouts)
    .set({ paymentId: payment.id })
    .where(eq(s.offerBalanceCheckouts.id, created.insertId));
  return { ...quote, clientSecret: payment.client_secret, confirmed: false };
}
export async function settleOfferBalance(
  db: any,
  id: number,
  payment: Stripe.PaymentIntent | null,
  zeroClient?: string
) {
  const record = await db.query.offerBalanceCheckouts.findFirst({
    where: eq(s.offerBalanceCheckouts.id, id),
  });
  if (!record) throw new Error("Unknown offer checkout.");
  const [b] = await db
    .select()
    .from(s.appointments)
    .where(eq(s.appointments.id, record.bookingId))
    .for("update");
  const [locked] = await db
    .select()
    .from(s.offerBalanceCheckouts)
    .where(eq(s.offerBalanceCheckouts.id, id))
    .for("update");
  const q = JSON.parse(locked.quoteJson);
  if (locked.status === "paid") return;
  const destination =
    typeof payment?.transfer_data?.destination === "string"
      ? payment.transfer_data.destination
      : payment?.transfer_data?.destination?.id;
  if (
    locked.status !== "reserved" ||
    !b ||
    b.status === "cancelled" ||
    (payment
      ? payment.id !== locked.paymentId ||
        payment.status !== "succeeded" ||
        payment.currency !== "aud" ||
        payment.amount_received !== q.totalCents ||
        destination !== q.destination
      : !!locked.paymentId ||
        q.cashCents !== 0 ||
        zeroClient !== locked.clientId)
  )
    throw new Error("Offer payment requires reconciliation.");
  const amounts = bookingAmounts(b);
  if (
    amounts.paid !== q.original.paid ||
    amounts.expected !== q.original.expected
  )
    throw new Error(
      "Booking changed during checkout; reconciliation required."
    );
  if (locked.offerId) {
    const [o] = await db
      .select()
      .from(s.clientOffers)
      .where(eq(s.clientOffers.id, locked.offerId))
      .for("update");
    const r = offerRulesSchema.parse(JSON.parse(o.rulesJson));
    if (
      o.reservedBalanceId !== id ||
      o.clientId !== b.clientId ||
      o.transferTo ||
      o.remainingValue < (r.kind === "voucher" ? q.creditCents : 1)
    )
      throw new Error("Offer reservation mismatch.");
    await db
      .update(s.clientOffers)
      .set({
        remainingValue:
          r.kind === "discount" ? 0 : o.remainingValue - q.creditCents,
        reservedBalanceId: null,
        interestAt: null,
      })
      .where(eq(s.clientOffers.id, o.id));
  }
  const expected = amounts.expected - q.discountCents,
    paid = amounts.paid + q.cashCents + q.creditCents,
    remaining = Math.max(0, expected - paid);
  await db
    .update(s.appointments)
    .set({
      totalExpectedAmountCents: expected,
      totalPaidAmountCents: paid,
      remainingBalanceCents: remaining,
      price: Math.round(expected / 100),
      paymentStatus: remaining === 0 ? "fully_paid" : b.paymentStatus,
      clientPaid: remaining === 0 ? 1 : b.clientPaid,
      balancePaymentId: payment?.id || b.balancePaymentId,
      updatedAt: now(),
    })
    .where(eq(s.appointments.id, b.id));
  if (payment)
    await db
      .insert(s.paymentLedger)
      .values({
        bookingId: b.id,
        artistId: b.artistId,
        clientId: b.clientId,
        transactionType: "balance",
        amountCents: q.cashCents,
        platformFeeCents: q.platformFeeCents,
        artistFeeCents: q.artistFeeCents,
        stripePaymentId: payment.id,
        stripeConnectAccountId: q.destination,
        tier: q.tier,
        paymentMethod: "card",
        metadata: JSON.stringify({
          offerBalanceId: id,
          creditCents: q.creditCents,
          discountCents: q.discountCents,
        }),
      });
  if (locked.requestId)
    await db
      .update(s.paymentRequests)
      .set({ status: "paid", paidAt: now() })
      .where(eq(s.paymentRequests.id, locked.requestId));
  await db
    .update(s.offerBalanceCheckouts)
    .set({ status: "paid", activeKey: null })
    .where(eq(s.offerBalanceCheckouts.id, id));
  if (!remaining && b.status === "completed") {
    const { createProcedureLog } = await import("./appointmentService");
    await createProcedureLog(b.id);
  }
  await db
    .insert(s.notificationOutbox)
    .values({
      eventType: "push_message",
      status: "pending",
      payloadJson: JSON.stringify({
        targetUserId: b.artistId,
        title: "Sitting payment updated",
        body: "A client has settled their payment with an offer.",
        url: `/chat/${b.conversationId}`,
      }),
    });
}
export async function cancelOfferBalance(
  db: any,
  bookingId: number,
  userId?: string
) {
  if (!offersEnabled()) return;
  const [b] = await db
    .select()
    .from(s.appointments)
    .where(eq(s.appointments.id, bookingId))
    .for("update");
  if (userId && b?.clientId !== userId && b?.artistId !== userId)
    throw new TRPCError({ code: "FORBIDDEN" });
  const r = await db.query.offerBalanceCheckouts.findFirst({
    where: eq(s.offerBalanceCheckouts.activeKey, String(bookingId)),
  });
  if (!r) return;
  if (r.paymentId) {
    const p = await stripe.paymentIntents.retrieve(r.paymentId);
    if (["processing", "succeeded"].includes(p.status))
      fail(
        "A payment is processing. Wait for confirmation before changing this sitting."
      );
    if (p.status !== "canceled") await stripe.paymentIntents.cancel(p.id);
  }
  if (r.offerId)
    await db
      .update(s.clientOffers)
      .set({ reservedBalanceId: null })
      .where(
        and(
          eq(s.clientOffers.id, r.offerId),
          eq(s.clientOffers.reservedBalanceId, r.id)
        )
      );
  await db
    .update(s.offerBalanceCheckouts)
    .set({ status: "cancelled", activeKey: null })
    .where(eq(s.offerBalanceCheckouts.id, r.id));
}
