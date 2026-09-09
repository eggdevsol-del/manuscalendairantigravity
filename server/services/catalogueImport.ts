import { and, eq } from "drizzle-orm";
import { merchants, products, productVariants } from "../../drizzle/schema";
import { withDatabaseTransaction } from "./core";
import {
  translateShopifyToTattoi,
  type ScrapedProduct,
} from "../utils/shopifyTranslator";
export type ImportedProduct = ScrapedProduct & {
  id: string | number;
  variants?: (NonNullable<ScrapedProduct["variants"]>[number] & {
    id: string | number;
  })[];
};
/** Stable source IDs preserve cart/order references. Unpublished and manual products stay untouched. */
export async function importCatalogue(
  merchantId: number,
  userId: string,
  sourceHost: string,
  incoming: ImportedProduct[]
) {
  if (incoming.length > 2500) throw new Error("Import exceeds 2,500 products.");
  const prefix = `store:${sourceHost.toLowerCase()}:`;
  if (prefix.length > 200) throw new Error("Store hostname is too long.");
  const seen = new Set<string>();
  await withDatabaseTransaction(async db => {
    const [merchant] = await db
      .select()
      .from(merchants)
      .where(and(eq(merchants.id, merchantId), eq(merchants.userId, userId)))
      .for("update");
    if (!merchant) throw new Error("Merchant not found.");
    const existing = await db.query.products.findMany({
      where: and(
        eq(products.artistId, userId),
        eq(products.ownerType, "merchant")
      ),
      with: { variants: true },
    });
    for (const raw of incoming) {
      if (!raw.id || !raw.variants?.length || raw.variants.length > 250)
        throw new Error("Product import is missing its identity or variants.");
      const externalId = prefix + String(raw.id);
      if (externalId.length > 255)
        throw new Error("Product identity is too long.");
      if (seen.has(externalId))
        throw new Error("Duplicate product in store response.");
      seen.add(externalId);
      for (const variant of raw.variants) {
        if (
          !variant.id ||
          String(variant.id).length > 255 ||
          !Number.isFinite(Number(variant.price)) ||
          Number(variant.price) < 0 ||
          Number(variant.price) > 1000000 ||
          (variant.inventory_quantity !== undefined &&
            (!Number.isSafeInteger(variant.inventory_quantity) ||
              variant.inventory_quantity < 0 ||
              variant.inventory_quantity > 1000000))
        )
          throw new Error("Product has an invalid variant or price.");
      }
      const translated = translateShopifyToTattoi(raw, userId);
      const product = existing.find(item => item.externalId === externalId);
      const totalStock = translated.variantsToInsert.reduce(
        (sum, item) => sum + Math.max(0, item.inventoryCount),
        0
      );
      const values = {
        ...translated.masterProduct,
        externalId,
        inventoryCount: totalStock,
        fulfillmentType: "delivery" as const,
      };
      let productId: number;
      if (product) {
        productId = product.id;
        await db
          .update(products)
          .set({
            ...values,
            inventoryCount: product.inventoryCount,
            isActive: product.isActive,
            fulfillmentType: product.fulfillmentType,
            updatedAt: new Date(),
          })
          .where(eq(products.id, productId));
      } else {
        const [row] = await db.insert(products).values(values);
        productId = row.insertId;
      }
      const variantIds = new Set<string>();
      for (let i = 0; i < raw.variants.length; i++) {
        const variantId = String(raw.variants[i].id);
        if (variantIds.has(variantId))
          throw new Error("Duplicate variant in store response.");
        variantIds.add(variantId);
        const old = product?.variants.find(
          item => item.externalId === variantId
        );
        const values = {
          ...translated.variantsToInsert[i],
          inventoryCount: Math.max(
            0,
            translated.variantsToInsert[i].inventoryCount
          ),
          externalId: variantId,
          productId,
        };
        // Tattoi stock is a separate allocation: re-imports must not replenish sold or reserved units.
        if (old)
          await db
            .update(productVariants)
            .set({ ...values, inventoryCount: undefined })
            .where(eq(productVariants.id, old.id));
        else await db.insert(productVariants).values(values);
      }
      // Retain discontinued options and their local stock allocation for fulfilment/history.
    }
    // Only this source's missing items are unpublished; never delete historical order identities.
    for (const old of existing)
      if (old.externalId?.startsWith(prefix) && !seen.has(old.externalId))
        await db
          .update(products)
          .set({ isActive: 0 })
          .where(eq(products.id, old.id));
  });
  return incoming.length;
}
