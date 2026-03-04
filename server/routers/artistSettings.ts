import { z } from "zod";
import { artistProcedure, protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { parseExternalCalendar } from "../services/icalParser";

export const artistSettingsRouter = router({
  get: artistProcedure.query(async ({ ctx }) => {
    const settings = await db.getArtistSettings(ctx.user.id);
    // Return default settings if none exist
    return (
      settings || {
        id: 0,
        userId: ctx.user.id,
        businessName: null,
        displayName: null,
        businessAddress: null,
        businessEmail: null,
        bsb: null,
        accountNumber: null,
        businessCountry: "AU", // Safe fallback
        depositAmount: null,
        autoSendDepositInfo: false,
        sendAutomatedReminders: true,
        workSchedule: JSON.stringify({}),
        services: JSON.stringify([]),
        publicSlug: null,
        funnelEnabled: false,
        funnelWelcomeMessage: null,
        styleOptions: null,
        placementOptions: null,
        budgetRanges: null,
        licenceNumber: null,
        consentTemplate: null,
        medicalTemplate: null,
        form9Template: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    );
  }),
  // Public-safe subset for clients viewing an artist's chat
  getPublicByArtistId: protectedProcedure
    .input(z.object({ artistId: z.string() }))
    .query(async ({ input }) => {
      const settings = await db.getArtistSettings(input.artistId);
      if (!settings) return null;
      return {
        businessName: settings.businessName,
        displayName: settings.displayName,
        businessAddress: settings.businessAddress,
        depositAmount: settings.depositAmount,
        services: settings.services,
        bsb: settings.bsb,
        accountNumber: settings.accountNumber,
        businessCountry: settings.businessCountry,
        autoSendDepositInfo: settings.autoSendDepositInfo,
      };
    }),
  testExternalCalendarUrl: artistProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input }) => {
      try {
        const events = await parseExternalCalendar(input.url);
        return { success: true, eventCount: events.length, message: "Calendar connected successfully!" };
      } catch (error: any) {
        return { success: false, message: error.message || "Failed to reach Calendar URL" };
      }
    }),
  upsert: artistProcedure
    .input(
      z.object({
        businessName: z.string().optional(),
        displayName: z.string().optional(),
        businessAddress: z.string().optional(),
        businessEmail: z.string().optional(),
        bsb: z.string().optional(),
        accountNumber: z.string().optional(),
        businessCountry: z.string().length(2).optional(),
        depositAmount: z.number().optional(),
        autoSendDepositInfo: z.boolean().optional(),
        sendAutomatedReminders: z.boolean().optional(),
        workSchedule: z.string(),
        services: z.string(),
        publicSlug: z.string().optional(),
        funnelEnabled: z.boolean().optional(),
        licenceNumber: z.string().optional(),
        googleCalendarToken: z.string().optional(),
        appleCalendarUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return db.upsertArtistSettings({
        userId: ctx.user.id,
        ...input,
        autoSendDepositInfo:
          input.autoSendDepositInfo !== undefined
            ? input.autoSendDepositInfo
              ? 1
              : 0
            : undefined,
        sendAutomatedReminders:
          input.sendAutomatedReminders !== undefined
            ? input.sendAutomatedReminders
              ? 1
              : 0
            : undefined,
        funnelEnabled:
          input.funnelEnabled !== undefined
            ? input.funnelEnabled
              ? 1
              : 0
            : undefined,
        googleCalendarToken: input.googleCalendarToken,
        appleCalendarUrl: input.appleCalendarUrl,
      } as any);
    }),
});
