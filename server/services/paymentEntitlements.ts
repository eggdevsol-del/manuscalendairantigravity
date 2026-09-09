import { and, eq } from "drizzle-orm";
import { studioMembers, studios } from "../../drizzle/schema";
import { getDb } from "./core";
import { type PaymentTier, resolvePaymentTier } from "../../shared/fees";
type Settings = {
  userId?: string;
  subscriptionTier?: string | null;
  subscriptionStatus?: string | null;
  stripeSubscriptionId?: string | null;
};
/** Paid studio membership supplies Pro payment benefits to every active artist. */
export async function effectivePaymentTier(
  settings: Settings | null | undefined
): Promise<PaymentTier> {
  if (settings?.userId) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable.");
    const membership = await db.query.studioMembers.findFirst({
      where: and(
        eq(studioMembers.userId, settings.userId),
        eq(studioMembers.status, "active")
      ),
    });
    if (membership) {
      const studio = await db.query.studios.findFirst({
        where: eq(studios.id, membership.studioId),
      });
      if (
        studio?.stripeSubscriptionId &&
        ["active", "trialing"].includes(studio.subscriptionStatus || "")
      )
        return "top";
    }
  }
  if (
    !settings?.stripeSubscriptionId ||
    !["active", "trialing"].includes(settings.subscriptionStatus || "")
  )
    return "free";
  return resolvePaymentTier(settings.subscriptionTier);
}
