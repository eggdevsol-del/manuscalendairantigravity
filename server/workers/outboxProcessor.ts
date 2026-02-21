
import { getDb } from "../services/core";
import { notificationOutbox } from "../../drizzle/schema";
import { eq, lt, and, or } from "drizzle-orm";
// Import the dual-blast backend services directly from the Notification Service architectures
import { sendPushNotification as sendWebPush } from "../services/pushService";
import { sendPushNotification as sendOneSignalPush } from "../_core/pushNotification";

const BATCH_SIZE = 10;
const POLL_INTERVAL = 5000;

export function startOutboxWorker() {
    console.log('[OutboxWorker] Starting...');
    setInterval(processOutbox, POLL_INTERVAL);
}

async function processOutbox() {
    const db = await getDb();
    if (!db) return;

    try {
        // Fetch pending items valid for processing
        const items = await db.select()
            .from(notificationOutbox)
            .where(
                and(
                    or(eq(notificationOutbox.status, 'pending'), eq(notificationOutbox.status, 'failed')),
                    lt(notificationOutbox.attemptCount, 3) // Max 3 attempts
                )
            )
            .limit(BATCH_SIZE);

        for (const item of items) {
            await processItem(db, item);
        }
    } catch (e) {
        console.error('[OutboxWorker] Error processing loop', e);
    }
}

async function processItem(db: any, item: typeof notificationOutbox.$inferSelect) {
    try {
        // Parse payload
        const payload = JSON.parse(item.payloadJson);

        if (item.eventType === 'push_message') {
            // Logic to send push
            // Payload should contain userId, title, content, etc.
            // We need to map `message.created` payload to push params.

            // Assuming payload resembles message object with conversation info
            // We might need to fetch the OTHER user in the conversation to send push to.
            // Or the payload already has target userId.

            // For now, let's assume payload has { targetUserId, title, body, data }
            if (payload.targetUserId && payload.body) {
                // 1. Try the primary OneSignal system (Uses external_id aliasing, high reliability on Android)
                const oneSignalSuccess = await sendOneSignalPush({
                    userIds: [payload.targetUserId],
                    title: payload.title || 'New Notification',
                    message: payload.body,
                    url: payload.url,
                    data: payload.data
                });

                let webPushSuccess = false;

                // 2. Try VAPID fallback ONLY if OneSignal fails (e.g. iOS PWA blocking external_id sync)
                if (!oneSignalSuccess) {
                    console.log(`[OutboxWorker] OneSignal delivery failed for ${payload.targetUserId}. Falling back to VAPID PushManager...`);
                    const webPushResult = await sendWebPush(payload.targetUserId, {
                        title: payload.title || 'New Notification',
                        body: payload.body,
                        url: payload.url,
                        data: payload.data
                    });
                    webPushSuccess = webPushResult.success;
                }

                // In sequential fallback architecture, if both systems fail, we consider the outbox item undelivered
                if (!webPushSuccess && !oneSignalSuccess) {
                    throw new Error("Push Delivery failed on both OneSignal and VAPID. Target user has no registered devices.");
                }
            }
        }

        // Mark as sent
        await db.update(notificationOutbox)
            .set({ status: 'sent', updatedAt: new Date() })
            .where(eq(notificationOutbox.id, item.id));

    } catch (e: any) {
        console.error(`[OutboxWorker] Failed to process item ${item.id}`, e);

        // Update retry count and status
        await db.update(notificationOutbox)
            .set({
                status: 'failed',
                attemptCount: item.attemptCount! + 1,
                lastError: e.message,
                updatedAt: new Date()
                // nextAttemptAt: future date...
            })
            .where(eq(notificationOutbox.id, item.id));
    }
}
