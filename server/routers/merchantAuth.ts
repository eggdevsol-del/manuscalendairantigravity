import { z } from "zod";
import { router, publicProcedure, merchantProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import * as schema from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { hashPassword, generateToken } from "../_core/auth-new";
import { getUserByEmail } from "../db";
import { randomBytes } from "crypto";
import { resolveCountry } from "../utils/resolveCountry";
import { scrapeForMerchant } from "../services/scraper";

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
      return { valid: true, businessName: null };
    }),

  /**
   * Validate NZBN soft check
   */
  validateNzbn: publicProcedure
    .input(z.object({ nzbn: z.string().min(1) })) // Actual length validation would be .length(13) usually
    .query(async ({ input }) => {
      // Stub: in future, hit NZBN API using process.env.NZBN_API_KEY
      return { valid: true, businessName: null };
    }),

  /**
   * Register a new merchant from scratch
   */
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
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
      await db.transaction(async (tx) => {
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

        // Background Scrape
        if (input.websiteUrl) {
          setTimeout(() => {
            scrapeForMerchant(merchantId, input.websiteUrl!).catch(console.error);
          }, 0);
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
        email: z.string().email(),
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

      // Verify the supplier exists and is not already claimed
      const supplier = await db.query.suppliers.findFirst({
        where: eq(schema.suppliers.id, input.supplierId),
      });

      if (!supplier) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Supplier not found",
        });
      }

      if (supplier.claimed === 1) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This supplier storefront has already been claimed",
        });
      }

      const hashedPassword = await hashPassword(input.password);
      const userId = `user_${randomBytes(16).toString("hex")}`;

      // Execute deep atomic transaction
      await db.transaction(async (tx) => {
        // 1. Create User
        await tx.insert(schema.users).values({
          id: userId,
          email: input.email,
          password: hashedPassword,
          name: input.name || supplier.name || "Claimed Store",
          phone: input.phone,
          address: input.address,
          role: "merchant",
        });

        // 2. Create Merchant
        const [merchantResult] = await tx.insert(schema.merchants).values({
          country: input.country || "AU", // Will be verified via Stripe Express
          userId: userId,
          businessName: input.businessName || supplier.name || "Claimed Store",
          abn: input.abn,
          nzbn: input.nzbn,
          contactName: input.name || supplier.name || "Claimed Store",
          phone: input.phone,
          address: input.address,
          status: "pending",
          verified: 0,
        });

        const merchantId = merchantResult.insertId;

        // 3. Migrate Products
        const supplierProducts = await tx.query.supplierProducts.findMany({
          where: eq(schema.supplierProducts.supplierId, input.supplierId),
        });

        for (const sp of supplierProducts) {
          // Check for variants for this product
          const variants = await tx.query.supplierProductVariants.findMany({
            where: eq(schema.supplierProductVariants.supplierProductId, sp.id),
          });

          const hasVariants = variants.length > 0 ? 1 : 0;

          // Insert into core products table
          const [productResult] = await tx.insert(schema.products).values({
            artistId: userId, // SSOT for ownership
            ownerType: "merchant",
            title: sp.title,
            description: sp.description || "",
            priceCents: sp.priceCents || 0,
            basePriceCents: sp.priceCents || 0,
            hasVariants: hasVariants,
            inventoryCount: 0, // Merchant should manually set stock
            fulfillmentType: "delivery", // Default for supplies
            imageUrl: sp.imageUrl,
            isActive: 0, // Default to inactive until Stripe onboarding
          });

          const newProductId = productResult.insertId;

          // 4. Migrate Variants (if any)
          if (hasVariants) {
            for (const v of variants) {
              await tx.insert(schema.productVariants).values({
                productId: newProductId,
                name: v.title,
                sku: v.sku || "",
                priceCents: v.priceCents || sp.priceCents || 0,
                inventoryCount: 0, // Merchant should manually set stock
              });
            }
          }
        }

        // 5. Update Supplier (Soft Reference)
        await tx
          .update(schema.suppliers)
          .set({
            claimed: 1,
            merchantId: merchantId,
          })
          .where(eq(schema.suppliers.id, input.supplierId));
      });

      // 6. Return JWT
      const token = generateToken({ id: userId, email: input.email });
      return { success: true, token, userId };
    }),

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
      await db.update(schema.merchants)
        .set({ stripeAccountId: accountId })
        .where(eq(schema.merchants.id, merchant.id));
    }

    // Generate onboarding link
    const baseUrl = process.env.VITE_APP_URL || process.env.APP_URL || "https://www.tattoi.app";
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

    const { syncStatusMap } = await import("../services/scraper");
    
    // If it's in the map, return it live
    if (syncStatusMap.has(merchant.id)) {
      return syncStatusMap.get(merchant.id);
    }
    
    // If not in the map, it's either finished a long time ago, or never started
    // We can count the products to see if they have any
    const products = await db.query.products.findMany({
      where: eq(schema.products.artistId, ctx.user.id),
      limit: 1
    });
    
    return {
      status: products.length > 0 ? "complete" : "idle",
      count: products.length,
    };
  }),
});
