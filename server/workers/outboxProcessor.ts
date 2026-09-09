import {
  withDatabaseTransaction,
  withDatabaseSavepoint,
} from "../services/core";
import { notificationOutbox, appointments, users } from "../../drizzle/schema";
import { eq, lt, and, or, isNull, lte, asc } from "drizzle-orm";
import { sendPushNotification } from "../services/pushService";
import { sendEmail } from "../services/email";
import { fulfilSupplierOrder } from "../services/supplierFulfilment";
let running = false;
let timer: ReturnType<typeof setInterval> | undefined;
const mysql = (date: Date) => date.toISOString().slice(0, 19).replace("T", " ");
export function startOutboxWorker() {
  if (timer) return;
  timer = setInterval(() => void processOutbox(), 5000);
  timer.unref();
}
export async function deliverOutboxItem(
  item: typeof notificationOutbox.$inferSelect,
  db: any
) {
  const payload = JSON.parse(item.payloadJson);
  if (item.eventType === "studio_cancel_pro_renewal") {
    const { artistSettings } = await import("../../drizzle/schema");
    const settings = await db.query.artistSettings.findFirst({
      where: eq(artistSettings.userId, payload.userId),
    });
    if (!settings?.stripeSubscriptionId) return;
    const { effectivePaymentTier } =
      await import("../services/paymentEntitlements");
    if ((await effectivePaymentTier(settings)) !== "top") return;
    const { stripe } = await import("../services/stripe");
    const subscription = await stripe.subscriptions.retrieve(
      settings.stripeSubscriptionId
    );
    if (
      ["active", "trialing", "past_due"].includes(subscription.status) &&
      !subscription.cancel_at_period_end
    )
      await stripe.subscriptions.update(
        subscription.id,
        { cancel_at_period_end: true },
        { idempotencyKey: `studio-stop-pro-renewal-${item.id}` }
      );
    return;
  }
  if (item.eventType === "public_catalogue_import") {
    const { merchants } = await import("../../drizzle/schema");
    const merchant = await db.query.merchants.findFirst({
      where: eq(merchants.id, payload.merchantId),
    });
    if (!merchant) throw new Error("Merchant no longer exists.");
    const { scrapeForMerchant } = await import("../services/scraper");
    await scrapeForMerchant(merchant.id, merchant.userId, payload.storeUrl);
    return;
  }
  if (item.eventType === "shopify_catalogue_sync") {
    const { merchants } = await import("../../drizzle/schema");
    const merchant = await db.query.merchants.findFirst({
      where: eq(merchants.id, payload.merchantId),
    });
    if (!merchant?.shopifyDomain || !merchant.shopifyToken)
      throw new Error("Shopify connection is missing.");
    const { syncInventoryFromAdmin } =
      await import("../services/shopifyAdminApi");
    await syncInventoryFromAdmin(
      merchant.id,
      merchant.userId,
      merchant.shopifyDomain,
      merchant.shopifyToken
    );
    return;
  }
  if (item.eventType === "shopify_supplier_order") {
    await fulfilSupplierOrder(db, payload.orderId);
    return;
  }
  if (
    ["balance.requested", "additional.requested", "proposal.accepted"].includes(
      item.eventType
    )
  ) {
    payload.targetUserId = payload.clientId;
    payload.title =
      item.eventType === "proposal.accepted"
        ? "Booking confirmed"
        : "Payment requested";
    payload.body =
      item.eventType === "proposal.accepted"
        ? "Review your booking and required forms in Tattoi."
        : "Your artist has sent a payment request. Review the details in your conversation.";
    payload.url = `/chat/${payload.conversationId}`;
  }
  if (!payload.url && payload.data?.conversationId)
    payload.url = `/chat/${payload.data.conversationId}`;
  if (
    [
      "push_message",
      "message.created",
      "appointment.confirmed",
      "balance.requested",
      "additional.requested",
      "proposal.accepted",
    ].includes(item.eventType)
  ) {
    if (!payload.targetUserId || !payload.body)
      throw new Error("Push payload is missing its recipient or body.");
    const result = await sendPushNotification(payload.targetUserId, {
      title: payload.title || "Tattoi",
      body: payload.body,
      url: payload.url,
      data: payload.data,
    });
    if (!result.success) throw new Error("Push delivery did not succeed.");
  } else if (["email", "merchant_store_live"].includes(item.eventType)) {
    if (!payload.to || !payload.subject || !payload.body)
      throw new Error("Email payload is incomplete.");
    await sendEmail(payload, `outbox-${item.id}`);
  } else if (item.eventType === "email_confirmation") {
    if (!payload.appointmentId)
      throw new Error("Booking notification has no appointment ID.");
    const appointment = await db.query.appointments.findFirst({
      where: eq(appointments.id, payload.appointmentId),
    });
    if (!appointment || appointment.status === "cancelled")
      throw new Error("Booking is unavailable.");
    const client = await db.query.users.findFirst({
      where: eq(users.id, appointment.clientId),
    });
    if (!client?.email) throw new Error("Client has no email address.");
    await sendEmail(
      {
        to: client.email,
        subject: "Your Tattoi booking is confirmed",
        body: `Your booking is confirmed. Open Bookings in Tattoi to review the current time, payment details and required forms.`,
      },
      `outbox-${item.id}`
    );
  } else throw new Error(`Unsupported notification type: ${item.eventType}`);
}
export async function processOutbox() {
  if (running) return;
  running = true;
  try {
    for (let i = 0; i < 10; i++) {
      const found = await withDatabaseTransaction(async db => {
        const now = mysql(new Date());
        const [item] = await db
          .select()
          .from(notificationOutbox)
          .where(
            and(
              or(
                eq(notificationOutbox.status, "pending"),
                eq(notificationOutbox.status, "failed")
              ),
              lt(notificationOutbox.attemptCount, 5),
              or(
                isNull(notificationOutbox.nextAttemptAt),
                lte(notificationOutbox.nextAttemptAt, now)
              )
            )
          )
          .orderBy(asc(notificationOutbox.id))
          .limit(1)
          .for("update", { skipLocked: true });
        if (!item) return false;
        try {
          await withDatabaseSavepoint(inner => deliverOutboxItem(item, inner));
          await db
            .update(notificationOutbox)
            .set({ status: "sent", lastError: null, updatedAt: now })
            .where(eq(notificationOutbox.id, item.id));
        } catch (error) {
          const attempts = (item.attemptCount || 0) + 1;
          await db
            .update(notificationOutbox)
            .set({
              status: "failed",
              attemptCount: attempts,
              lastError:
                error instanceof Error
                  ? error.message.slice(0, 1000)
                  : "Delivery failed",
              updatedAt: now,
              nextAttemptAt: mysql(
                new Date(Date.now() + Math.min(3600, 30 * 2 ** attempts) * 1000)
              ),
            })
            .where(eq(notificationOutbox.id, item.id));
        }
        return true;
      });
      if (!found) break;
    }
  } catch {
    console.error("[Outbox] Processing failed; queued items remain retryable.");
  } finally {
    running = false;
  }
}
