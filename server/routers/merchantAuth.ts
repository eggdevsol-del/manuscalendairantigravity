import { withDatabaseTransaction } from "../services/core";
import { z } from "zod";
import { router, publicProcedure, merchantProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import * as schema from "../../drizzle/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { hashPassword, generateToken } from "../_core/auth-new";
import { getUserByEmail } from "../db";
import { randomBytes } from "crypto";
import { resolveCountry } from "../utils/resolveCountry";
import { scrapeForMerchant } from "../services/scraper";
import {
  syncInventoryFromAdmin,
  sanitizeShopDomain,
  verifyShopifyConnection,
} from "../services/shopifyAdminApi";

export const merchantAuthRouter = router({
  /**
   * Detect country from IP address
   */
  detectCountry: publicProcedure.query(({ ctx }) => {
    // Railway puts real IP in x-forwarded-for, fallback to socket IP
    let ip = "";
    const forwardedFor = ctx.req.headers["x-forwarded-for"];

    if (typeof forwardedFor === "string") {
      ip = forwardedFor.split(",")[0].trim();
    } else if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
      ip = forwardedFor[0].split(",")[0].trim();
    } else if (ctx.req.socket?.remoteAddress) {
      ip = ctx.req.socket.remoteAddress;
    }

    const country = resolveCountry(ip);
    return { country };
  }),

  /**
   * Validate ABN soft check
   */
  validateAbn: publicProcedure
    .input(z.object({ abn: z.string().min(1) })) // Actual length validation would be .length(11) usually
    .query(async ({ input }) => {
      // Stub: in future, hit ABR API using process.env.ABR_API_KEY
      return {
        valid: /^\d{11}$/.test(input.abn.replace(/\s/g, "")),
        verified: false,
        businessName: null,
      };
    }),

  /**
   * Validate NZBN soft check
   */
  validateNzbn: publicProcedure
    .input(z.object({ nzbn: z.string().min(1) })) // Actual length validation would be .length(13) usually
    .query(async ({ input }) => {
      // Stub: in future, hit NZBN API
      return {
        valid: /^\d{13}$/.test(input.nzbn.replace(/\s/g, "")),
        verified: false,
        businessName: null,
      };
    }),

  /**
   * Get merchant profile
   */
  getMerchantProfile: merchantProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.userId, ctx.user.id),
    });

    if (!merchant) return null;
    return {
      id: merchant.id,
      userId: merchant.userId,
      businessName: merchant.businessName,
      country: merchant.country,
      abn: merchant.abn,
      nzbn: merchant.nzbn,
      contactName: merchant.contactName,
      phone: merchant.phone,
      address: merchant.address,
      integrationType: merchant.integrationType,
      shopifyDomain: merchant.shopifyDomain,
      status: merchant.status,
      verified: merchant.verified,
      claimed: merchant.claimed,
      lowStockThreshold: merchant.lowStockThreshold,
      shopifyConnected: !!merchant.shopifyToken,
    };
  }),

  updateProfile: merchantProcedure
    .input(
      z.object({
        businessName: z.string().trim().min(1).max(255),
        contactName: z.string().trim().max(255),
        phone: z.string().trim().max(50),
        address: z.string().trim().max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(schema.merchants)
        .set(input)
        .where(eq(schema.merchants.userId, ctx.user.id));
      return { success: true };
    }),

  /**
   * Get merchant dashboard stats
   */
  getDashboardStats: merchantProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.userId, ctx.user.id),
    });

    if (!merchant) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Merchant not found" });
    }

    const orders = await db.query.orders.findMany({
      where: eq(schema.orders.artistId, ctx.user.id),
    });

    let revenueCents = 0;
    let pendingOrders = 0;

    for (const o of orders) {
      if (o.status === "paid" || o.status === "fulfilled") {
        revenueCents += o.totalAmountCents;
      }
      if (o.status === "paid") {
        pendingOrders++;
      }
    }

    const products = await db.query.products.findMany({
      with: { variants: true },
      where: and(
        eq(schema.products.artistId, ctx.user.id),
        eq(schema.products.ownerType, "merchant")
      ),
    });

    let lowStockItems = 0;
    const threshold = merchant.lowStockThreshold ?? 5;
    for (const p of products) {
      if (
        p.isActive &&
        (p.variants.length
          ? p.variants.reduce((sum, variant) => sum + variant.inventoryCount, 0)
          : p.inventoryCount) < threshold
      ) {
        lowStockItems++;
      }
    }

    return {
      revenueCents,
      pendingOrders,
      lowStockItems,
      totalOrders: orders.filter(order =>
        ["paid", "fulfilled"].includes(order.status)
      ).length,
    };
  }),

  /**
   * Register a new merchant from scratch
   */
  register: publicProcedure
    .input(
      z.object({
        email: z.string().trim().toLowerCase().email(),
        password: z.string().min(8),
        name: z.string().min(1),
        businessName: z.string().min(1),
        country: z.enum(["AU", "NZ"]),
        abn: z.string().optional(),
        nzbn: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        websiteUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      // Check if user already exists
      const existingUser = await getUserByEmail(input.email);
      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User with this email already exists",
        });
      }

      // Hash password and generate user ID
      const hashedPassword = await hashPassword(input.password);
      const userId = `user_${randomBytes(16).toString("hex")}`;

      // Execute atomic transaction for user and merchant creation
      await db.transaction(async tx => {
        // 1. Create User
        await tx.insert(schema.users).values({
          id: userId,
          email: input.email,
          password: hashedPassword,
          name: input.name,
          phone: input.phone,
          address: input.address,
          role: "merchant",
        });

        // 2. Create Merchant
        const [merchantResult] = await tx.insert(schema.merchants).values({
          country: input.country,
          userId: userId,
          businessName: input.businessName,
          abn: input.abn,
          nzbn: input.nzbn,
          contactName: input.name,
          phone: input.phone,
          address: input.address,
          status: "pending",
          verified: 0,
        });

        const merchantId = merchantResult.insertId;

        if (input.websiteUrl) {
          await tx.insert(schema.notificationOutbox).values({
            eventType: "public_catalogue_import",
            payloadJson: JSON.stringify({
              merchantId,
              storeUrl: input.websiteUrl,
            }),
            status: "pending",
          });
        }
      });

      // 3. Return JWT
      const token = generateToken({ id: userId, email: input.email });
      return { success: true, token, userId };
    }),

  /**
   * Claim an existing scraped storefront
   */
  claimStorefront: publicProcedure
    .input(
      z.object({
        supplierId: z.number(),
        email: z.string().trim().toLowerCase().email(),
        password: z.string().min(8),
        name: z.string().optional(),
        businessName: z.string().optional(),
        country: z.enum(["AU", "NZ"]).optional(),
        abn: z.string().optional(),
        nzbn: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
      })
    )
    .mutation(
      async (): Promise<{
        success: boolean;
        token: string;
        userId: string;
      }> => {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Contact support to verify ownership of this supplier storefront.",
        });
      }
    ),

  /**
   * Connect Stripe Express Account for Merchants
   */
  connectStripe: merchantProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    // Get merchant to access country and existing stripe account ID
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.userId, ctx.user.id),
    });

    if (!merchant) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Merchant not found" });
    }

    const { stripe } = await import("../services/stripe");

    let accountId = merchant.stripeAccountId;

    if (!accountId) {
      const defaultCurrency = merchant.country === "NZ" ? "nzd" : "aud";

      // Create new Express account
      const account = await stripe.accounts.create({
        type: "express",
        email: ctx.user.email || undefined,
        country: merchant.country,
        default_currency: defaultCurrency,
      });

      accountId = account.id;

      // Save account ID to merchant
      await db
        .update(schema.merchants)
        .set({ stripeAccountId: accountId })
        .where(eq(schema.merchants.id, merchant.id));
    }

    // Generate onboarding link
    const baseUrl =
      process.env.VITE_APP_URL ||
      process.env.APP_URL ||
      "https://www.tattoi.app";
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/onboarding/merchant`,
      return_url: `${baseUrl}/onboarding/merchant`,
      type: "account_onboarding",
    });

    return { url: accountLink.url };
  }),

  /**
   * Polling query to check Stripe account verification status
   */
  getMerchantStripeStatus: merchantProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.userId, ctx.user.id),
    });

    if (!merchant) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Merchant not found" });
    }

    if (!merchant.stripeAccountId) {
      return { connected: false, chargesEnabled: false, payoutsEnabled: false };
    }

    const { stripe } = await import("../services/stripe");
    const account = await stripe.accounts.retrieve(merchant.stripeAccountId);

    return {
      connected: true,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    };
  }),

  /**
   * Polling query to check background scraper progress
   */
  getSyncStatus: merchantProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.userId, ctx.user.id),
    });

    if (!merchant) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Merchant not found" });
    }

    const latest = await db.query.notificationOutbox.findFirst({
      where: and(
        sql`${schema.notificationOutbox.eventType} IN ('shopify_catalogue_sync','public_catalogue_import')`,
        sql`JSON_EXTRACT(${schema.notificationOutbox.payloadJson}, '$.merchantId') = ${merchant.id}`
      ),
      orderBy: desc(schema.notificationOutbox.id),
    });
    const { syncStatusMap } = await import("../services/scraper");
    const progress = syncStatusMap.get(merchant.id);
    if (latest) {
      if (latest.status === "sent")
        return {
          status: "complete" as const,
          count: progress?.count || 0,
          message: "Last catalogue import completed.",
        };
      if (latest.status === "failed")
        return {
          status: "failed" as const,
          count: 0,
          error: latest.lastError || "Import failed. Retry from this screen.",
        };
      return {
        status: "syncing" as const,
        count: progress?.count || 0,
        message:
          progress?.status === "syncing"
            ? progress.message
            : "Catalogue import queued.",
      };
    }
    return progress || { status: "idle" as const, count: 0 };
  }),

  /**
   * Save Shopify Custom App Token and Domain
   */
  saveShopifyCredentials: merchantProcedure
    .input(
      z.object({
        shopUrl: z.string().min(1),
        accessToken: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      const domain = sanitizeShopDomain(input.shopUrl);
      const shop = await verifyShopifyConnection(
        domain,
        input.accessToken.trim()
      );
      const merchant = await db.query.merchants.findFirst({
        where: eq(schema.merchants.userId, ctx.user.id),
      });
      if (!merchant) throw new TRPCError({ code: "NOT_FOUND" });
      if (shop.currencyCode !== (merchant.country === "NZ" ? "NZD" : "AUD"))
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Shopify currency must match your Tattoi business currency.",
        });

      await db
        .update(schema.merchants)
        .set({
          integrationType: "shopify",
          shopifyDomain: domain,
          shopifyToken: input.accessToken.trim(),
          shopifyShopId: shop.id,
        })
        .where(eq(schema.merchants.userId, ctx.user.id));

      return { success: true, domain };
    }),

  /**
   * Manually trigger a Shopify Admin API sync
   */
  triggerShopifySync: merchantProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.userId, ctx.user.id),
    });

    if (!merchant) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Merchant not found" });
    }

    if (!merchant.shopifyDomain || !merchant.shopifyToken) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Shopify credentials missing.",
      });
    }

    await withDatabaseTransaction(async tx => {
      await tx
        .select({ id: schema.merchants.id })
        .from(schema.merchants)
        .where(eq(schema.merchants.id, merchant.id))
        .for("update");
      const queued = await tx.query.notificationOutbox.findFirst({
        where: and(
          eq(schema.notificationOutbox.eventType, "shopify_catalogue_sync"),
          sql`(${schema.notificationOutbox.status} = 'pending' OR (${schema.notificationOutbox.status} = 'failed' AND ${schema.notificationOutbox.attemptCount} < 5))`,
          sql`JSON_EXTRACT(${schema.notificationOutbox.payloadJson}, '$.merchantId') = ${merchant.id}`
        ),
      });
      if (!queued)
        await tx.insert(schema.notificationOutbox).values({
          eventType: "shopify_catalogue_sync",
          payloadJson: JSON.stringify({ merchantId: merchant.id }),
          status: "pending",
        });
    });

    return { success: true };
  }),
});
