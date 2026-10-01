import { and, eq } from "drizzle-orm";
import * as s from "../../drizzle/schema";
import { offersEnabled } from "./offerAvailability";
import { offerRulesSchema } from "../../shared/offerRules";
const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");
/** Non-cash value returns to its payer, even if they have since transferred the original voucher. */
export async function restoreCancelledOfferCredit(db: any, bookingId: number) {
  if (!offersEnabled()) return;
  const [b] = await db
    .select()
    .from(s.appointments)
    .where(eq(s.appointments.id, bookingId))
    .for("update");
  if (!b || b.status !== "cancelled") return;
  const sources: { key: string; offerId: number; amount: number }[] = [];
  if (b.sessionPlanId) {
    const application = await db.query.offerApplications.findFirst({
      where: and(
        eq(s.offerApplications.planId, b.sessionPlanId),
        eq(s.offerApplications.status, "redeemed")
      ),
    });
    if (application) {
      const item = await db.query.sessionPlanItems.findFirst({
        where: eq(s.sessionPlanItems.appointmentId, b.id),
      });
      const quote = JSON.parse(application.quoteJson);
      const amount =
        quote.items.find((x: any) => x.id === item?.id)?.creditCents || 0;
      if (amount)
        sources.push({
          key: `plan:${application.id}:${b.id}`,
          offerId: application.offerId,
          amount,
        });
    }
  }
  const balances = await db
    .select()
    .from(s.offerBalanceCheckouts)
    .where(
      and(
        eq(s.offerBalanceCheckouts.bookingId, b.id),
        eq(s.offerBalanceCheckouts.status, "paid")
      )
    );
  for (const balance of balances) {
    const q = JSON.parse(balance.quoteJson);
    if (q.creditCents && balance.offerId)
      sources.push({
        key: `balance:${balance.id}:${b.id}`,
        offerId: balance.offerId,
        amount: q.creditCents,
      });
  }
  let restored = 0;
  for (const source of sources) {
    const existing = await db.query.offerCreditRestorations.findFirst({
      where: eq(s.offerCreditRestorations.sourceKey, source.key),
    });
    if (existing) continue;
    const [original] = await db
      .select()
      .from(s.clientOffers)
      .where(eq(s.clientOffers.id, source.offerId))
      .for("update");
    if (!original)
      throw new Error(
        "Original voucher missing; cancellation needs reconciliation."
      );
    const r = offerRulesSchema.parse(JSON.parse(original.rulesJson));
    const rules = {
      ...r,
      name: `${r.name.slice(0, 60)} · restored credit`,
      funding: "gift",
      kind: "voucher",
      valueType: "fixed",
      value: source.amount,
      expiresAt: null,
      sittingFrom: null,
      sittingUntil: null,
      eligibility: "unpaid",
      allowStacking: true,
    };
    const [created] = await db
      .insert(s.clientOffers)
      .values({
        campaignId: original.campaignId,
        artistId: b.artistId,
        clientId: b.clientId,
        originalClientId: b.clientId,
        rulesJson: JSON.stringify(rules),
        remainingValue: source.amount,
        issuedAt: now(),
        issuanceKey: `restore:${source.key}`,
      });
    await db
      .insert(s.offerCreditRestorations)
      .values({
        sourceKey: source.key,
        bookingId: b.id,
        offerId: source.offerId,
        restoredOfferId: created.insertId,
        clientId: b.clientId,
        amountCents: source.amount,
        createdAt: now(),
      });
    restored += source.amount;
  }
  if (restored) {
    await db
      .update(s.appointments)
      .set({
        totalPaidAmountCents: Math.max(
          0,
          (b.totalPaidAmountCents || 0) - restored
        ),
        remainingBalanceCents: Math.max(
          0,
          (b.remainingBalanceCents || 0) + restored
        ),
      })
      .where(eq(s.appointments.id, b.id));
    await db
      .insert(s.notificationOutbox)
      .values({
        eventType: "push_message",
        status: "pending",
        payloadJson: JSON.stringify({
          targetUserId: b.clientId,
          title: "Voucher credit restored",
          body: "Credit from your cancelled sitting is available in My Tattoos. Cash refunds follow your booking terms and statutory rights.",
          url: "/bookings",
        }),
      });
  }
}
