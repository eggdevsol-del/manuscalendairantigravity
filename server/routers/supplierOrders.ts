import { effectivePaymentTier } from "../services/paymentEntitlements";
/**
 * Supplier Orders Router
 *
 * Handles the checkout flow for artists ordering from suppliers.
 * - createSupplierCheckout: validates cart → calculates fees → creates Stripe session
 * - confirmSupplierOrder: reports webhook-confirmed payment state
 * - getSupplierOrders: order history for the artist
 * - getShippingRates: returns applicable shipping rates for a supplier + country
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, and, desc, inArray } from "drizzle-orm";
import * as schema from "../../drizzle/schema";
import { calculateTransactionFees, resolvePaymentTier } from "../domain/fees";
import {
  createSupplierCheckoutSession,
  getOrCreateStripeCustomer,
} from "../services/stripe";
import {
  getExchangeRate,
  convertCents,
  currencyForCountry,
} from "../services/exchangeRate";

export const supplierOrdersRouter = router({
  /**
   * Get shipping rates for a supplier, filtered by artist's country.
   */
  getShippingRates: protectedProcedure
    .input(z.object({ supplierId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      // Get artist's country
      const settings = await db.query.artistSettings.findFirst({
        where: eq(schema.artistSettings.userId, ctx.user.id),
      });
      const artistCountry = settings?.businessCountry || "AU";

      // Get shipping zones for this supplier
      const zones = await db.query.supplierShippingZones.findMany({
        where: eq(schema.supplierShippingZones.supplierId, input.supplierId),
        with: { rates: true },
      });

      // Find zones that include the artist's country
      const matchingRates: {
        name: string;
        priceCents: number;
        currency: string;
        minOrderSubtotalCents: number | null;
        maxOrderSubtotalCents: number | null;
      }[] = [];

      for (const zone of zones) {
        const countryCodes = JSON.parse(zone.countryCodes || "[]");
        if (
          countryCodes.includes(artistCountry) ||
          countryCodes.includes("*")
        ) {
          for (const rate of zone.rates) {
            matchingRates.push({
              name: rate.name,
              priceCents: rate.priceCents,
              currency: rate.currency || "AUD",
              minOrderSubtotalCents: rate.minOrderSubtotalCents,
              maxOrderSubtotalCents: rate.maxOrderSubtotalCents,
            });
          }
        }
      }

      return {
        rates: matchingRates,
        artistCountry,
        artistCurrency: currencyForCountry(artistCountry),
      };
    }),

  /**
   * Create a checkout session for a supplier order.
   */
  createSupplierCheckout: protectedProcedure
    .input(
      z.object({
        supplierId: z.number(),
        items: z
          .array(
            z.object({
              productId: z.number(),
              variantId: z.number(),
              quantity: z.number().min(1),
            })
          )
          .min(1),
        shippingRateName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      // 1. Get supplier info
      const supplier = await db.query.suppliers.findFirst({
        where: eq(schema.suppliers.id, input.supplierId),
      });
      if (!supplier) throw new Error("Supplier not found");

      const supplierCurrency = supplier.currency || "AUD";

      // 2. Get artist info
      const [artistSettings, artistUser] = await Promise.all([
        db.query.artistSettings.findFirst({
          where: eq(schema.artistSettings.userId, ctx.user.id),
        }),
        db.query.users.findFirst({
          where: eq(schema.users.id, ctx.user.id),
        }),
      ]);

      if (!artistSettings || !artistUser) throw new Error("Artist not found");

      const artistCountry = artistSettings.businessCountry || "AU";
      const artistCurrency = currencyForCountry(artistCountry);

      // 3. Validate all items and calculate subtotal (in supplier currency)
      const variantIds = input.items.map(i => i.variantId);
      const variants = await db.query.supplierProductVariants.findMany({
        where: inArray(schema.supplierProductVariants.id, variantIds),
        with: { product: true },
      });

      if (variants.length !== input.items.length) {
        throw new Error("One or more items could not be found.");
      }

      let subtotalSupplierCents = 0;
      const enrichedItems: {
        supplierProductId: number;
        variantId: number;
        productTitle: string;
        variantTitle: string;
        quantity: number;
        priceCents: number;
        shopifyVariantId: string | null;
      }[] = [];

      for (const item of input.items) {
        const variant = variants.find(v => v.id === item.variantId);
        if (!variant) throw new Error(`Variant ${item.variantId} not found`);

        if (variant.inventoryCount < item.quantity) {
          throw new Error(
            `"${variant.product.title}" is out of stock or insufficient quantity.`
          );
        }

        const lineTotalCents = variant.priceCents * item.quantity;
        subtotalSupplierCents += lineTotalCents;

        enrichedItems.push({
          supplierProductId: variant.product.id,
          variantId: variant.id,
          productTitle: variant.product.title,
          variantTitle: variant.title,
          quantity: item.quantity,
          priceCents: variant.priceCents,
          shopifyVariantId: variant.shopifyVariantId,
        });
      }

      // 4. Currency conversion: supplier → artist
      const exchangeRate = await getExchangeRate(
        supplierCurrency,
        artistCurrency
      );
      const subtotalArtistCents = Math.round(
        subtotalSupplierCents * exchangeRate
      );

      // 5. Calculate platform fee on the artist-currency subtotal
      const tier = await effectivePaymentTier(artistSettings);
      const fees = calculateTransactionFees(subtotalArtistCents, tier);

      // 6. Resolve shipping (in supplier currency → convert)
      let shippingSupplierCents = 0;
      if (input.shippingRateName) {
        const zones = await db.query.supplierShippingZones.findMany({
          where: eq(schema.supplierShippingZones.supplierId, input.supplierId),
          with: { rates: true },
        });

        for (const zone of zones) {
          const countryCodes = JSON.parse(zone.countryCodes || "[]");
          if (
            countryCodes.includes(artistCountry) ||
            countryCodes.includes("*")
          ) {
            const matchingRate = zone.rates.find(
              r => r.name === input.shippingRateName
            );
            if (matchingRate) {
              shippingSupplierCents = matchingRate.priceCents;
              break;
            }
          }
        }
      }

      const shippingArtistCents = Math.round(
        shippingSupplierCents * exchangeRate
      );

      // 7. Total in artist currency
      const totalCents =
        subtotalArtistCents + fees.platformFeeCents + shippingArtistCents;

      // 8. Get or create Stripe customer
      const stripeCustomerId = await getOrCreateStripeCustomer(
        ctx.user.id,
        artistUser.email || "",
        artistUser.name || ""
      );

      // 9. Create order record
      const [orderResult] = await db.insert(schema.supplierOrders).values({
        artistId: ctx.user.id,
        supplierId: input.supplierId,
        subtotalCents: subtotalArtistCents,
        platformFeeCents: fees.platformFeeCents,
        shippingCents: shippingArtistCents,
        totalCents,
        currency: artistCurrency,
        status: "pending",
      });

      const orderId = orderResult.insertId;

      // 10. Create order items (store prices in artist currency for display)
      for (const item of enrichedItems) {
        const convertedPrice = Math.round(item.priceCents * exchangeRate);
        await db.insert(schema.supplierOrderItems).values({
          orderId,
          supplierProductId: item.supplierProductId,
          variantId: item.variantId,
          productTitle: item.productTitle,
          variantTitle: item.variantTitle,
          quantity: item.quantity,
          priceCents: convertedPrice,
          shopifyVariantId: item.shopifyVariantId,
        });
      }

      // 11. Create Stripe checkout session
      const sessionResult = await createSupplierCheckoutSession({
        orderId,
        items: enrichedItems.map(item => ({
          productTitle: item.productTitle,
          variantTitle: item.variantTitle,
          priceCents: Math.round(item.priceCents * exchangeRate),
          quantity: item.quantity,
        })),
        supplierName: supplier.name,
        subtotalCents: subtotalArtistCents,
        platformFeeCents: fees.platformFeeCents,
        shippingCents: shippingArtistCents,
        totalCents,
        currency: artistCurrency,
        stripeCustomerId,
        artistEmail: artistUser.email || "",
      });

      await db
        .update(schema.supplierOrders)
        .set({ stripeCheckoutSessionId: sessionResult.sessionId })
        .where(eq(schema.supplierOrders.id, orderId));

      if (!sessionResult.clientSecret) {
        throw new Error("Failed to create checkout session");
      }

      return {
        clientSecret: sessionResult.clientSecret,
        orderId,
        subtotalCents: subtotalArtistCents,
        platformFeeCents: fees.platformFeeCents,
        shippingCents: shippingArtistCents,
        totalCents,
        currency: artistCurrency,
        exchangeRate,
        supplierCurrency,
      };
    }),

  // Payment and fulfilment writes belong to the signed webhook transaction.
  getSupplierOrderStatus: protectedProcedure
    .input(z.object({ orderId: z.number().int().positive() }))
    .query(({ ctx, input }) =>
      readSupplierOrderStatus(ctx.user.id, input.orderId)
    ),
  confirmSupplierOrder: protectedProcedure
    .input(
      z.object({
        orderId: z.number().int().positive(),
        stripeSessionId: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      readSupplierOrderStatus(ctx.user.id, input.orderId)
    ),

  /**
   * Get the artist's supplier order history.
   */
  getSupplierOrders: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    return db.query.supplierOrders.findMany({
      where: eq(schema.supplierOrders.artistId, ctx.user.id),
      with: {
        supplier: true,
        items: true,
      },
      orderBy: [desc(schema.supplierOrders.createdAt)],
    });
  }),
});

async function readSupplierOrderStatus(artistId: string, orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const order = await db.query.supplierOrders.findFirst({
    where: and(
      eq(schema.supplierOrders.id, orderId),
      eq(schema.supplierOrders.artistId, artistId)
    ),
  });
  if (!order) throw new Error("Order not found");
  return {
    success: order.status === "paid",
    status: order.status,
    shopifyDraftOrderId: order.shopifyDraftOrderId,
    shopifyDraftOrderName: order.shopifyDraftOrderName,
  };
}
