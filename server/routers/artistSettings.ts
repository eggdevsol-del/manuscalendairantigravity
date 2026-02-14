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
            })
        )
        .mutation(async ({ ctx, input }) => {
            return db.upsertArtistSettings({
                userId: ctx.user.id,
                ...input,
            });
        }),
});
