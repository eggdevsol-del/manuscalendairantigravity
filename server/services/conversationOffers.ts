import { and, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import * as s from "../../drizzle/schema";
import { requireConversationAccess } from "./access";
import { offersEnabled, requireOffersEnabled } from "./offerAvailability";
import { offerRulesSchema } from "../../shared/offerRules";
import { cancelPlanOfferCheckout } from "./offerCheckout";
const iso = (v: string) => (v.includes("T") ? v : v.replace(" ", "T") + "Z");
export async function conversationOffers(
  db: any,
  conversationId: number,
  userId: string
) {
  const conversation = await requireConversationAccess(
    db,
    conversationId,
    userId
  );
  if (!offersEnabled()) return { offers: [] };
  const offers = await db
    .select()
    .from(s.clientOffers)
    .where(
      and(
        eq(s.clientOffers.artistId, conversation.artistId),
        eq(s.clientOffers.clientId, conversation.clientId)
      )
    );
  if (!offers.length) return { offers: [] };
  const history = await db.query.messages.findMany({
    where: eq(s.messages.conversationId, conversationId),
  });
  const applications = await db
    .select()
    .from(s.offerApplications)
    .where(
      inArray(
        s.offerApplications.offerId,
        offers.map((o: any) => o.id)
      )
    );
  const plans = await db.query.sessionPlans.findMany({
    where: eq(s.sessionPlans.conversationId, conversationId),
  });
  return {
    offers: offers
      .filter(
        (o: any) =>
          o.interestAt ||
          history.some((m: any) => {
            try {
              const meta = JSON.parse(m.metadata || "{}");
              return (
                meta.offerId === o.id && meta.type === "promotion_interest"
              );
            } catch {
              return false;
            }
          })
      )
      .map((o: any) => {
        const rules = offerRulesSchema.parse(JSON.parse(o.rulesJson));
        const redeemed = applications.find(
          (a: any) =>
            a.offerId === o.id &&
            a.status === "redeemed" &&
            (!o.interestAt || a.createdAt >= o.interestAt)
        );
        const plan = plans.find(
          (p: any) => p.id === o.reservedPlanId && p.status === "pending"
        );
        const status = redeemed
          ? "confirmed"
          : rules.expiresAt && +new Date(rules.expiresAt) <= Date.now()
            ? "expired"
            : !o.interestAt
              ? "declined"
              : o.transferTo ||
                  o.purchaseRequired ||
                  o.remainingValue <= 0 ||
                  o.reservedBalanceId
                ? "unavailable"
                : plan
                  ? "awaiting_deposit"
                  : "discussing";
        return {
          id: o.id,
          rules,
          remainingValue: o.remainingValue,
          issuedAt: iso(o.issuedAt),
          requestedAt: o.interestAt ? iso(o.interestAt) : null,
          status,
          planId: plan?.id || redeemed?.planId || null,
        };
      }),
  };
}
export async function declineConversationOffer(
  db: any,
  conversationId: number,
  offerId: number,
  userId: string
) {
  requireOffersEnabled();
  const conversation = await requireConversationAccess(
    db,
    conversationId,
    userId
  );
  await db
    .select({ id: s.conversations.id })
    .from(s.conversations)
    .where(eq(s.conversations.id, conversationId))
    .for("update");
  const offer = await db.query.clientOffers.findFirst({
    where: and(
      eq(s.clientOffers.id, offerId),
      eq(s.clientOffers.artistId, conversation.artistId),
      eq(s.clientOffers.clientId, conversation.clientId)
    ),
  });
  if (!offer) throw new TRPCError({ code: "FORBIDDEN" });
  // Lock/cancel the plan before locking its offer, matching checkout lock ordering.
  if (offer.reservedPlanId) {
    const plan = await db.query.sessionPlans.findFirst({
      where: eq(s.sessionPlans.id, offer.reservedPlanId),
    });
    if (!plan || plan.conversationId !== conversationId)
      throw new TRPCError({
        code: "CONFLICT",
        message: "Review this offer in its booking conversation.",
      });
    await cancelPlanOfferCheckout(db, offer.reservedPlanId, offer.clientId);
    await db
      .update(s.sessionPlans)
      .set({ status: "declined" })
      .where(eq(s.sessionPlans.id, offer.reservedPlanId));
  }
  const [locked] = await db
    .select()
    .from(s.clientOffers)
    .where(eq(s.clientOffers.id, offer.id))
    .for("update");
  const redeemed = await db.query.offerApplications.findFirst({
    where: and(
      eq(s.offerApplications.offerId, offer.id),
      eq(s.offerApplications.status, "redeemed")
    ),
  });
  if (
    redeemed &&
    (!locked?.interestAt || redeemed.createdAt >= locked.interestAt)
  )
    throw new TRPCError({
      code: "CONFLICT",
      message: "This offer has already confirmed a booking.",
    });
  if (!locked?.interestAt) return { success: true };
  const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
  await db
    .update(s.clientOffers)
    .set({ interestAt: null })
    .where(eq(s.clientOffers.id, offer.id));
  await db.insert(s.messages).values({
    conversationId,
    senderId: userId,
    messageType: "system",
    content: `Offer declined: ${offerRulesSchema.parse(JSON.parse(offer.rulesJson)).name}`,
    metadata: JSON.stringify({ type: "promotion_declined", offerId }),
  });
  await db
    .update(s.conversations)
    .set({ lastMessageAt: timestamp })
    .where(eq(s.conversations.id, conversationId));
  return { success: true };
}
