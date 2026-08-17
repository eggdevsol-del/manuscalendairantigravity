import { getDb } from "../db";
import * as schema from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { translateShopifyToTattoi } from "../utils/shopifyTranslator";

// Reuse the existing sync status map from the scraper so the UI works exactly the same
import { syncStatusMap } from "./scraper";

// ── Helpers ──────────────────────────────────────────────────

/** Sanitize a Shopify domain to a clean base URL */
function sanitizeShopDomain(shopDomain: string): string {
  let baseUrl = shopDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!baseUrl.includes('.myshopify.com')) {
    if (!baseUrl.includes('.')) {
      baseUrl = `${baseUrl}.myshopify.com`;
    }
  }
  return baseUrl;
}

/** Make an authenticated request to Shopify Admin API */
async function shopifyAdminFetch(baseUrl: string, accessToken: string, path: string): Promise<any> {
  const url = `https://${baseUrl}/admin/api/2024-01/${path}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("Invalid Shopify Access Token. Please verify your permissions.");
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Shopify API Error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// ── Inventory Sync ───────────────────────────────────────────

/**
 * Sync inventory from Shopify Admin API using a Custom App Access Token.
 */
export async function syncInventoryFromAdmin(merchantId: number, userId: string, shopDomain: string, accessToken: string) {
  try {
    syncStatusMap.set(merchantId, { status: "syncing", count: 0, message: "Authenticating with Shopify Admin API..." });

    const baseUrl = sanitizeShopDomain(shopDomain);

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
      
      if (allProducts.length > MAX_PAGES * 250) break;
    }

    if (allProducts.length === 0) {
      syncStatusMap.set(merchantId, { status: "complete", count: 0, message: "No products found in Shopify store." });
      return;
    }

    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    syncStatusMap.set(merchantId, { status: "syncing", count: allProducts.length, message: `Rebuilding local ledger with ${allProducts.length} items...` });

    for (let i = 0; i < allProducts.length; i++) {
      if (i % 10 === 0) {
         syncStatusMap.set(merchantId, { status: "syncing", count: allProducts.length, message: `Syncing items to database (${i}/${allProducts.length})...` });
      }
      
      const p = allProducts[i];
      const { masterProduct, variantsToInsert } = translateShopifyToTattoi(p, userId);

      if (i === 0) {
         syncStatusMap.set(merchantId, { status: "syncing", count: allProducts.length, message: `Clearing old catalog...` });
         await db.delete(schema.products).where(eq(schema.products.artistId, userId));
      }

      const [insertRes] = await db.insert(schema.products).values(masterProduct);
      const productId = insertRes.insertId;

      if (variantsToInsert && variantsToInsert.length > 0) {
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

// ── Shipping Zones Sync ──────────────────────────────────────

/**
 * Sync shipping zones and rates from a Shopify store.
 * Called after product sync or on storefront open.
 */
export async function syncShippingZones(
  supplierId: number,
  shopDomain: string,
  accessToken: string
): Promise<void> {
  try {
    const baseUrl = sanitizeShopDomain(shopDomain);
    const data = await shopifyAdminFetch(baseUrl, accessToken, 'shipping_zones.json');

    if (!data?.shipping_zones?.length) return;

    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    // Clear existing zones for this supplier
    await db.delete(schema.supplierShippingZones)
      .where(eq(schema.supplierShippingZones.supplierId, supplierId));

    for (const zone of data.shipping_zones) {
      const countryCodes: string[] = (zone.countries || []).map((c: any) => c.code);
      if (countryCodes.length === 0) continue;

      const [zoneResult] = await db.insert(schema.supplierShippingZones).values({
        supplierId,
        name: zone.name || "Default",
        countryCodes: JSON.stringify(countryCodes),
      });
      const zoneId = zoneResult.insertId;

      // Price-based shipping rates
      const priceRates = zone.price_based_shipping_rates || [];
      for (const rate of priceRates) {
        const priceDollars = parseFloat(rate.price || "0");
        const minSubtotalDollars = parseFloat(rate.min_order_subtotal || "0");
        const maxSubtotalDollars = rate.max_order_subtotal ? parseFloat(rate.max_order_subtotal) : null;

        await db.insert(schema.supplierShippingRates).values({
          zoneId,
          name: rate.name || "Shipping",
          priceCents: Math.round(priceDollars * 100),
          minOrderSubtotalCents: Math.round(minSubtotalDollars * 100),
          maxOrderSubtotalCents: maxSubtotalDollars ? Math.round(maxSubtotalDollars * 100) : null,
          rateType: "price_based",
        });
      }

      // Weight-based shipping rates
      const weightRates = zone.weight_based_shipping_rates || [];
      for (const rate of weightRates) {
        const priceDollars = parseFloat(rate.price || "0");
        await db.insert(schema.supplierShippingRates).values({
          zoneId,
          name: rate.name || "Shipping",
          priceCents: Math.round(priceDollars * 100),
          rateType: "weight_based",
        });
      }
    }

    console.log(`[ShippingSync] Synced ${data.shipping_zones.length} zones for supplier ${supplierId}`);
  } catch (error: any) {
    console.error(`[ShippingSync] Failed for supplier ${supplierId}:`, error.message);
  }
}

// ── Shop Currency Sync ───────────────────────────────────────

/**
 * Fetch the shop's base currency and update the supplier record.
 */
export async function syncShopCurrency(
  supplierId: number,
  shopDomain: string,
  accessToken: string
): Promise<string | null> {
  try {
    const baseUrl = sanitizeShopDomain(shopDomain);
    const data = await shopifyAdminFetch(baseUrl, accessToken, 'shop.json');

    const currency = data?.shop?.currency;
    if (!currency) return null;

    const db = await getDb();
    if (!db) return null;

    await db.update(schema.suppliers)
      .set({ currency })
      .where(eq(schema.suppliers.id, supplierId));

    console.log(`[CurrencySync] Supplier ${supplierId} currency set to ${currency}`);
    return currency;
  } catch (error: any) {
    console.error(`[CurrencySync] Failed for supplier ${supplierId}:`, error.message);
    return null;
  }
}

// ── Shopify Draft Order Creation ─────────────────────────────

/**
 * Create a draft order on the supplier's Shopify store.
 * Called after successful payment via DOTS.
 */
export async function createShopifyDraftOrder(
  shopDomain: string,
  accessToken: string,
  order: {
    lineItems: { shopifyVariantId: string; quantity: number }[];
    shippingAddress?: {
      first_name: string;
      last_name: string;
      address1: string;
      address2?: string;
      city: string;
      province: string;
      zip: string;
      country: string;
    };
    note: string;
    email?: string;
  }
): Promise<{ draftOrderId: string; draftOrderName: string }> {
  const baseUrl = sanitizeShopDomain(shopDomain);

  const body: any = {
    draft_order: {
      line_items: order.lineItems.map(item => ({
        variant_id: parseInt(item.shopifyVariantId, 10),
        quantity: item.quantity,
      })),
      note: order.note,
      tags: "d.o.t.s,marketplace-order",
    },
  };

  if (order.shippingAddress) {
    body.draft_order.shipping_address = order.shippingAddress;
  }

  if (order.email) {
    body.draft_order.email = order.email;
  }

  const response = await fetch(`https://${baseUrl}/admin/api/2024-01/draft_orders.json`, {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Shopify Draft Order Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const draftOrder = data.draft_order;

  return {
    draftOrderId: String(draftOrder.id),
    draftOrderName: draftOrder.name || `#D${draftOrder.id}`,
  };
}
