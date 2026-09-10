import { effectivePaymentTier } from "../services/paymentEntitlements";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { withDatabaseTransaction } from "../services/core";
import {
  changeOrderInventory,
  releaseExpiredStoreOrder,
} from "../services/storeInventory";
import { eq, desc, and, ne } from "drizzle-orm";
import * as schema from "../../drizzle/schema";
import { calculateTransactionFees, resolvePaymentTier } from "../domain/fees";
import { createStorefrontCheckoutSession, stripe } from "../services/stripe";

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
        eq(
          schema.products.ownerType,
          ctx.user.role === "merchant" ? "merchant" : "artist"
        )
      ),
      with: { variants: true },
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
        priceCents: z.number().int().positive(),
        shippingCents: z.number().int().min(0).optional(),
        inventoryCount: z.number().int().min(0),
        fulfillmentType: z.enum(["pickup", "delivery", "both", "digital"]),
        imageUrl: z.string().url().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      if (!["artist", "admin", "merchant"].includes(ctx.user.role))
        throw new TRPCError({ code: "FORBIDDEN" });
      const [result] = await db.insert(schema.products).values({
        artistId: ctx.user.id,
        ownerType: ctx.user.role === "merchant" ? "merchant" : "artist",
        title: input.title,
        description: input.description,
        priceCents: input.priceCents,
        shippingCents: input.shippingCents || 0,
        inventoryCount: input.inventoryCount,
        fulfillmentType: input.fulfillmentType,
        imageUrl: input.imageUrl,
        isActive: input.isActive === false ? 0 : 1,
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
        priceCents: z.number().int().positive(),
        shippingCents: z.number().int().min(0).optional(),
        inventoryCount: z.number().int().min(0),
        fulfillmentType: z.enum(["pickup", "delivery", "both", "digital"]),
        imageUrl: z.string().url().optional(),
        isActive: z.boolean().optional(),
        variants: z
          .array(
            z.object({
              id: z.number().int().positive(),
              priceCents: z.number().int().positive(),
              inventoryCount: z.number().int().min(0).max(1000000),
            })
          )
          .max(250)
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) =>
      withDatabaseTransaction(async db => {
        if (!db) throw new Error("Database connection failed");

        // Verify ownership
        const existingProduct = await db.query.products.findFirst({
          where: eq(schema.products.id, input.id),
        });

        if (!existingProduct || existingProduct.artistId !== ctx.user.id) {
          throw new Error("Product not found or unauthorized");
        }

        await db
          .select({ id: schema.products.id })
          .from(schema.products)
          .where(eq(schema.products.id, input.id))
          .for("update");
        if (input.variants?.length) {
          const existing = await db
            .select()
            .from(schema.productVariants)
            .where(eq(schema.productVariants.productId, input.id))
            .for("update");
          if (
            new Set(input.variants.map(v => v.id)).size !==
              input.variants.length ||
            input.variants.some(v => !existing.some(old => old.id === v.id))
          )
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Product options changed. Reload and try again.",
            });
          for (const variant of input.variants) {
            const old = existing.find(v => v.id === variant.id)!;
            await db
              .update(schema.productVariants)
              .set({
                priceCents: variant.priceCents,
                inventoryCount: variant.inventoryCount,
              })
              .where(eq(schema.productVariants.id, variant.id));
            if (old.inventoryCount !== variant.inventoryCount)
              await db.insert(schema.stockAdjustments).values({
                productId: input.id,
                variantId: variant.id,
                adjustment: variant.inventoryCount - old.inventoryCount,
                reason: "Manual catalogue edit",
                referenceType: "manual",
                adjustedBy: ctx.user.id,
              });
          }
        }
        await db
          .update(schema.products)
          .set({
            title: input.title,
            description: input.description,
            priceCents: input.variants?.length
              ? Math.min(...input.variants.map(v => v.priceCents))
              : input.priceCents,
            shippingCents: input.shippingCents || 0,
            inventoryCount: input.variants?.length
              ? input.variants.reduce((sum, v) => sum + v.inventoryCount, 0)
              : input.inventoryCount,
            fulfillmentType: input.fulfillmentType,
            ...(input.imageUrl !== undefined
              ? { imageUrl: input.imageUrl }
              : {}),
            ...(input.isActive !== undefined
              ? { isActive: input.isActive ? 1 : 0 }
              : {}),
            updatedAt: new Date(),
          })
          .where(eq(schema.products.id, input.id));

        return { success: true };
      })
    ),

  updateVariant: protectedProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
        variantId: z.number().int().positive(),
        priceCents: z.number().int().positive(),
        inventoryCount: z.number().int().min(0).max(1000000),
      })
    )
    .mutation(async ({ ctx, input }) =>
      withDatabaseTransaction(async db => {
        const [product] = await db
          .select()
          .from(schema.products)
          .where(
            and(
              eq(schema.products.id, input.productId),
              eq(schema.products.artistId, ctx.user.id)
            )
          )
          .for("update");
        if (!product) throw new TRPCError({ code: "NOT_FOUND" });
        const [variant] = await db
          .select()
          .from(schema.productVariants)
          .where(
            and(
              eq(schema.productVariants.id, input.variantId),
              eq(schema.productVariants.productId, input.productId)
            )
          )
          .for("update");
        if (!variant) throw new TRPCError({ code: "NOT_FOUND" });
        await db
          .update(schema.productVariants)
          .set({
            priceCents: input.priceCents,
            inventoryCount: input.inventoryCount,
          })
          .where(eq(schema.productVariants.id, variant.id));
        await db.insert(schema.stockAdjustments).values({
          productId: product.id,
          variantId: variant.id,
          adjustment: input.inventoryCount - variant.inventoryCount,
          reason: "Manual variant inventory edit",
          referenceType: "manual",
          adjustedBy: ctx.user.id,
        });
        return { success: true };
      })
    ),

  /**
   * Public endpoint to fetch an artist's storefront (products + seminars)
   * Used by PublicStorefront.tsx
   */
  getArtistStorefront: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const merchantMatch = /^supplier-(\d+)$/.exec(input.slug);
      if (merchantMatch) {
        const merchant = await db.query.merchants.findFirst({
          where: eq(schema.merchants.id, Number(merchantMatch[1])),
        });
        if (!merchant || merchant.status !== "active") return null;
        const products = await db.query.products.findMany({
          where: and(
            eq(schema.products.artistId, merchant.userId),
            eq(schema.products.ownerType, "merchant"),
            eq(schema.products.isActive, 1)
          ),
          with: { variants: true },
        });
        return {
          artistId: merchant.userId,
          artistName: merchant.businessName,
          products,
          seminars: [],
          currency: merchant.country === "NZ" ? "NZD" : "AUD",
        };
      }
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
          eq(schema.products.ownerType, "artist"),
          eq(schema.products.isActive, 1)
        ),
        with: { variants: true },
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
        artistName:
          settings.businessName ||
          settings.displayName ||
          artist?.name ||
          "Artist",
        products,
        seminars: seminars.map(event => ({
          ...event,
          locationUrl: event.type === "virtual" ? null : event.locationUrl,
        })),
      };
    }),

  /**
   * Protected endpoint to fetch an artist's storefront by their ID
   * Used by ClientArtistCard.tsx for the embedded shop view
   */
  getStorefrontByArtistId: protectedProcedure
    .input(z.object({ artistId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      // Verify the artist exists
      const settings = await db.query.artistSettings.findFirst({
        where: eq(schema.artistSettings.userId, input.artistId),
      });

      if (!settings) return null;

      // Fetch active products
      const products = await db.query.products.findMany({
        where: and(
          eq(schema.products.artistId, input.artistId),
          eq(schema.products.ownerType, "artist"),
          eq(schema.products.isActive, 1)
        ),
        with: { variants: true },
      });

      // Fetch active seminars
      const seminars = await db.query.seminars.findMany({
        where: and(
          eq(schema.seminars.artistId, input.artistId),
          eq(schema.seminars.isActive, 1)
        ),
      });

      const artist = await db.query.users.findFirst({
        where: eq(schema.users.id, input.artistId),
      });

      return {
        artistId: input.artistId,
        artistName:
          settings.businessName ||
          settings.displayName ||
          artist?.name ||
          "Artist",
        artistSlug: settings.publicSlug || "",
        products,
        seminars: seminars.map(event => ({
          ...event,
          locationUrl: event.type === "virtual" ? null : event.locationUrl,
        })),
      };
    }),

  /**
   * Create a Stripe checkout session for a product
   */
  createStorefrontCheckout: publicProcedure
    .input(
      z.object({
        items: z
          .array(
            z.object({
              productId: z.number().int().positive(),
              variantId: z.number().int().positive().optional(),
              quantity: z.number().int().min(1).max(100),
            })
          )
          .min(1)
          .max(100),
        fulfillmentMethod: z.enum(["pickup", "delivery", "digital"]),
      })
    )
    .mutation(async ({ ctx, input }) =>
      withDatabaseTransaction(async db => {
        const identities = input.items.map(
          item => `${item.productId}:${item.variantId || 0}`
        );
        if (new Set(identities).size !== identities.length)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Combine duplicate cart items before checkout.",
          });
        const productIds = [
          ...new Set(input.items.map(item => item.productId)),
        ];
        const catalogue = await db.query.products.findMany({
          where: (table, { inArray }) => inArray(table.id, productIds),
          with: { variants: true },
        });
        if (catalogue.length !== productIds.length)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "A product is no longer available.",
          });
        const sellerId = catalogue[0].artistId;
        let subtotal = 0,
          shipping = 0;
        const enriched = input.items.map(item => {
          const product = catalogue.find(row => row.id === item.productId)!;
          const variant = item.variantId
            ? product.variants.find(row => row.id === item.variantId)
            : undefined;
          if (product.artistId !== sellerId || !product.isActive)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Choose available products from one store.",
            });
          if (
            (item.variantId && !variant) ||
            (!item.variantId && product.variants.length)
          )
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Choose an available product option.",
            });
          if (
            product.fulfillmentType !== input.fulfillmentMethod &&
            !(
              product.fulfillmentType === "both" &&
              ["pickup", "delivery"].includes(input.fulfillmentMethod)
            )
          )
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Choose a delivery method supported by every item.",
            });
          const price = variant?.priceCents ?? product.priceCents;
          if (price <= 0)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "This product is not available for checkout.",
            });
          subtotal += price * item.quantity;
          if (input.fulfillmentMethod === "delivery")
            shipping += (product.shippingCents || 0) * item.quantity;
          return {
            ...item,
            productName: variant
              ? `${product.title} — ${variant.name}`
              : product.title,
            priceCents: price,
          };
        });
        const seller = await storeSeller(db, sellerId);
        const fees = calculateTransactionFees(subtotal + shipping, seller.tier);
        const [insert] = await db.insert(schema.orders).values({
          artistId: sellerId,
          clientId: ctx.user?.id,
          currency: seller.currency,
          totalAmountCents: subtotal + shipping,
          platformFeeCents: fees.platformFeeCents,
          artistFeeCents: fees.artistFeeCents,
          shippingCostCents: shipping,
          status: "pending",
          fulfillmentMethod: input.fulfillmentMethod,
        });
        const orderId = insert.insertId;
        await db.insert(schema.orderItems).values(
          enriched.map(item => ({
            orderId,
            productId: item.productId,
            variantId: item.variantId,
            productName: item.productName,
            quantity: item.quantity,
            priceAtPurchaseCents: item.priceCents,
          }))
        );
        await changeOrderInventory(db, orderId, -1);
        const session = await createStorefrontCheckoutSession({
          orderId,
          items: enriched,
          artistName: seller.name,
          clientTotalCents: subtotal + shipping + fees.platformFeeCents,
          platformFeeCents: fees.platformFeeCents,
          artistFeeCents: fees.artistFeeCents,
          shippingCostCents: shipping,
          fulfillmentMethod: input.fulfillmentMethod,
          stripeConnectAccountId: seller.accountId,
          slug: seller.slug,
          currency: seller.currency,
          stockReserved: true,
        });
        await db
          .update(schema.orders)
          .set({ stripeCheckoutSessionId: session.sessionId })
          .where(eq(schema.orders.id, orderId));
        return {
          ...session,
          orderId,
          totalCents: subtotal + shipping + fees.platformFeeCents,
          currency: seller.currency,
        };
      })
    ),

  cancelStoreCheckout: publicProcedure
    .input(
      z.object({
        orderId: z.number().int().positive(),
        sessionId: z.string().startsWith("cs_").max(255),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const order = await db.query.orders.findFirst({
        where: and(
          eq(schema.orders.id, input.orderId),
          eq(schema.orders.stripeCheckoutSessionId, input.sessionId)
        ),
      });
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.status !== "pending")
        return { cancelled: order.status === "cancelled" };
      let session = await stripe.checkout.sessions.retrieve(input.sessionId);
      if (session.status === "open")
        session = await stripe.checkout.sessions.expire(input.sessionId);
      if (session.status !== "expired") return { cancelled: false };
      if (session.metadata?.stockReserved === "1")
        await withDatabaseTransaction(tx =>
          releaseExpiredStoreOrder(tx, input.orderId, input.sessionId)
        );
      return { cancelled: true };
    }),

  getPurchases: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const found = await db.query.orders.findMany({
      where: and(
        eq(schema.orders.clientId, ctx.user.id),
        ne(schema.orders.status, "pending")
      ),
      orderBy: desc(schema.orders.createdAt),
      limit: 100,
      with: { items: { with: { product: true, seminar: true } } },
    });
    return found.map(order => ({
      id: order.id,
      status: order.status,
      currency: order.currency,
      totalAmountCents: order.totalAmountCents,
      platformFeeCents: order.platformFeeCents,
      fulfillmentMethod: order.fulfillmentMethod,
      trackingNumber: order.trackingNumber,
      carrier: order.carrier,
      createdAt: order.createdAt,
      items: order.items.map(item => ({
        id: item.id,
        name:
          item.productName ||
          item.product?.title ||
          item.seminar?.title ||
          "Item",
        quantity: item.quantity,
        priceCents: item.priceAtPurchaseCents,
        eventAccess:
          ["paid", "fulfilled"].includes(order.status) && item.seminar
            ? {
                title: item.seminar.title,
                date: item.seminar.date,
                locationUrl: item.seminar.locationUrl,
                type: item.seminar.type,
              }
            : null,
      })),
    }));
  }),

  getOrderStatus: publicProcedure
    .input(
      z.object({
        orderId: z.number().int().positive(),
        sessionId: z.string().startsWith("cs_").max(255),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const order = await db.query.orders.findFirst({
        where: and(
          eq(schema.orders.id, input.orderId),
          eq(schema.orders.stripeCheckoutSessionId, input.sessionId)
        ),
      });
      if (!order)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order confirmation is not available for this checkout.",
        });
      const items = ["paid", "fulfilled"].includes(order.status)
        ? await db.query.orderItems.findMany({
            where: eq(schema.orderItems.orderId, order.id),
            with: { seminar: true },
          })
        : [];
      return {
        eventAccess: items.flatMap(item =>
          item.seminar
            ? [
                {
                  title: item.seminar.title,
                  date: item.seminar.date,
                  locationUrl: item.seminar.locationUrl,
                  type: item.seminar.type,
                },
              ]
            : []
        ),
        id: order.id,
        status: order.status,
        currency: order.currency,
        totalAmountCents: order.totalAmountCents,
        platformFeeCents: order.platformFeeCents,
      };
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
        capacity: z.number().int().min(1),
        priceCents: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      if (!["artist", "admin"].includes(ctx.user.role))
        throw new TRPCError({ code: "FORBIDDEN" });
      if (
        new Date(input.date) <= new Date() ||
        !Number.isFinite(new Date(input.date).getTime())
      )
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Choose a future event date.",
        });
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
      orders.map(async order => {
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

      if (input.status === "cancelled")
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Refund the payment through Stripe before cancelling a paid order.",
        });
      if (order.status !== "paid")
        throw new TRPCError({
          code: "CONFLICT",
          message: "Only a paid order can be marked fulfilled.",
        });
      await db
        .update(schema.orders)
        .set({
          status: input.status,
          updatedAt: new Date(),
        })
        .where(eq(schema.orders.id, input.orderId));

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
          eq(schema.seminars.isActive, 1)
        ),
        orderBy: [schema.seminars.date],
      });

      // Filter to upcoming only
      return seminars
        .filter(s => new Date(s.date) > now)
        .map(s => ({
          ...s,
          locationUrl: s.type === "virtual" ? null : s.locationUrl,
        }));
    }),

  /**
   * Create a Stripe checkout session for a seminar registration
   */
  createSeminarCheckout: publicProcedure
    .input(z.object({ seminarId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) =>
      withDatabaseTransaction(async db => {
        const seminar = await db.query.seminars.findFirst({
          where: eq(schema.seminars.id, input.seminarId),
        });
        if (
          !seminar ||
          !seminar.isActive ||
          new Date(seminar.date) <= new Date()
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This event is no longer available.",
          });
        const seller = await storeSeller(db, seminar.artistId);
        const fees = calculateTransactionFees(seminar.priceCents, seller.tier);
        const method = seminar.type === "virtual" ? "digital" : "pickup";
        const [insert] = await db.insert(schema.orders).values({
          artistId: seminar.artistId,
          clientId: ctx.user?.id,
          currency: seller.currency,
          totalAmountCents: seminar.priceCents,
          platformFeeCents: fees.platformFeeCents,
          artistFeeCents: fees.artistFeeCents,
          status: "pending",
          fulfillmentMethod: method,
        });
        const orderId = insert.insertId;
        await db.insert(schema.orderItems).values({
          orderId,
          seminarId: seminar.id,
          productName: seminar.title,
          quantity: 1,
          priceAtPurchaseCents: seminar.priceCents,
        });
        await changeOrderInventory(db, orderId, -1);
        const session = await createStorefrontCheckoutSession({
          orderId,
          items: [
            {
              productId: seminar.id,
              productName: seminar.title,
              priceCents: seminar.priceCents,
              quantity: 1,
            },
          ],
          artistName: seller.name,
          clientTotalCents: seminar.priceCents + fees.platformFeeCents,
          platformFeeCents: fees.platformFeeCents,
          artistFeeCents: fees.artistFeeCents,
          shippingCostCents: 0,
          fulfillmentMethod: method,
          stripeConnectAccountId: seller.accountId,
          slug: seller.slug,
          currency: seller.currency,
          stockReserved: true,
          returnPath: `/events/${seller.slug}`,
        });
        await db
          .update(schema.orders)
          .set({ stripeCheckoutSessionId: session.sessionId })
          .where(eq(schema.orders.id, orderId));
        return {
          ...session,
          orderId,
          totalCents: seminar.priceCents + fees.platformFeeCents,
        };
      })
    ),
});

async function storeSeller(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  sellerId: string
) {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, sellerId),
  });
  if (user?.role === "merchant") {
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.userId, sellerId),
    });
    if (!merchant?.stripeAccountId || merchant.status !== "active")
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "This store is not ready to accept payments.",
      });
    return {
      accountId: merchant.stripeAccountId,
      name: merchant.businessName,
      slug: `supplier-${merchant.id}`,
      currency: merchant.country === "NZ" ? "nzd" : "aud",
      tier: "free" as const,
    };
  }
  const settings = await db.query.artistSettings.findFirst({
    where: eq(schema.artistSettings.userId, sellerId),
  });
  if (
    !settings?.stripeConnectAccountId ||
    !settings.stripeConnectOnboardingComplete
  )
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This artist has not finished payment setup.",
    });
  return {
    accountId: settings.stripeConnectAccountId,
    name: settings.displayName || user?.name || "Artist",
    slug: settings.publicSlug || "shop",
    currency: "aud",
    tier: await effectivePaymentTier(settings),
  };
}
