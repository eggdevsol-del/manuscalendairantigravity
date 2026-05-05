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
    const expressEnabled =
      process.env.STRIPE_CUSTOM_ENABLED !== "false";

    // Return default settings if none exist
    return (
      settings
        ? {
          ...settings,
          expressOnboardingEnabled: expressEnabled,
        }
        : {
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
          googleCalendarToken: null,
          appleCalendarUrl: null,
          subscriptionTier: "basic" as const,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          subscriptionStatus: "active" as const,
          stripeConnectAccountId: null,
          stripeConnectOnboardingComplete: 0,
          stripeConnectPayoutsEnabled: 0,
          stripeConnectAccountType: "standard" as const,
          stripeConnectDetailsSubmitted: 0,
          expressOnboardingEnabled: expressEnabled,
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
   * Create a Stripe Connect account and return onboarding info.
   * Feature-flagged: Express (embedded) or Standard (redirect).
   * Idempotent: if account already exists, returns existing state.
   */
  connectStripe: artistProcedure.mutation(async ({ ctx }) => {
    const existing = await db.getArtistSettings(ctx.user.id);
    const {
      isCustomEnabled,
      createConnectAccount,
      createCustomConnectAccount,
      createAccountLink,
      getAccountStatus,
    } = await import("../services/stripeConnect");

    // ── Idempotent: account already exists ──
    if (existing?.stripeConnectAccountId) {
      const status = await getAccountStatus(existing.stripeConnectAccountId);
      const accountType = existing.stripeConnectAccountType || "standard";

      if (status.onboardingComplete) {
        return {
          alreadyConnected: true,
          url: null,
          accountId: existing.stripeConnectAccountId,
          accountType,
          status,
        };
      }

      // Custom incomplete → verify it's actually a Custom account on Stripe's side
      if (accountType === "custom") {
        // Self-heal: verify the account has proper controller settings
        const stripeAccount = await (await import("../services/stripe")).stripe.accounts.retrieve(existing.stripeConnectAccountId);
        const isRealCustom = stripeAccount.type === "custom" || (stripeAccount as any).controller?.requirement_collection === "application";

        if (!isRealCustom) {
          // Account was created without proper controller (from a failed deploy) — recreate
          console.log(`[Stripe Connect] Account ${existing.stripeConnectAccountId} is marked as custom but Stripe says type=${stripeAccount.type}. Recreating...`);
          const { disconnectAccount } = await import("../services/stripeConnect");
          await disconnectAccount(ctx.user.id);
          const accountId = await createCustomConnectAccount(
            ctx.user.id,
            ctx.user.email || "",
            existing?.businessCountry || "AU",
            existing?.businessName || undefined
          );
          return {
            alreadyConnected: false,
            url: null,
            accountId,
            accountType: "custom" as const,
            status: null,
          };
        }

        return {
          alreadyConnected: false,
          url: null,
          accountId: existing.stripeConnectAccountId,
          accountType: "custom" as const,
          status,
        };
      }

      // Express account incomplete → auto-migrate to Custom
      // (Express accounts don't support disable_stripe_user_authentication)
      if (accountType === "express" && isCustomEnabled()) {
        const { disconnectAccount } = await import("../services/stripeConnect");
        await disconnectAccount(ctx.user.id);
        console.log(`[Stripe Connect] Auto-migrating Express → Custom for artist ${ctx.user.id}`);
        const accountId = await createCustomConnectAccount(
          ctx.user.id,
          ctx.user.email || "",
          existing?.businessCountry || "AU",
          existing?.businessName || undefined
        );
        return {
          alreadyConnected: false,
          url: null,
          accountId,
          accountType: "custom" as const,
          status: null,
        };
      }

      // Standard incomplete → migrate to Custom or generate new link
      if (isCustomEnabled()) {
        const accountId = await createCustomConnectAccount(
          ctx.user.id,
          ctx.user.email || "",
          existing?.businessCountry || "AU",
          existing?.businessName || undefined
        );
        return {
          alreadyConnected: false,
          url: null,
          accountId,
          accountType: "custom" as const,
          status: null,
        };
      }

      const url = await createAccountLink(
        existing.stripeConnectAccountId,
        ctx.user.id
      );
      return {
        alreadyConnected: false,
        url,
        accountId: existing.stripeConnectAccountId,
        accountType: "standard" as const,
        status,
      };
    }

    // ── Create new account ──
    if (isCustomEnabled()) {
      // Custom: embedded in-app onboarding (no popup)
      const accountId = await createCustomConnectAccount(
        ctx.user.id,
        ctx.user.email || "",
        existing?.businessCountry || "AU",
        existing?.businessName || undefined
      );
      return {
        alreadyConnected: false,
        url: null,
        accountId,
        accountType: "custom" as const,
        status: null,
      };
    }

    // Standard: redirect to Stripe
    const accountId = await createConnectAccount(
      ctx.user.id,
      ctx.user.email || "",
      existing?.businessName || undefined
    );
    const url = await createAccountLink(accountId, ctx.user.id);
    return {
      alreadyConnected: false,
      url,
      accountId,
      accountType: "standard" as const,
      status: null,
    };
  }),

  /**
   * Create a Stripe AccountSession for embedded Connect onboarding.
   * Returns { clientSecret } — used by @stripe/connect-js on the frontend.
   *
   * This is a MUTATION (not a query) to prevent TanStack Query caching.
   * Guard: only valid for Custom accounts.
   */
  createStripeAccountSession: artistProcedure.mutation(async ({ ctx }) => {
    const settings = await db.getArtistSettings(ctx.user.id);

    if (!settings?.stripeConnectAccountId) {
      throw new Error("No Stripe Connect account found. Create one first.");
    }

    if (settings.stripeConnectAccountType !== "custom") {
      throw new Error(
        "Account sessions are only available for Custom accounts."
      );
    }

    const { createAccountSession } = await import(
      "../services/stripeConnect"
    );
    const clientSecret = await createAccountSession(
      settings.stripeConnectAccountId
    );

    return { clientSecret };
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
        accountType: "standard" as const,
        chargesEnabled: false,
        payoutsEnabled: false,
        onboardingComplete: false,
      };
    }

    const { getAccountStatus } = await import("../services/stripeConnect");
    const status = await getAccountStatus(settings.stripeConnectAccountId);

    return {
      connected: true,
      accountType: (settings.stripeConnectAccountType || "standard") as
        | "standard"
        | "express"
        | "custom",
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

  /**
   * Get a Stripe Account Link URL for redirect-based onboarding.
   * Fallback for environments where the embedded iframe doesn't render
   * (e.g., Android PWA standalone webview).
   */
  getStripeAccountLink: artistProcedure.mutation(async ({ ctx }) => {
    const settings = await db.getArtistSettings(ctx.user.id);

    if (!settings?.stripeConnectAccountId) {
      throw new Error("No Stripe Connect account found. Create one first.");
    }

    const { createAccountLink } = await import("../services/stripeConnect");
    const url = await createAccountLink(
      settings.stripeConnectAccountId,
      ctx.user.id
    );

    return { url };
  }),

  /**
   * Submit native onboarding form data to Stripe.
   */
  submitStripeOnboarding: artistProcedure
    .input(
      z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().min(8),
        dobDay: z.number().min(1).max(31),
        dobMonth: z.number().min(1).max(12),
        dobYear: z.number().min(1900).max(2010),
        country: z.enum(["AU", "NZ"]).default("AU"),
        addressLine1: z.string().min(1),
        addressCity: z.string().min(1),
        addressState: z.string().min(1),
        addressPostalCode: z.string().min(4),
        bankBsb: z.string().min(6).max(7),
        bankAccountNumber: z.string().min(5).max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const settings = await db.getArtistSettings(ctx.user.id);
      if (!settings?.stripeConnectAccountId) {
        throw new Error("No Stripe Connect account found. Create one first.");
      }

      const { submitOnboardingData, syncAccountStatusToDb } = await import(
        "../services/stripeConnect"
      );

      const result = await submitOnboardingData(
        settings.stripeConnectAccountId,
        { ...input, publicSlug: settings.publicSlug || undefined },
        ctx.req.ip || "127.0.0.1"
      );

      await syncAccountStatusToDb(settings.stripeConnectAccountId);
      return result;
    }),

  /**
   * Upload ID verification document (base64-encoded).
   */
  uploadStripeDocument: artistProcedure
    .input(
      z.object({
        fileBase64: z.string(),
        fileName: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const settings = await db.getArtistSettings(ctx.user.id);
      if (!settings?.stripeConnectAccountId) {
        throw new Error("No Stripe Connect account found.");
      }

      const { uploadIdentityDocument, syncAccountStatusToDb } = await import(
        "../services/stripeConnect"
      );

      const fileBuffer = Buffer.from(input.fileBase64, "base64");
      const isTestMode = process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_");

      const result = await uploadIdentityDocument(
        settings.stripeConnectAccountId,
        fileBuffer,
        input.fileName,
        isTestMode ?? false
      );

      await syncAccountStatusToDb(settings.stripeConnectAccountId);
      return result;
    }),

  /**
   * Get payout schedule, bank info, and balance.
   */
  getPayoutSchedule: artistProcedure.query(async ({ ctx }) => {
    const settings = await db.getArtistSettings(ctx.user.id);
    if (!settings?.stripeConnectAccountId) return null;

    const { getPayoutSchedule } = await import("../services/stripeConnect");
    return getPayoutSchedule(settings.stripeConnectAccountId);
  }),

  /**
   * Update payout schedule (daily, weekly, monthly).
   */
  updatePayoutSchedule: artistProcedure
    .input(
      z.object({
        interval: z.enum(["daily", "weekly", "monthly", "manual"]),
        weeklyAnchor: z.string().optional(),
        monthlyAnchor: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const settings = await db.getArtistSettings(ctx.user.id);
      if (!settings?.stripeConnectAccountId) {
        throw new Error("No Stripe Connect account found.");
      }

      const { updatePayoutSchedule } = await import(
        "../services/stripeConnect"
      );
      await updatePayoutSchedule(
        settings.stripeConnectAccountId,
        input.interval,
        input.weeklyAnchor,
        input.monthlyAnchor
      );

      return { success: true };
    }),
});

