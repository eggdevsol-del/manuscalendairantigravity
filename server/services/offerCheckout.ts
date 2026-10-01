import { offersEnabled, requireOffersEnabled } from "./offerAvailability";
import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import * as s from "../../drizzle/schema";
import {
  offerRulesSchema,
  offerEligibility,
  quoteOffer,
} from "../../shared/offerRules";
import { calculateTransactionFees, resolvePaymentTier } from "../domain/fees";
import { effectivePaymentTier } from "./paymentEntitlements";
const iso = (v: string) => (v.includes("T") ? v : v.replace(" ", "T") + "Z");
const fail = (message: string): never => {
  throw new TRPCError({ code: "BAD_REQUEST", message });
};
export async function planOfferOptions(
  db: any,
  planId: number,
  userId: string
) {
  if (!offersEnabled())
    return { choices: [], applied: null, checkoutStarted: false };
  const plan = await db.query.sessionPlans.findFirst({
    where: eq(s.sessionPlans.id, planId),
    with: { items: true },
  });
  if (!plan || plan.clientId !== userId)
    throw new TRPCError({ code: "FORBIDDEN" });
  const applications = await db
    .select()
    .from(s.offerApplications)
    .where(
      and(
        eq(s.offerApplications.planId, planId),
        eq(s.offerApplications.status, "reserved")
      )
    );
  const offers = await db
    .select()
    .from(s.clientOffers)
    .where(
      and(
        eq(s.clientOffers.clientId, userId),
        eq(s.clientOffers.artistId, plan.artistId)
      )
    );
  const choices = [];
  for (const offer of offers) {
    const rules = offerRulesSchema.parse(JSON.parse(offer.rulesJson));
    const reserved = await db.query.offerApplications.findFirst({
      where: and(
        eq(s.offerApplications.offerId, offer.id),
        eq(s.offerApplications.status, "reserved")
      ),
    });
    const reason = offer.purchaseRequired
      ? "Purchase this gift voucher first."
      : offer.reservedBalanceId
        ? "In use in a balance checkout."
        : offer.transferTo
          ? "Transfer pending."
          : offer.remainingValue <= 0
            ? "Already used."
            : rules.currency !== "AUD"
              ? "This booking is billed in AUD."
              : offer.reservedPlanId && offer.reservedPlanId !== planId
                ? "In use in another checkout."
                : offerEligibility(
                    rules,
                    iso(offer.issuedAt),
                    iso(plan.createdAt),
                    plan.items.map((i: any) => iso(i.startsAt))
                  );
    choices.push({
      id: offer.id,
      name: rules.name,
      reason,
      kind: rules.kind,
      value: offer.remainingValue,
      valueType: rules.valueType,
    });
  }
  return {
    choices,
    checkoutStarted: !!plan.stripeSessionId,
    applied: applications[0]
      ? {
          offerId: applications[0].offerId,
          ...JSON.parse(applications[0].quoteJson),
        }
      : null,
  };
}
/** Called with a plan row lock, before a PaymentIntent exists. */
export async function setPlanOffer(
  db: any,
  planId: number,
  userId: string,
  offerId: number | null
) {
  requireOffersEnabled();
  const [plan] = await db
    .select()
    .from(s.sessionPlans)
    .where(eq(s.sessionPlans.id, planId))
    .for("update");
  if (!plan || plan.clientId !== userId)
    throw new TRPCError({ code: "FORBIDDEN" });
  if (plan.status !== "pending" || plan.stripeSessionId)
    fail(
      "This checkout has already started. Contact your artist before changing its price."
    );
  const current = await db.query.offerApplications.findFirst({
    where: and(
      eq(s.offerApplications.planId, planId),
      eq(s.offerApplications.status, "reserved")
    ),
  });
  if (current?.offerId === offerId) return { success: true };
  if (current) {
    const original = JSON.parse(current.originalJson);
    await db
      .update(s.sessionPlans)
      .set({
        totalEstimateCents: original.totalEstimateCents,
        depositTotalCents: original.depositTotalCents,
        platformFeeCents: original.platformFeeCents,
      })
      .where(eq(s.sessionPlans.id, planId));
    for (const item of original.items)
      await db
        .update(s.sessionPlanItems)
        .set({
          estimateCents: item.estimateCents,
          depositCents: item.depositCents,
        })
        .where(eq(s.sessionPlanItems.id, item.id));
    await db
      .update(s.clientOffers)
      .set({ reservedPlanId: null })
      .where(
        and(
          eq(s.clientOffers.id, current.offerId),
          eq(s.clientOffers.reservedPlanId, planId)
        )
      );
    await db
      .update(s.offerApplications)
      .set({ status: "released" })
      .where(eq(s.offerApplications.id, current.id));
  }
  if (!offerId) return { success: true };
  const [offer] = await db
    .select()
    .from(s.clientOffers)
    .where(eq(s.clientOffers.id, offerId))
    .for("update");
  if (!offer || offer.clientId !== userId || offer.artistId !== plan.artistId)
    throw new TRPCError({ code: "FORBIDDEN" });
  if (offer.reservedPlanId && offer.reservedPlanId !== planId)
    fail("In use in another checkout.");
  if (
    offer.transferTo ||
    offer.reservedBalanceId ||
    offer.purchaseRequired ||
    offer.remainingValue <= 0
  )
    fail("This offer is unavailable.");
  const original = await db.query.sessionPlans.findFirst({
    where: eq(s.sessionPlans.id, planId),
    with: { items: true },
  });
  const rules = offerRulesSchema.parse(JSON.parse(offer.rulesJson));
  if (rules.currency !== "AUD") fail("This booking is billed in AUD.");
  const reason = offerEligibility(
    rules,
    iso(offer.issuedAt),
    iso(original.createdAt),
    original.items.map((i: any) => iso(i.startsAt))
  );
  if (reason) fail(reason);
  const quote = quoteOffer(rules, offer.remainingValue, original.items);
  if (!quote.amount) fail("There is no eligible value on this booking.");
  if (quote.depositTotalCents > 0 && quote.depositTotalCents < 100)
    fail(
      "This offer leaves less than the minimum card deposit. Ask your artist to adjust the proposal before paying."
    );
  const settings = await db.query.artistSettings.findFirst({
    where: eq(s.artistSettings.userId, plan.artistId),
  });
  const fees = calculateTransactionFees(
    quote.depositTotalCents,
    resolvePaymentTier(await effectivePaymentTier(settings))
  );
  await db
    .update(s.clientOffers)
    .set({ reservedPlanId: planId })
    .where(eq(s.clientOffers.id, offerId));
  await db.insert(s.offerApplications).values({
    offerId,
    planId,
    originalJson: JSON.stringify(original),
    quoteJson: JSON.stringify(quote),
    status: "reserved",
    createdAt: new Date().toISOString().slice(0, 19).replace("T", " "),
  });
  for (const item of quote.items)
    await db
      .update(s.sessionPlanItems)
      .set({
        estimateCents: item.estimateCents,
        depositCents: item.depositCents,
      })
      .where(eq(s.sessionPlanItems.id, item.id));
  await db
    .update(s.sessionPlans)
    .set({
      totalEstimateCents: quote.totalEstimateCents,
      depositTotalCents: quote.depositTotalCents,
      platformFeeCents:
        quote.depositTotalCents === 0 ? 0 : fees.platformFeeCents,
    })
    .where(eq(s.sessionPlans.id, planId));
  return { success: true };
}
export async function consumePlanOffer(tx: any, planId: number, force = false) {
  if (!force && !offersEnabled()) return null;
  const application = await tx.query.offerApplications.findFirst({
    where: and(
      eq(s.offerApplications.planId, planId),
      eq(s.offerApplications.status, "reserved")
    ),
  });
  if (!application) {
    if (force) throw new Error("Expected offer reservation is missing.");
    return null;
  }
  const [offer] = await tx
    .select()
    .from(s.clientOffers)
    .where(eq(s.clientOffers.id, application.offerId))
    .for("update");
  const quote = JSON.parse(application.quoteJson) as ReturnType<
    typeof quoteOffer
  >;
  const rules = offerRulesSchema.parse(JSON.parse(offer.rulesJson));
  const remaining =
    rules.kind === "discount" ? 0 : offer.remainingValue - quote.amount;
  if (remaining < 0 || offer.transferTo || offer.reservedPlanId !== planId)
    throw new Error("Offer needs reconciliation.");
  await tx
    .update(s.clientOffers)
    .set({ remainingValue: remaining, reservedPlanId: null, interestAt: null })
    .where(eq(s.clientOffers.id, offer.id));
  await tx
    .update(s.offerApplications)
    .set({ status: "redeemed" })
    .where(eq(s.offerApplications.id, application.id));
  return quote;
}

export async function releasePlanOffer(db: any, planId: number) {
  if (!offersEnabled()) return;
  await db
    .update(s.clientOffers)
    .set({ reservedPlanId: null })
    .where(eq(s.clientOffers.reservedPlanId, planId));
  await db
    .update(s.offerApplications)
    .set({ status: "released" })
    .where(
      and(
        eq(s.offerApplications.planId, planId),
        eq(s.offerApplications.status, "reserved")
      )
    );
}

/** Recheck time-sensitive terms immediately before a new provider checkout starts. */
export async function validateReservedPlanOffer(db: any, planId: number) {
  if (!offersEnabled()) return;
  const application = await db.query.offerApplications.findFirst({
    where: and(
      eq(s.offerApplications.planId, planId),
      eq(s.offerApplications.status, "reserved")
    ),
  });
  if (!application) return;
  const [offer] = await db
    .select()
    .from(s.clientOffers)
    .where(eq(s.clientOffers.id, application.offerId))
    .for("update");
  if (!offer || offer.reservedPlanId !== planId || offer.transferTo)
    fail("The offer reservation changed. Refresh this booking.");
  const rules = offerRulesSchema.parse(JSON.parse(offer.rulesJson));
  if (rules.expiresAt && +new Date(rules.expiresAt) <= Date.now())
    fail("This offer expired before checkout started. Remove it to continue.");
}

/** Cancel the provider intent before making a reserved voucher available again. */
export async function cancelPlanOfferCheckout(
  db: any,
  planId: number,
  userId: string
) {
  requireOffersEnabled();
  const [plan] = await db
    .select()
    .from(s.sessionPlans)
    .where(eq(s.sessionPlans.id, planId))
    .for("update");
  if (!plan || plan.clientId !== userId)
    throw new TRPCError({ code: "FORBIDDEN" });
  if (plan.status !== "pending")
    fail("This booking is already confirmed or closed.");
  if (plan.stripeSessionId) {
    const { stripe } = await import("./stripe");
    const payment = await stripe.paymentIntents.retrieve(plan.stripeSessionId);
    if (["processing", "succeeded"].includes(payment.status))
      fail("Payment is confirming. Please wait before changing this booking.");
    if (payment.status !== "canceled")
      await stripe.paymentIntents.cancel(payment.id);
    await db
      .update(s.sessionPlans)
      .set({ stripeSessionId: null })
      .where(eq(s.sessionPlans.id, planId));
    await db
      .insert(s.offerPlanCheckoutVersions)
      .values({ planId, version: 1 })
      .onDuplicateKeyUpdate({ set: { version: sql`version + 1` } });
  }
  await setPlanOffer(db, planId, userId, null);
  return { success: true };
}
