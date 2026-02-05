import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import webpush from "web-push";
import { z } from "zod";
import { pushSubscriptions } from "../../drizzle/schema";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../services/core";

// Initialize VAPID
const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@calendair.com';

if (publicVapidKey && privateVapidKey) {
    webpush.setVapidDetails(
        vapidSubject,
        publicVapidKey,
        privateVapidKey
    );
} else {
    console.warn("VAPID keys not found. Push notifications will fail.");
}

export const pushRouter = router({
    subscribe: protectedProcedure
        .input(z.object({
            endpoint: z.string(),
            keys: z.object({
                p256dh: z.string(),
                auth: z.string(),
            }),
            userAgent: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            // Check if subscription exists
            const existing = await db.query.pushSubscriptions.findFirst({
                where: and(
                    eq(pushSubscriptions.userId, ctx.user.id),
                    eq(pushSubscriptions.endpoint, input.endpoint)
                ),
            });

            if (existing) {
                // Update keys if changed
                await db.update(pushSubscriptions)
                    .set({ keys: JSON.stringify(input.keys), userAgent: input.userAgent })
                    .where(eq(pushSubscriptions.id, existing.id));
            } else {
                // Create new
                await db.insert(pushSubscriptions).values({
                    userId: ctx.user.id,
                    endpoint: input.endpoint,
                    keys: JSON.stringify(input.keys), // keys stored as JSON string as per schema comment
                    userAgent: input.userAgent,
                });
            }

            return { success: true };
        }),

    unsubscribe: protectedProcedure
        .input(z.object({
            endpoint: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
            await db.delete(pushSubscriptions)
                .where(
                    and(
                        eq(pushSubscriptions.userId, ctx.user.id),
                        eq(pushSubscriptions.endpoint, input.endpoint)
                    )
                );
            return { success: true };
        }),

    test: adminProcedure
        .input(z.object({
            targetUserId: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const targetId = input.targetUserId || ctx.user.id;

            const subs = await db.query.pushSubscriptions.findMany({
                where: eq(pushSubscriptions.userId, targetId),
            });

            if (subs.length === 0) {
                return { success: false, message: "No subscriptions found for user" };
            }

            const results = [];
            for (const sub of subs) {
                try {
                    const keys = JSON.parse(sub.keys);
                    const pushConfig = {
                        endpoint: sub.endpoint,
                        keys: keys,
                    };

                    const payload = JSON.stringify({
                        title: "Test Notification",
                        body: "This is a test web push from CalendAIr!",
                        data: { url: "/" },
                    });

                    await webpush.sendNotification(pushConfig, payload);
                    results.push({ id: sub.id, status: 'sent' });
                } catch (error: any) {
                    console.error("Push failed", error);
                    if (error.statusCode === 410 || error.statusCode === 404) {
                        // Expired/Invalid, delete
                        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
                        results.push({ id: sub.id, status: 'deleted (invalid)' });
                    } else {
                        results.push({ id: sub.id, status: 'failed', error: error.message });
                    }
                }
            }

            return { success: true, results };
        }),

    // Public key exposure for client
    getPublicKey: protectedProcedure.query(() => {
        return { publicKey: process.env.VAPID_PUBLIC_KEY || '' };
    })
});
