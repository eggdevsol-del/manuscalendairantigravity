import { z } from "zod";
import { artistProcedure, router } from "../_core/trpc";
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
