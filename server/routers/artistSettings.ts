import { z } from "zod";
import { artistProcedure, protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const artistSettingsRouter = router({
    get: artistProcedure.query(async ({ ctx }) => {
        const settings = await db.getArtistSettings(ctx.user.id);
        // Return default settings if none exist
        return settings || {
            id: 0,
            userId: ctx.user.id,
            businessName: null,
            businessAddress: null,
            businessEmail: null,
            bsb: null,
            accountNumber: null,
            depositAmount: null,
            autoSendDepositInfo: false,
            workSchedule: JSON.stringify({}),
            services: JSON.stringify([]),
            publicSlug: null,
            funnelEnabled: false,
            licenceNumber: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }),
    // Public-safe subset for clients viewing an artist's chat
    getPublicByArtistId: protectedProcedure
        .input(z.object({ artistId: z.string() }))
        .query(async ({ input }) => {
            const settings = await db.getArtistSettings(input.artistId);
            if (!settings) return null;
            return {
                businessName: settings.businessName,
                businessAddress: settings.businessAddress,
                depositAmount: settings.depositAmount,
            };
        }),
    upsert: artistProcedure
        .input(
            z.object({
                businessName: z.string().optional(),
                businessAddress: z.string().optional(),
                businessEmail: z.string().optional(),
                bsb: z.string().optional(),
                accountNumber: z.string().optional(),
                depositAmount: z.number().optional(),
                autoSendDepositInfo: z.boolean().optional(),
                workSchedule: z.string(),
                services: z.string(),
                publicSlug: z.string().optional(),
                funnelEnabled: z.boolean().optional(),
                licenceNumber: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            return db.upsertArtistSettings({
                userId: ctx.user.id,
                ...input,
                autoSendDepositInfo: input.autoSendDepositInfo !== undefined ? (input.autoSendDepositInfo ? 1 : 0) : undefined,
                funnelEnabled: input.funnelEnabled !== undefined ? (input.funnelEnabled ? 1 : 0) : undefined,
            } as any);
        }),
});
