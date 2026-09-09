import { z } from "zod";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { withDatabaseTransaction } from "../services/core";
import { runStoreScraper } from "../services/scraper";
import * as schema from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { publicStoreFetch, parseStoreUrl } from "../services/publicStoreFetch";

export const suppliersRouter = router({
  /**
   * Scrapes a Shopify store and adds its products to the suppliers directory.
   */
  scrapeShopifyStore: adminProcedure
    .input(z.object({ storeUrl: z.string().min(1, "Store URL is required") }))
    .mutation(async ({ input }) => {
      const { allProducts, baseUrl, storeName, logoUrl } =
        await runStoreScraper(input.storeUrl);
      return withDatabaseTransaction(async db => {
        // Save or Update Supplier
        const existingSupplier = await db.query.suppliers.findFirst({
          where: eq(schema.suppliers.websiteUrl, baseUrl),
        });

        let supplierId: number;

        if (existingSupplier) {
          await db
            .select({ id: schema.suppliers.id })
            .from(schema.suppliers)
            .where(eq(schema.suppliers.id, existingSupplier.id))
            .for("update");
          if (existingSupplier.merchantId)
            throw new Error(
              "This store is managed by its merchant. Use its authenticated catalogue connection."
            );
          supplierId = existingSupplier.id;
          await db
            .update(schema.suppliers)
            .set({ name: storeName, logoUrl })
            .where(eq(schema.suppliers.id, supplierId));
        } else {
          const [supplierResult] = await db.insert(schema.suppliers).values({
            name: storeName,
            websiteUrl: baseUrl,
            logoUrl,
          });
          supplierId = supplierResult.insertId;
        }

        // Upsert Products (preserves DB IDs for stable cart references)
        const existingProducts = existingSupplier
          ? await db.query.supplierProducts.findMany({
              where: eq(schema.supplierProducts.supplierId, supplierId),
              with: { variants: true },
            })
          : [];

        const seenProductIds = new Set<number>();

        for (const p of allProducts) {
          const imageUrl =
            p.images && p.images.length > 0 ? p.images[0].src : null;
          const description = p.body_html
            ? p.body_html.replace(/<[^>]*>?/gm, "")
            : null;
          const shopifyProductId = p.id.toString();

          const existing = existingProducts.find(
            ep => ep.shopifyProductId === shopifyProductId
          );

          let productId: number;

          if (existing) {
            // Update existing product in-place
            productId = existing.id;
            await db
              .update(schema.supplierProducts)
              .set({
                title: p.title,
                description,
                imageUrl,
                category: p.product_type,
              })
              .where(eq(schema.supplierProducts.id, productId));
          } else {
            // Insert new product
            const [result] = await db.insert(schema.supplierProducts).values({
              supplierId,
              title: p.title,
              description,
              imageUrl,
              shopifyProductId,
              category: p.product_type,
            });
            productId = result.insertId;
          }

          seenProductIds.add(productId);

          // Upsert variants for this product
          const existingVariants = existing?.variants || [];
          const seenVariantIds = new Set<number>();

          if (p.variants && p.variants.length > 0) {
            for (const v of p.variants) {
              const priceVal = Number(v.price);
              if (
                !v.id ||
                !Number.isFinite(priceVal) ||
                priceVal < 0 ||
                priceVal > 1000000
              )
                throw new Error("Invalid catalogue variant.");
              const shopifyVariantId = v.id.toString();
              const existingVariant = existingVariants.find(
                (ev: any) => ev.shopifyVariantId === shopifyVariantId
              );

              if (existingVariant) {
                // Update in-place — keeps the same DB ID
                await db
                  .update(schema.supplierProductVariants)
                  .set({
                    title: v.title || "Default",
                    priceCents: Math.round(priceVal * 100),
                    sku: v.sku || null,
                    inventoryCount:
                      v.inventory_quantity !== undefined
                        ? v.inventory_quantity
                        : v.available
                          ? 1
                          : 0,
                  })
                  .where(
                    eq(schema.supplierProductVariants.id, existingVariant.id)
                  );
                seenVariantIds.add(existingVariant.id);
              } else {
                // Insert new variant
                const [result] = await db
                  .insert(schema.supplierProductVariants)
                  .values({
                    supplierProductId: productId,
                    title: v.title || "Default",
                    priceCents: Math.round(priceVal * 100),
                    sku: v.sku || null,
                    inventoryCount:
                      v.inventory_quantity !== undefined
                        ? v.inventory_quantity
                        : v.available
                          ? 1
                          : 0,
                    shopifyVariantId,
                  });
                seenVariantIds.add(result.insertId);
              }
            }
          }

          // Remove variants that no longer exist in Shopify
          for (const ev of existingVariants) {
            if (!seenVariantIds.has(ev.id)) {
              await db
                .update(schema.supplierProductVariants)
                .set({ inventoryCount: 0 })
                .where(eq(schema.supplierProductVariants.id, ev.id));
            }
          }
        }

        // Remove products that no longer exist in Shopify
        for (const ep of existingProducts) {
          if (!seenProductIds.has(ep.id)) {
            await db
              .update(schema.supplierProductVariants)
              .set({ inventoryCount: 0 })
              .where(
                eq(schema.supplierProductVariants.supplierProductId, ep.id)
              );
          }
        }

        return {
          success: true,
          supplierId,
          productCount: allProducts.length,
          name: storeName,
        };
      });
    }),

  getSuppliers: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    return db.query.suppliers.findMany({
      orderBy: (suppliers, { desc }) => [desc(suppliers.createdAt)],
    });
  }),

  deleteSupplier: adminProcedure
    .input(z.object({ supplierId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      await db
        .delete(schema.suppliers)
        .where(eq(schema.suppliers.id, input.supplierId));
      return { success: true };
    }),

  getSupplier: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      return db.query.suppliers.findFirst({
        where: eq(schema.suppliers.id, input.id),
      });
    }),

  getSupplierProducts: protectedProcedure
    .input(z.object({ supplierId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      return db.query.supplierProducts.findMany({
        where: eq(schema.supplierProducts.supplierId, input.supplierId),
        with: {
          variants: true,
        },
      });
    }),
});
