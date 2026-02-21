import { eq, and } from "drizzle-orm";
import webpush from "web-push";
import { pushSubscriptions } from "../../drizzle/schema";
import { getDb } from "./core";
import { sendPushNotification as sendOneSignalPush } from "../_core/pushNotification";

/**
 * Push Service - SSOT for Push Notification Operations
 * 
 * This service centralizes all push notification logic to ensure:
 * - Consistent subscription management
 * - Reliable notification delivery
 * - Proper error handling and logging
 * - Easy testing and maintenance
 */

export interface PushSubscriptionData {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
    userAgent?: string;
}

export interface PushNotificationPayload {
    title: string;
    body: string;
    data?: Record<string, any>;
    icon?: string;
    badge?: string;
    url?: string;
}

export interface PushResult {
    id: number;
    status: 'sent' | 'failed' | 'deleted';
    error?: string;
}

/**
 * Subscribe a user to push notifications
 */
export async function subscribeToPush(
    userId: string,
    subscriptionData: PushSubscriptionData
): Promise<{ success: boolean; subscriptionId?: number }> {
    const db = await getDb();
    if (!db) {
        console.error("[PushService] Database unavailable");
        throw new Error("Database unavailable");
    }

    try {
        // Find if this exact endpoint is already registered, regardless of the user
        const existingEndpoint = await db.query.pushSubscriptions.findFirst({
            where: eq(pushSubscriptions.endpoint, subscriptionData.endpoint)
        });

        if (existingEndpoint) {
            if (existingEndpoint.userId === userId) {
                // Update keys if changed for the SAME user
                await db.update(pushSubscriptions)
                    .set({
                        keys: JSON.stringify(subscriptionData.keys),
                        userAgent: subscriptionData.userAgent,
                    })
                    .where(eq(pushSubscriptions.id, existingEndpoint.id));

                console.log(`[PushService] Updated subscription for user ${userId}`);
                return { success: true, subscriptionId: existingEndpoint.id };
            } else {
                // The endpoint belongs to a DIFFERENT user (e.g., they logged out and logged in as someone else)
                // We MUST reassign the hardware token to the new user so the old user stops receiving pushes
                await db.update(pushSubscriptions)
                    .set({
                        userId: userId,
                        keys: JSON.stringify(subscriptionData.keys),
                        userAgent: subscriptionData.userAgent,
                    })
                    .where(eq(pushSubscriptions.id, existingEndpoint.id));

                console.log(`[PushService] Reassigned subscription from user ${existingEndpoint.userId} to ${userId}`);
                return { success: true, subscriptionId: existingEndpoint.id };
            }
        } else {
            // Create new subscription
            const result = await db.insert(pushSubscriptions).values({
                userId,
                endpoint: subscriptionData.endpoint,
                keys: JSON.stringify(subscriptionData.keys),
                userAgent: subscriptionData.userAgent,
            });

            console.log(`[PushService] Created subscription for user ${userId}`);
            return { success: true, subscriptionId: result[0].insertId };
        }
    } catch (error: any) {
        console.error(`[PushService] Subscription failed for user ${userId}:`, error);
        throw error;
    }
}

/**
 * Unsubscribe a user from push notifications
 */
export async function unsubscribeFromPush(
    userId: string,
    endpoint: string
): Promise<{ success: boolean }> {
    const db = await getDb();
    if (!db) {
        console.error("[PushService] Database unavailable");
        throw new Error("Database unavailable");
    }

    try {
        await db.delete(pushSubscriptions).where(
            and(
                eq(pushSubscriptions.userId, userId),
                eq(pushSubscriptions.endpoint, endpoint)
            )
        );

        console.log(`[PushService] Unsubscribed user ${userId} from endpoint`);
        return { success: true };
    } catch (error: any) {
        console.error(`[PushService] Unsubscribe failed for user ${userId}:`, error);
        throw error;
    }
}

/**
 * Get all active subscriptions for a user
 */
export async function getUserSubscriptions(userId: string) {
    const db = await getDb();
    if (!db) {
        console.error("[PushService] Database unavailable");
        return [];
    }

    try {
        const subs = await db.query.pushSubscriptions.findMany({
            where: eq(pushSubscriptions.userId, userId),
        });

        return subs;
    } catch (error: any) {
        console.error(`[PushService] Failed to get subscriptions for user ${userId}:`, error);
        return [];
    }
}

/**
 * Check if a user has any active push subscriptions
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
    const subs = await getUserSubscriptions(userId);
    return subs.length > 0;
}

/**
 * Send a push notification to a specific user
 */
export async function sendPushNotification(
    userId: string,
    payload: PushNotificationPayload
): Promise<{ success: boolean; results: PushResult[] }> {
    const db = await getDb();
    if (!db) {
        console.error("[PushService] Database unavailable");
        throw new Error("Database unavailable");
    }

    const subs = await getUserSubscriptions(userId);

    if (subs.length === 0) {
        console.warn(`[PushService] No subscriptions found for user ${userId}`);
        return { success: false, results: [] };
    }

    const results: PushResult[] = [];

    for (const sub of subs) {
        try {
            const keys = JSON.parse(sub.keys);
            const pushConfig = {
                endpoint: sub.endpoint,
                keys: keys,
            };

            const notificationPayload = JSON.stringify({
                title: payload.title,
                body: payload.body,
                icon: payload.icon || "/icon-192.png",
                badge: payload.badge || "/icon-192.png",
                data: {
                    url: payload.url || "/",
                    ...payload.data,
                },
            });

            await webpush.sendNotification(pushConfig, notificationPayload, {
                urgency: 'high'
            });
            results.push({ id: sub.id, status: 'sent' });
            console.log(`[PushService] Sent notification to user ${userId}, subscription ${sub.id}`);
        } catch (error: any) {
            console.error(`[PushService] Push failed for subscription ${sub.id}:`, error);

            // Handle expired/invalid subscriptions
            if (error.statusCode === 410 || error.statusCode === 404) {
                await removeExpiredSubscription(sub.id);
                results.push({ id: sub.id, status: 'deleted' });
            } else {
                results.push({ id: sub.id, status: 'failed', error: error.message });
            }
        }
    }

    return { success: true, results };
}

/**
 * Send a test push notification
 */
export async function sendTestPush(
    userId: string,
    title?: string,
    body?: string
): Promise<{ success: boolean; results: PushResult[] }> {
    // 1. Try legacy Web Push (VAPID)
    const webPushResult = await sendPushNotification(userId, {
        title: title || "Test Notification",
        body: body || "This is a test web push from CalendAIr!",
        url: "/",
    });

    // 2. Try the primary OneSignal system
    const oneSignalSuccess = await sendOneSignalPush({
        userIds: [userId],
        title: title || "Test Notification",
        message: body || "This is a test OneSignal push from CalendAIr!"
    });

    return {
        success: webPushResult.success || oneSignalSuccess,
        results: webPushResult.results
    };
}

/**
 * Broadcast a notification to multiple users
 */
export async function broadcastToUsers(
    userIds: string[],
    payload: PushNotificationPayload
): Promise<{ success: boolean; totalSent: number; totalFailed: number }> {
    let totalSent = 0;
    let totalFailed = 0;

    for (const userId of userIds) {
        try {
            const result = await sendPushNotification(userId, payload);
            const sent = result.results.filter(r => r.status === 'sent').length;
            const failed = result.results.filter(r => r.status === 'failed').length;

            totalSent += sent;
            totalFailed += failed;
        } catch (error) {
            console.error(`[PushService] Broadcast failed for user ${userId}:`, error);
            totalFailed++;
        }
    }

    console.log(`[PushService] Broadcast complete: ${totalSent} sent, ${totalFailed} failed`);
    return { success: true, totalSent, totalFailed };
}

/**
 * Remove an expired or invalid subscription
 */
export async function removeExpiredSubscription(subscriptionId: number): Promise<void> {
    const db = await getDb();
    if (!db) {
        console.error("[PushService] Database unavailable");
        return;
    }

    try {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, subscriptionId));
        console.log(`[PushService] Removed expired subscription ${subscriptionId}`);
    } catch (error: any) {
        console.error(`[PushService] Failed to remove subscription ${subscriptionId}:`, error);
    }
}

/**
 * Validate a subscription object
 */
export function validateSubscription(subscription: any): boolean {
    if (!subscription) return false;
    if (!subscription.endpoint || typeof subscription.endpoint !== 'string') return false;
    if (!subscription.keys || typeof subscription.keys !== 'object') return false;
    if (!subscription.keys.p256dh || !subscription.keys.auth) return false;
    return true;
}
