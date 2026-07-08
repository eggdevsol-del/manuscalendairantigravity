import { getDb } from "../db";
import * as schema from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { translateShopifyToTattoi } from "../utils/shopifyTranslator";

// Reuse the existing sync status map from the scraper so the UI works exactly the same
import { syncStatusMap } from "./scraper";

/**
 * Sync inventory from Shopify Admin API using a Custom App Access Token.
 */
export async function syncInventoryFromAdmin(merchantId: number, userId: string, shopDomain: string, accessToken: string) {
  try {
    syncStatusMap.set(merchantId, { status: "syncing", count: 0, message: "Authenticating with Shopify Admin API..." });

    // 1. Sanitize the shop domain
    let baseUrl = shopDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!baseUrl.includes('.myshopify.com')) {
      // Allow users to just type 'mystore', auto-append .myshopify.com
      if (!baseUrl.includes('.')) {
        baseUrl = `${baseUrl}.myshopify.com`;
      }
    }

    // 2. Fetch from Shopify Admin API
    const MAX_PAGES = 10;
    let allProducts: any[] = [];
    let nextPageUrl: string | null = `https://${baseUrl}/admin/api/2024-01/products.json?limit=250`;

    syncStatusMap.set(merchantId, { status: "syncing", count: 0, message: "Downloading master inventory ledger..." });

    while (nextPageUrl) {
      const response = await fetch(nextPageUrl, {
        signal: AbortSignal.timeout(15000),
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error("Invalid Shopify Access Token. Please verify your permissions.");
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Shopify API Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      if (data && data.products) {
        allProducts = allProducts.concat(data.products);
      }

      // Check pagination (Shopify uses Link headers for cursor-based pagination)
      const linkHeader: string | null = response.headers.get('Link');
      nextPageUrl = null;
      if (linkHeader) {
        const links: string[] = linkHeader.split(',').map((a: string) => a.trim());
        for (const link of links) {
          const match: RegExpMatchArray | null = link.match(/<([^>]+)>;\s*rel="next"/);
          if (match && match[1]) {
            nextPageUrl = match[1];
            break;
          }
        }
      }
      
      if (allProducts.length > MAX_PAGES * 250) break; // Safety cap
    }

    if (allProducts.length === 0) {
      syncStatusMap.set(merchantId, { status: "complete", count: 0, message: "No products found in Shopify store." });
      return;
    }

    // 3. Map and Insert Products
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    syncStatusMap.set(merchantId, { status: "syncing", count: allProducts.length, message: `Rebuilding local ledger with ${allProducts.length} items...` });

    // Execute within a transaction for safety? We can do them individually to avoid massive locking
    for (let i = 0; i < allProducts.length; i++) {
      if (i % 10 === 0) {
         syncStatusMap.set(merchantId, { status: "syncing", count: allProducts.length, message: `Syncing items to database (${i}/${allProducts.length})...` });
      }
      
      const p = allProducts[i];
      const { masterProduct, variantsToInsert } = translateShopifyToTattoi(p, userId);

      // We should technically check if it exists (Upsert). For now, we assume it's a fresh import or we delete existing.
      // Since this is a manual triggered sync, we will delete the existing products for this merchant first.
      if (i === 0) {
         syncStatusMap.set(merchantId, { status: "syncing", count: allProducts.length, message: `Clearing old catalog...` });
         await db.delete(schema.products).where(eq(schema.products.artistId, userId));
      }

      const [insertRes] = await db.insert(schema.products).values(masterProduct);
      const productId = insertRes.insertId;

      if (variantsToInsert && variantsToInsert.length > 0) {
        // Map the correct productId to the variants before insertion
        const mappedVariants = variantsToInsert.map(v => ({ ...v, productId }));
        await db.insert(schema.productVariants).values(mappedVariants);
      }
    }

    syncStatusMap.set(merchantId, { status: "complete", count: allProducts.length, message: "Inventory successfully synced." });

  } catch (error: any) {
    console.error("Shopify Admin API Sync failed:", error);
    syncStatusMap.set(merchantId, { status: "failed", count: 0, error: error.message || "Unknown error occurred" });
  }
}
