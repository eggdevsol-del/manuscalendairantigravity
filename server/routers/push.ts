import { TRPCError } from "@trpc/server";
import webpush from "web-push";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as pushService from "../services/pushService";

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

/**
 * Push Router - Translation layer between TRPC and Push Service
 * 
 * This router is intentionally thin, delegating all business logic
 * to the pushService SSOT.
 */
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
            try {
                return await pushService.subscribeToPush(ctx.user.id, {
                    endpoint: input.endpoint,
                    keys: input.keys,
                    userAgent: input.userAgent,
                });
            } catch (error: any) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: error.message || "Failed to subscribe to push notifications"
                });
            }
        }),

    unsubscribe: protectedProcedure
        .input(z.object({
            endpoint: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
            try {
                return await pushService.unsubscribeFromPush(ctx.user.id, input.endpoint);
            } catch (error: any) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: error.message || "Failed to unsubscribe from push notifications"
                });
            }
        }),

    test: protectedProcedure
        .input(z.object({
            targetUserId: z.string().optional(),
            title: z.string().optional(),
            body: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            try {
                // Allow admin and artist to target other users
                const targetId = ((ctx.user.role === 'admin' || ctx.user.role === 'artist') && input.targetUserId)
                    ? input.targetUserId
                    : ctx.user.id;

                const result = await pushService.sendTestPush(targetId, input.title, input.body);

                if (!result.success || result.results.length === 0) {
                    return { success: false, message: "No subscriptions found for user" };
                }

                return { success: true, results: result.results };
            } catch (error: any) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: error.message || "Failed to send test push"
                });
            }
        }),

    // Public key exposure for client
    getPublicKey: protectedProcedure.query(() => {
        return { publicKey: process.env.VAPID_PUBLIC_KEY || '' };
    })
});
