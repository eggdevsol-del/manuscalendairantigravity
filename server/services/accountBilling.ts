import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { artistSettings, studios } from "../../drizzle/schema";
import { getDb } from "./core";
import { stripe } from "./stripe";

/** Deleting a local profile must not orphan a recurring Stripe charge. */
export async function assertAccountBillingClosed(userId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [settings, ownedStudios] = await Promise.all([
    db.query.artistSettings.findFirst({
      where: eq(artistSettings.userId, userId),
    }),
    db.query.studios.findMany({ where: eq(studios.ownerId, userId) }),
  ]);
  const ids = new Set(
    [
      settings?.stripeSubscriptionId,
      ...ownedStudios.map(studio => studio.stripeSubscriptionId),
    ].filter((id): id is string => !!id)
  );
  for (const id of ids) {
    const subscription = await stripe.subscriptions.retrieve(id);
    if (!["canceled", "incomplete_expired"].includes(subscription.status)) {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "Your artist or studio subscription is still open. Cancel it in billing and wait until cancellation takes effect before deleting your account.",
      });
    }
  }
  for (const studio of ownedStudios) {
    if (!studio.stripeCheckoutSessionId) continue;
    const checkout = await stripe.checkout.sessions.retrieve(
      studio.stripeCheckoutSessionId
    );
    if (
      checkout.status === "open" ||
      (checkout.status === "complete" &&
        checkout.subscription &&
        !ids.has(
          typeof checkout.subscription === "string"
            ? checkout.subscription
            : checkout.subscription.id
        ))
    ) {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "Your studio checkout needs to finish or expire before account deletion. Return to Studio billing to check its status.",
      });
    }
  }
}
