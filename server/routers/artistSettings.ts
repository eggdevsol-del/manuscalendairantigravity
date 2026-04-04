import { z } from "zod";
import { artistProcedure, protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { parseExternalCalendar } from "../services/icalParser";
import { getDb } from "../services/core";
import * as schema from "../../drizzle/schema";
import { eq, and, or, like, inArray } from "drizzle-orm";

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
        depositPercentage: 25,
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
        travelDates: JSON.stringify([]),
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
        depositPercentage: settings.depositPercentage ?? 25,
        services: settings.services,
        bsb: settings.bsb,
        accountNumber: settings.accountNumber,
        businessCountry: settings.businessCountry,
        autoSendDepositInfo: settings.autoSendDepositInfo,
        travelDates: settings.travelDates,
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
        workSchedule: z.string().optional(),
        services: z.string().optional(),
        publicSlug: z.string().optional(),
        funnelEnabled: z.boolean().optional(),
        licenceNumber: z.string().optional(),
        googleCalendarToken: z.string().optional(),
        appleCalendarUrl: z.string().optional(),
        travelDates: z.string().optional(),
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
        travelDates: input.travelDates,
      } as any);
    }),

  /**
   * Match artist's clients whose city/country match a travel destination.
   * Returns client profiles for the "Notify Clients" per-trip feature.
   */
  matchClientsByLocation: artistProcedure
    .input(
      z.object({
        city: z.string().min(1),
        country: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      const artistId = ctx.user.id;
      const database = (await getDb())!;

      // Step 1: Find all distinct client IDs for this artist via conversations
      const convos = await database
        .select({ clientId: schema.conversations.clientId })
        .from(schema.conversations)
        .where(eq(schema.conversations.artistId, artistId));

      const clientIds = Array.from(
        new Set(convos.map((c: any) => c.clientId).filter(Boolean) as string[])
      );

      if (clientIds.length === 0) return { clients: [], total: 0 };

      // Step 2: Find users whose city or country matches the trip destination
      const cityPattern = `%${input.city}%`;
      const countryPattern = `%${input.country}%`;

      const matchedClients = await database
        .select({
          id: schema.users.id,
          name: schema.users.name,
          email: schema.users.email,
          phone: schema.users.phone,
          city: schema.users.city,
          country: schema.users.country,
        })
        .from(schema.users)
        .where(
          and(
            inArray(schema.users.id, clientIds),
            or(
              like(schema.users.city, cityPattern),
              like(schema.users.country, countryPattern)
            )
          )
        );

      return {
        clients: matchedClients,
        total: matchedClients.length,
      };
    }),

  // ── Stripe Connect Management ──────────────────────────────

  /**
   * Create a Stripe Connect account and return the onboarding URL.
   * Artist-only. Creates a Standard account linked to the artist.
   */
  connectStripe: artistProcedure.mutation(async ({ ctx }) => {
    const existing = await db.getArtistSettings(ctx.user.id);

    // If already connected, just refresh the onboarding link
    if (existing?.stripeConnectAccountId) {
      const { createAccountLink, getAccountStatus } = await import(
        "../services/stripeConnect"
      );
      const status = await getAccountStatus(existing.stripeConnectAccountId);
      if (status.onboardingComplete) {
        return { alreadyConnected: true, url: null, status };
      }
      // Not finished onboarding — generate new link
      const url = await createAccountLink(
        existing.stripeConnectAccountId,
        ctx.user.id
      );
      return { alreadyConnected: false, url, status };
    }

    // Create new Connect account
    const { createConnectAccount, createAccountLink } = await import(
      "../services/stripeConnect"
    );
    const accountId = await createConnectAccount(
      ctx.user.id,
      ctx.user.email || "",
      existing?.businessName || undefined
    );
    const url = await createAccountLink(accountId, ctx.user.id);
    return { alreadyConnected: false, url, status: null };
  }),

  /**
   * Get the current Stripe Connect status for this artist.
   */
  getStripeConnectStatus: artistProcedure.query(async ({ ctx }) => {
    const settings = await db.getArtistSettings(ctx.user.id);

    if (!settings?.stripeConnectAccountId) {
      return {
        connected: false,
        accountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        onboardingComplete: false,
      };
    }

    const { getAccountStatus } = await import("../services/stripeConnect");
    const status = await getAccountStatus(settings.stripeConnectAccountId);

    return {
      connected: true,
      ...status,
    };
  }),

  /**
   * Disconnect Stripe Connect from this artist.
   */
  disconnectStripe: artistProcedure.mutation(async ({ ctx }) => {
    const { disconnectAccount } = await import("../services/stripeConnect");
    await disconnectAccount(ctx.user.id);
    return { success: true };
  }),
});
