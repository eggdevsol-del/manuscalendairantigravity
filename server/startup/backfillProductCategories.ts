/**
 * backfillProductCategories.ts — One-time startup task
 * ─────────────────────────────────────────────────────────
 * Store products imported before categories were saved get their Shopify product type.
 * Idempotent — only products whose category is still null are touched, and each is set once:
 * to the store's product type, or "" when the store gives none or no longer lists the product.
 */

import { and, eq, isNull, like } from "drizzle-orm";
import { getDb } from "../db";
import { products } from "../../drizzle/schema";
import { runStoreScraper } from "../services/scraper";

export async function backfillProductCategories() {
  const db = await getDb();
  if (!db) return;
  const rows = await db
    .select({ id: products.id, externalId: products.externalId })
    .from(products)
    .where(
      and(
        eq(products.ownerType, "merchant"),
        isNull(products.category),
        like(products.externalId, "store:%")
      )
    );
  // Imported ids are "store:<source>:<Shopify product id>".
  const bySource = new Map<string, { id: number; productId: string }[]>();
  for (const row of rows) {
    const id = row.externalId!;
    const cut = id.lastIndexOf(":");
    const source = id.slice("store:".length, cut);
    if (!source || cut < 0) continue;
    bySource.set(source, [
      ...(bySource.get(source) || []),
      { id: row.id, productId: id.slice(cut + 1) },
    ]);
  }
  for (const [source, list] of bySource) {
    try {
      const { allProducts } = await runStoreScraper(source);
      const types = new Map(
        allProducts.map((p: any) => [
          String(p.id),
          String(p.product_type ?? "").trim().slice(0, 255),
        ])
      );
      for (const item of list)
        await db
          .update(products)
          .set({ category: types.get(item.productId) ?? "" })
          .where(and(eq(products.id, item.id), isNull(products.category)));
      console.info(
        `[Backfill] Product categories set for ${list.length} products from ${source}.`
      );
    } catch (err) {
      // Left null, so the next start tries this store again.
      console.error(`[Backfill] Product categories from ${source} failed:`, err);
    }
  }
}
