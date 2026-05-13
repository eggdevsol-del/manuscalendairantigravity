import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, ne } from "drizzle-orm";
import * as schema from "../../drizzle/schema";
import { calculateTransactionFees, resolvePaymentTier } from "../domain/fees";
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
        shippingCents: z.number().min(0).optional(),
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
        shippingCents: input.shippingCents || 0,
        inventoryCount: input.inventoryCount,
        fulfillmentType: input.fulfillmentType,
        imageUrl: input.imageUrl,
        isActive: 1,
      });

      return { success: true, id: result.insertId };
    }),

  /**
   * Update an existing product
   */
  updateProduct: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1, "Title is required"),
        description: z.string(),
        priceCents: z.number().positive(),
        shippingCents: z.number().min(0).optional(),
        inventoryCount: z.number().min(0),
        fulfillmentType: z.enum(["pickup", "delivery", "both", "digital"]),
        imageUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      // Verify ownership
      const existingProduct = await db.query.products.findFirst({
        where: eq(schema.products.id, input.id),
      });

      if (!existingProduct || existingProduct.artistId !== ctx.user.id) {
        throw new Error("Product not found or unauthorized");
      }

      await db.update(schema.products)
        .set({
          title: input.title,
          description: input.description,
          priceCents: input.priceCents,
          shippingCents: input.shippingCents || 0,
          inventoryCount: input.inventoryCount,
          fulfillmentType: input.fulfillmentType,
          ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.products.id, input.id));

      return { success: true };
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

      const artist = await db.query.users.findFirst({
        where: eq(schema.users.id, artistId),
      });

      return {
        artistId,
        artistName: settings.businessName || settings.displayName || artist?.name || "Artist",
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
        items: z.array(
          z.object({
            productId: z.number(),
            quantity: z.number().min(1),
          })
        ).min(1),
        fulfillmentMethod: z.enum(["pickup", "delivery", "digital"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      // Verify all products
      const productIds = input.items.map(i => i.productId);
      const products = await db.query.products.findMany({
        where: (products, { inArray }) => inArray(products.id, productIds),
      });

      if (products.length !== input.items.length) {
        throw new Error("One or more products could not be found.");
      }

      let totalAmountCents = 0;
      let totalShippingCents = 0;
      const artistId = products[0].artistId;
      
      const enrichedItems = input.items.map(item => {
        const product = products.find(p => p.id === item.productId)!;
        
        if (product.artistId !== artistId) {
          throw new Error("Cannot checkout items from multiple artists at once.");
        }
        
        if (!product.isActive || product.inventoryCount < item.quantity) {
          throw new Error(`Product '${product.title}' is unavailable or out of stock.`);
        }

        totalAmountCents += product.priceCents * item.quantity;
        
        if (input.fulfillmentMethod === "delivery") {
          totalShippingCents += (product.shippingCents || 0) * item.quantity;
        }

        return {
          productId: product.id,
          productName: product.title,
          priceCents: product.priceCents,
          quantity: item.quantity,
        };
      });

      const settings = await db.query.artistSettings.findFirst({
        where: eq(schema.artistSettings.userId, artistId),
      });

      const artistUser = await db.query.users.findFirst({
        where: eq(schema.users.id, artistId),
      });

      if (!settings || !artistUser) {
        throw new Error("Artist configuration error");
      }

      // Fees
      const tier = resolvePaymentTier(settings.subscriptionTier);
      const fees = calculateTransactionFees(
        totalAmountCents + totalShippingCents,
        tier
      );

      // 1. Create Order Record
      const [orderResult] = await db.insert(schema.orders).values({
        artistId,
        totalAmountCents: totalAmountCents + totalShippingCents,
        platformFeeCents: fees.platformFeeCents,
        artistFeeCents: fees.artistFeeCents,
        shippingCostCents: totalShippingCents,
        status: "pending",
        fulfillmentMethod: input.fulfillmentMethod,
      });

      const orderId = orderResult.insertId;

      // 2. Create Order Items
      for (const item of enrichedItems) {
        await db.insert(schema.orderItems).values({
          orderId,
          productId: item.productId,
          quantity: item.quantity,
          priceAtPurchaseCents: item.priceCents,
        });
      }

      // 3. Get Stripe Account (Fix: from artistSettings)
      const connectAccountId = settings.stripeConnectAccountId || undefined;

      // 4. Generate Session
      const sessionResult = await createStorefrontCheckoutSession({
        orderId,
        items: enrichedItems,
        artistName: settings.displayName || artistUser.name || "Artist",
        clientTotalCents: totalAmountCents + totalShippingCents,
        platformFeeCents: fees.platformFeeCents,
        artistFeeCents: fees.artistFeeCents,
        shippingCostCents: totalShippingCents,
        fulfillmentMethod: input.fulfillmentMethod,
        stripeConnectAccountId: connectAccountId,
        slug: settings.publicSlug || "shop",
      });

      if (!sessionResult.url && !sessionResult.clientSecret) {
        throw new Error("Failed to generate checkout session");
      }

      return sessionResult;
    }),

  /**
   * Create a new seminar
   */
  createSeminar: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string(),
        type: z.enum(["in_person", "virtual"]),
        date: z.string(), // ISO date string
        locationUrl: z.string().optional(),
        capacity: z.number().min(1),
        priceCents: z.number().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      const [result] = await db.insert(schema.seminars).values({
        artistId: ctx.user.id,
        title: input.title,
        description: input.description,
        type: input.type,
        date: new Date(input.date),
        locationUrl: input.locationUrl,
        capacity: input.capacity,
        priceCents: input.priceCents,
        isActive: 1,
      });

      return { success: true, id: result.insertId };
    }),

  /**
   * Fetch orders for the logged-in artist (for fulfillment dashboard)
   */
  getOrders: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    const orders = await db.query.orders.findMany({
      where: and(
        eq(schema.orders.artistId, ctx.user.id),
        ne(schema.orders.status, "pending")
      ),
      orderBy: [desc(schema.orders.createdAt)],
    });

    // Fetch order items for each order
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const items = await db.query.orderItems.findMany({
          where: eq(schema.orderItems.orderId, order.id),
          with: { product: true },
        });
        return { ...order, items };
      })
    );

    return ordersWithItems;
  }),

  /**
   * Update order fulfillment status
   */
  updateOrderStatus: protectedProcedure
    .input(
      z.object({
        orderId: z.number(),
        status: z.enum(["fulfilled", "cancelled"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      const order = await db.query.orders.findFirst({
        where: and(
          eq(schema.orders.id, input.orderId),
          eq(schema.orders.artistId, ctx.user.id)
        ),
      });

      if (!order) throw new Error("Order not found");

      await db.update(schema.orders).set({
        status: input.status,
        updatedAt: new Date(),
      }).where(eq(schema.orders.id, input.orderId));

      return { success: true };
    }),

  /**
   * Public endpoint to get seminars for artist hub
   */
  getPublicSeminars: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const settings = await db.query.artistSettings.findFirst({
        where: eq(schema.artistSettings.publicSlug, input.slug.toLowerCase()),
      });

      if (!settings) return [];

      const now = new Date();
      const seminars = await db.query.seminars.findMany({
        where: and(
          eq(schema.seminars.artistId, settings.userId),
          eq(schema.seminars.isActive, 1),
        ),
        orderBy: [schema.seminars.date],
      });

      // Filter to upcoming only
      return seminars.filter(s => new Date(s.date) > now);
    }),

  /**
   * Create a Stripe checkout session for a seminar registration
   */
  createSeminarCheckout: publicProcedure
    .input(
      z.object({
        seminarId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      const seminar = await db.query.seminars.findFirst({
        where: eq(schema.seminars.id, input.seminarId),
      });

      if (!seminar || !seminar.isActive) {
        throw new Error("Seminar is unavailable.");
      }

      const spotsLeft = seminar.capacity - (seminar.ticketsSold || 0);
      if (spotsLeft <= 0) {
        throw new Error("This event is sold out.");
      }

      const settings = await db.query.artistSettings.findFirst({
        where: eq(schema.artistSettings.userId, seminar.artistId),
      });

      const artistUser = await db.query.users.findFirst({
        where: eq(schema.users.id, seminar.artistId),
      });

      if (!settings || !artistUser) {
        throw new Error("Artist configuration error");
      }

      const tier = resolvePaymentTier(settings.subscriptionTier);
      const fees = calculateTransactionFees(
        seminar.priceCents,
        tier
      );

      // Create order record for the seminar
      const [orderResult] = await db.insert(schema.orders).values({
        artistId: seminar.artistId,
        totalAmountCents: seminar.priceCents,
        platformFeeCents: fees.platformFeeCents,
        artistFeeCents: fees.artistFeeCents,
        status: "pending",
        fulfillmentMethod: seminar.type === "virtual" ? "digital" : "pickup",
      });

      const orderId = orderResult.insertId;

      // Create order item linked to seminar
      await db.insert(schema.orderItems).values({
        orderId,
        seminarId: seminar.id,
        quantity: 1,
        priceAtPurchaseCents: seminar.priceCents,
      });

      // Get Stripe Connect Account
      const paymentSettings = await db.query.paymentMethodSettings.findFirst({
        where: eq(schema.paymentMethodSettings.userId, seminar.artistId),
      });

      const connectAccountId = paymentSettings?.stripeConnectAccountId || undefined;
      const slug = settings.publicSlug || "events";

      const sessionResult = await createStorefrontCheckoutSession({
        orderId,
        items: [{
          productId: seminar.id,
          productName: `${seminar.title} (${seminar.type === "virtual" ? "Virtual" : "In-Person"} Seminar)`,
          priceCents: seminar.priceCents,
          quantity: 1,
        }],
        artistName: settings.displayName || artistUser.name || "Artist",
        clientTotalCents: seminar.priceCents,
        platformFeeCents: fees.platformFeeCents,
        artistFeeCents: fees.artistFeeCents,
        shippingCostCents: 0,
        fulfillmentMethod: seminar.type === "virtual" ? "digital" : "pickup",
        stripeConnectAccountId: connectAccountId,
        slug,
      });

      if (!sessionResult.url && !sessionResult.clientSecret) {
        throw new Error("Failed to generate checkout session");
      }

      // Increment tickets sold
      await db.update(schema.seminars).set({
        ticketsSold: (seminar.ticketsSold || 0) + 1,
      }).where(eq(schema.seminars.id, seminar.id));

      return sessionResult;
    }),
});

