import { importCatalogue } from "./catalogueImport";
import { getDb } from "../db";
import * as schema from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { translateShopifyToTattoi } from "../utils/shopifyTranslator";

// Reuse the existing sync status map from the scraper so the UI works exactly the same
import { syncStatusMap } from "./scraper";

// ── Helpers ──────────────────────────────────────────────────

/** Sanitize a Shopify domain to a clean base URL */
export function sanitizeShopDomain(shopDomain: string): string {
  let baseUrl = shopDomain
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (!baseUrl.includes(".myshopify.com")) {
    if (!baseUrl.includes(".")) {
      baseUrl = `${baseUrl}.myshopify.com`;
    }
  }
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(baseUrl))
    throw new Error("Use the store’s myshopify.com domain.");
  return baseUrl;
}

/** Make an authenticated request to Shopify Admin API */
async function shopifyAdminFetch(
  baseUrl: string,
  accessToken: string,
  path: string
): Promise<any> {
  const url = `https://${baseUrl}/admin/api/2026-07/${path}`;
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "Invalid Shopify Access Token. Please verify your permissions."
    );
  }

  if (!response.ok) {
    throw new Error(`Shopify request failed (${response.status}).`);
  }

  return response.json();
}

export async function verifyShopifyConnection(domain: string, token: string) {
  const response = await fetch(
    `https://${sanitizeShopDomain(domain)}/admin/api/2026-07/graphql.json`,
    {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query:
          "query { shop { id name currencyCode } products(first: 1) { nodes { id } } }",
      }),
    }
  );
  if (!response.ok)
    throw new Error(
      "Shopify rejected this connection. Check the store domain, token and product-read permissions."
    );
  const body = await response.json();
  if (body.errors?.length || !body.data?.shop?.id)
    throw new Error(
      "Shopify could not verify this connection. Check product-read permissions."
    );
  return body.data.shop as { id: string; name: string; currencyCode: string };
}

// ── Inventory Sync ───────────────────────────────────────────

/**
 * Sync inventory from Shopify Admin API using a Custom App Access Token.
 */
export async function syncInventoryFromAdmin(
  merchantId: number,
  userId: string,
  shopDomain: string,
  accessToken: string
) {
  try {
    syncStatusMap.set(merchantId, {
      status: "syncing",
      count: 0,
      message: "Authenticating with Shopify Admin API...",
    });

    const baseUrl = sanitizeShopDomain(shopDomain);

    const MAX_PAGES = 10;
    let allProducts: any[] = [];
    let nextPageUrl: string | null =
      `https://${baseUrl}/admin/api/2026-07/products.json?limit=250`;

    syncStatusMap.set(merchantId, {
      status: "syncing",
      count: 0,
      message: "Downloading master inventory ledger...",
    });

    let pageCount = 0;
    while (nextPageUrl) {
      if (++pageCount > MAX_PAGES)
        throw new Error(
          "Catalogue exceeds 2,500 products; split the import before retrying."
        );
      const next = new URL(nextPageUrl);
      if (
        next.origin !== `https://${baseUrl}` ||
        !next.pathname.startsWith("/admin/api/")
      )
        throw new Error("Shopify returned an invalid pagination URL.");
      const response = await fetch(nextPageUrl, {
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Invalid Shopify Access Token. Please verify your permissions."
        );
      }

      if (!response.ok) {
        throw new Error(`Shopify request failed (${response.status}).`);
      }

      const data = await response.json();
      if (!Array.isArray(data?.products))
        throw new Error("Shopify returned an invalid catalogue response.");
      if (data && data.products) {
        allProducts = allProducts.concat(data.products);
      }

      const linkHeader: string | null = response.headers.get("Link");
      nextPageUrl = null;
      if (linkHeader) {
        const links: string[] = linkHeader
          .split(",")
          .map((a: string) => a.trim());
        for (const link of links) {
          const match: RegExpMatchArray | null = link.match(
            /<([^>]+)>;\s*rel="next"/
          );
          if (match && match[1]) {
            nextPageUrl = match[1];
            break;
          }
        }
      }

      if (allProducts.length > MAX_PAGES * 250)
        throw new Error("Catalogue exceeds 2,500 products.");
    }

    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    await importCatalogue(merchantId, userId, baseUrl, allProducts);

    syncStatusMap.set(merchantId, {
      status: "complete",
      count: allProducts.length,
      message: "Inventory successfully synced.",
    });
  } catch (error: any) {
    console.error("Shopify Admin API Sync failed:", error);
    syncStatusMap.set(merchantId, {
      status: "failed",
      count: 0,
      error: error.message || "Import failed",
    });
    throw new Error(error.message || "Import failed");
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
    const data = await shopifyAdminFetch(
      baseUrl,
      accessToken,
      "shipping_zones.json"
    );

    if (!data?.shipping_zones?.length) return;

    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    // Clear existing zones for this supplier
    await db
      .delete(schema.supplierShippingZones)
      .where(eq(schema.supplierShippingZones.supplierId, supplierId));

    for (const zone of data.shipping_zones) {
      const countryCodes: string[] = (zone.countries || []).map(
        (c: any) => c.code
      );
      if (countryCodes.length === 0) continue;

      const [zoneResult] = await db
        .insert(schema.supplierShippingZones)
        .values({
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
        const maxSubtotalDollars = rate.max_order_subtotal
          ? parseFloat(rate.max_order_subtotal)
          : null;

        await db.insert(schema.supplierShippingRates).values({
          zoneId,
          name: rate.name || "Shipping",
          priceCents: Math.round(priceDollars * 100),
          minOrderSubtotalCents: Math.round(minSubtotalDollars * 100),
          maxOrderSubtotalCents: maxSubtotalDollars
            ? Math.round(maxSubtotalDollars * 100)
            : null,
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

    console.log(
      `[ShippingSync] Synced ${data.shipping_zones.length} zones for supplier ${supplierId}`
    );
  } catch (error: any) {
    console.error(
      `[ShippingSync] Failed for supplier ${supplierId}:`,
      error.message
    );
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
    const data = await shopifyAdminFetch(baseUrl, accessToken, "shop.json");

    const currency = data?.shop?.currency;
    if (!currency) return null;

    const db = await getDb();
    if (!db) return null;

    await db
      .update(schema.suppliers)
      .set({ currency })
      .where(eq(schema.suppliers.id, supplierId));

    console.log(
      `[CurrencySync] Supplier ${supplierId} currency set to ${currency}`
    );
    return currency;
  } catch (error: any) {
    console.error(
      `[CurrencySync] Failed for supplier ${supplierId}:`,
      error.message
    );
    return null;
  }
}

// ── Shopify Draft Order Creation ─────────────────────────────

/**
 * Create a draft order on the supplier's Shopify store.
 * Called after successful payment via DOTS.
 */
export { createShopifyDraftOrder } from "./shopifyDraftOrder";
