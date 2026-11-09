import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { importInputSchema, importRowSchema } from "../../shared/importData";
import { requireArtist } from "../services/access";
import { processImport } from "../services/dataImport";
import { effectivePaymentTier } from "../services/paymentEntitlements";
import { PAYMENT_TIERS } from "../../shared/fees";
import * as db from "../db";
const counts = (rows: Awaited<ReturnType<typeof processImport>>) => ({
  success: rows.filter(r => r.status === "imported").length,
  skipped: rows.filter(r => r.status === "duplicate").length,
  failed: rows.filter(r => ["failed", "conflict", "invalid"].includes(r.status))
    .length,
  rows,
});
export const dataImportRouter = router({
  preview: protectedProcedure
    .input(importInputSchema)
    .mutation(({ ctx, input }) => {
      requireArtist(ctx.user);
      return processImport(ctx.user.id, input, false);
    }),
  commit: protectedProcedure
    .input(importInputSchema)
    .mutation(async ({ ctx, input }) => {
      requireArtist(ctx.user);
      const result = counts(await processImport(ctx.user.id, input, true));
      // Optionally make the import's deposit the standard for new bookings. Plans with a fixed
      // deposit keep theirs; the import itself still used the chosen percentage.
      let defaultDeposit: { saved: boolean; percent: number } | undefined;
      if (
        input.mode === "appointments" &&
        input.saveDefaultDeposit &&
        input.depositPercent !== undefined
      ) {
        const settings = await db.getArtistSettings(ctx.user.id);
        const tier = PAYMENT_TIERS[await effectivePaymentTier(settings)];
        if (tier.depositCustomisable && input.depositPercent >= 5) {
          await db.upsertArtistSettings({
            userId: ctx.user.id,
            depositPercentage: input.depositPercent,
          } as any);
          defaultDeposit = { saved: true, percent: input.depositPercent };
        } else
          defaultDeposit = {
            saved: false,
            percent: tier.depositCustomisable
              ? (settings?.depositPercentage ?? tier.defaultDepositPercent)
              : tier.defaultDepositPercent,
          };
      }
      return { ...result, defaultDeposit };
    }),
  // Preserve older clients while applying the same validation and transaction safeguards.
  bulkImportClients: protectedProcedure
    .input(z.object({ clients: z.array(importRowSchema).max(500) }))
    .mutation(async ({ ctx, input }) => {
      requireArtist(ctx.user);
      return counts(
        await processImport(
          ctx.user.id,
          { mode: "clients", rows: input.clients, serviceMap: {} },
          true
        )
      );
    }),
  bulkImportAppointments: protectedProcedure
    .input(
      z.object({
        appointments: z
          .array(
            z.object({
              clientName: z.string(),
              clientEmail: z.string().optional(),
              clientPhone: z.string().optional(),
              date: z.string(),
              startTime: z.string(),
              endTime: z.string().optional(),
              serviceName: z.string().optional(),
              price: z.number().optional(),
            })
          )
          .max(500),
        serviceMap: z.record(z.string(), z.string().nullish()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireArtist(ctx.user);
      return counts(
        await processImport(
          ctx.user.id,
          {
            mode: "appointments",
            rows: input.appointments.map(r =>
              importRowSchema.parse({
                name: r.clientName,
                email: r.clientEmail,
                phone: r.clientPhone,
                ...r,
              })
            ),
            serviceMap: Object.fromEntries(
              Object.entries(input.serviceMap || {}).filter(
                (entry): entry is [string, string] =>
                  typeof entry[1] === "string"
              )
            ),
          },
          true
        )
      );
    }),
});
