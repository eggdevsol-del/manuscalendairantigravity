import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and } from "drizzle-orm";
import * as schema from "../../drizzle/schema";
import { calculateTransactionFees } from "../domain/fees";
import { createStorefrontCheckoutSession } from "../services/stripe";

export const storefrontRouter = router({
  /**
   * Fetch all active products for the logged-in artist
   */
  getProducts: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    return db.query.products.findMany({
      where: and(
        eq(schema.products.artistId, ctx.user.id),
        eq(schema.products.isActive, 1)
      ),
      orderBy: [desc(schema.products.createdAt)],
    });
  }),

  /**
   * Fetch all active seminars for the logged-in artist
   */
  getSeminars: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    return db.query.seminars.findMany({
      where: and(
        eq(schema.seminars.artistId, ctx.user.id),
        eq(schema.seminars.isActive, 1)
      ),
      orderBy: [desc(schema.seminars.createdAt)],
    });
  }),

  /**
   * Create a new product (used by the Setup Wizard)
   */
  createProduct: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1, "Title is required"),
        description: z.string(),
        priceCents: z.number().positive(),
        inventoryCount: z.number().min(0),
        fulfillmentType: z.enum(["pickup", "delivery", "both", "digital"]),
        imageUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      const [result] = await db.insert(schema.products).values({
        artistId: ctx.user.id,
        title: input.title,
        description: input.description,
        priceCents: input.priceCents,
        inventoryCount: input.inventoryCount,
        fulfillmentType: input.fulfillmentType,
        imageUrl: input.imageUrl,
        isActive: 1,
      });

      return { success: true, id: result.insertId };
    }),

  /**
   * Public endpoint to fetch an artist's storefront (products + seminars)
   * Used by PublicStorefront.tsx
   */
  getArtistStorefront: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      // 1. Find artist by slug
      const settings = await db.query.artistSettings.findFirst({
        where: eq(schema.artistSettings.publicSlug, input.slug.toLowerCase()),
      });

      if (!settings) return null;

      const artistId = settings.userId;

      // 2. Fetch products and seminars
      const products = await db.query.products.findMany({
        where: and(
          eq(schema.products.artistId, artistId),
          eq(schema.products.isActive, 1)
        ),
      });

      const seminars = await db.query.seminars.findMany({
        where: and(
          eq(schema.seminars.artistId, artistId),
          eq(schema.seminars.isActive, 1)
        ),
      });

      return {
        artistId,
        products,
        seminars,
      };
    }),

  /**
   * Create a Stripe checkout session for a product
   */
  createStorefrontCheckout: publicProcedure
    .input(
      z.object({
        productId: z.number(),
        quantity: z.number().min(1),
        fulfillmentMethod: z.enum(["pickup", "delivery", "digital"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      const product = await db.query.products.findFirst({
        where: eq(schema.products.id, input.productId),
      });

      if (!product || !product.isActive || product.inventoryCount < input.quantity) {
        throw new Error("Product is unavailable or out of stock.");
      }

      const settings = await db.query.artistSettings.findFirst({
        where: eq(schema.artistSettings.userId, product.artistId),
      });

      const artistUser = await db.query.users.findFirst({
        where: eq(schema.users.id, product.artistId),
      });

      if (!settings || !artistUser) {
        throw new Error("Artist configuration error");
      }

      const totalAmountCents = product.priceCents * input.quantity;

      // Fees - we assume "free" tier for store orders unless artist has subscriptions setup
      // For MVP, we will treat store orders with the standard fee engine
      const fees = calculateTransactionFees({
        transactionAmountCents: totalAmountCents,
        tier: "free", // You can expand this if artists have a Storefront tier
      });

      // 1. Create Order Record
      const [orderResult] = await db.insert(schema.orders).values({
        artistId: product.artistId,
        totalAmountCents,
        platformFeeCents: fees.platformFeeCents,
        artistFeeCents: fees.artistFeeCents,
        status: "pending",
        fulfillmentMethod: input.fulfillmentMethod,
      });

      const orderId = orderResult.insertId;

      // 2. Create Order Item
      await db.insert(schema.orderItems).values({
        orderId,
        productId: product.id,
        quantity: input.quantity,
        priceAtPurchaseCents: product.priceCents,
      });

      // 3. Get Stripe Account
      const paymentSettings = await db.query.paymentMethodSettings.findFirst({
        where: eq(schema.paymentMethodSettings.userId, product.artistId),
      });

      const connectAccountId = paymentSettings?.stripeConnectAccountId || undefined;

      // 4. Generate Session
      const sessionUrl = await createStorefrontCheckoutSession({
        orderId,
        productId: product.id,
        productName: product.title,
        artistName: settings.displayName || artistUser.name || "Artist",
        clientTotalCents: totalAmountCents,
        platformFeeCents: fees.platformFeeCents,
        artistFeeCents: fees.artistFeeCents,
        fulfillmentMethod: input.fulfillmentMethod,
        stripeConnectAccountId: connectAccountId,
        slug: settings.publicSlug || "shop",
      });

      if (!sessionUrl) {
        throw new Error("Failed to generate checkout session");
      }

      return { url: sessionUrl };
    }),
});
