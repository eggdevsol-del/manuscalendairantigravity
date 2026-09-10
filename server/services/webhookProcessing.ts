import type Stripe from "stripe";
import { eq, sql } from "drizzle-orm";
import { stripeWebhookEvents } from "../../drizzle/schema";
import { withDatabaseTransaction } from "./core";

const paymentTypes = new Set([
  "deposit",
  "session_plan_deposit",
  "balance",
  "payment_request",
  "store_order",
  "supplier_order",
]);
/** Checkout and PaymentIntent notifications for one payment share a fulfilment key. */
export function webhookProcessingKey(event: Stripe.Event): string {
  if (event.type === "payment_intent.succeeded") {
    const payment = event.data.object as Stripe.PaymentIntent;
    if (paymentTypes.has(payment.metadata?.type))
      return `payment:${payment.id}`;
  }
  if (event.type === "checkout.session.completed") {
    const checkout = event.data.object as Stripe.Checkout.Session;
    const paymentId =
      typeof checkout.payment_intent === "string"
        ? checkout.payment_intent
        : checkout.payment_intent?.id;
    if (
      checkout.payment_status === "paid" &&
      paymentId &&
      paymentTypes.has(checkout.metadata?.type || "")
    )
      return `payment:${paymentId}`;
  }
  return `event:${event.id}`;
}

export async function processWebhookOnce(
  event: Stripe.Event,
  handle: (
    db: NonNullable<Awaited<ReturnType<typeof import("./core").getDb>>>
  ) => Promise<void>
) {
  return withDatabaseTransaction(async db => {
    // Serialise events for the same Stripe resource (including cumulative refunds).
    const feeCharge =
      event.type === "application_fee.refunded"
        ? (event.data.object as Stripe.ApplicationFee).charge
        : null;
    const resourceId = feeCharge
      ? typeof feeCharge === "string"
        ? feeCharge
        : feeCharge.id
      : (event.data.object as { id: string }).id;
    const resourceKey = `resource:${resourceId}`;
    await db
      .insert(stripeWebhookEvents)
      .values({ id: resourceKey, eventId: event.id, eventType: event.type })
      .onDuplicateKeyUpdate({ set: { id: sql`${stripeWebhookEvents.id}` } });
    await db
      .select()
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.id, resourceKey))
      .for("update");
    const id = webhookProcessingKey(event);
    await db
      .insert(stripeWebhookEvents)
      .values({ id, eventId: event.id, eventType: event.type })
      .onDuplicateKeyUpdate({ set: { id: sql`${stripeWebhookEvents.id}` } });
    const [record] = await db
      .select()
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.id, id))
      .for("update");
    if (record.processedAt) return;
    await handle(db);
    await db
      .update(stripeWebhookEvents)
      .set({
        processedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
      })
      .where(eq(stripeWebhookEvents.id, id));
  });
}
