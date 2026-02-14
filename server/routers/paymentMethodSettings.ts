import { z } from "zod";
import { artistProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const paymentMethodSettingsRouter = router({
    get: artistProcedure.query(async ({ ctx }) => {
        return db.getPaymentMethodSettings(ctx.user.id);
    }),
    upsert: artistProcedure
        .input(
            z.object({
                stripeEnabled: z.boolean(),
                paypalEnabled: z.boolean(),
                bankEnabled: z.boolean(),
                cashEnabled: z.boolean(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            return db.upsertPaymentMethodSettings({
                artistId: ctx.user.id,
                stripeEnabled: input.stripeEnabled ? 1 : 0,
                paypalEnabled: input.paypalEnabled ? 1 : 0,
                bankEnabled: input.bankEnabled ? 1 : 0,
                cashEnabled: input.cashEnabled ? 1 : 0,
            });
        }),
});
