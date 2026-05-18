import { getDb } from "../db";
import * as schema from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export const syncStatusMap = new Map<number, { status: "syncing" | "complete" | "failed", count: number, error?: string }>();

export async function runStoreScraper(storeUrl: string) {
  // Clean up the URL input robustly
  let baseUrl = storeUrl.trim();
  
  // Add protocol if missing so URL constructor doesn't fail
  if (!baseUrl.startsWith('http')) {
    baseUrl = `https://${baseUrl}`;
  }

  try {
    // Extract just the origin/hostname, ignoring any paths like /products.json they might have pasted
    const urlObj = new URL(baseUrl);
    baseUrl = urlObj.origin;
  } catch (e) {
    throw new Error("Invalid URL format provided.");
  }

  let allProducts: any[] = [];
  const MAX_PAGES = 10;
  
  // ENGINE 1: Try Shopify
  try {
    let shopifyPage = 1;
    while (shopifyPage <= MAX_PAGES) {
      const productsUrl = `${baseUrl}/products.json?limit=250&page=${shopifyPage}`;
      const response = await fetch(productsUrl, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) break;

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) break;

      const data = await response.json();
      if (!data || !data.products || !Array.isArray(data.products)) break;

      allProducts = allProducts.concat(data.products);
      
      if (data.products.length < 250) break;
      shopifyPage++;
    }
  } catch (e) {
    // Shopify failed, continue to fallback
  }

  // ENGINE 2: Try WooCommerce (Public Store API) if Shopify failed
  if (allProducts.length === 0) {
    try {
      let wooPage = 1;
      while (wooPage <= MAX_PAGES) {
        const wooUrl = `${baseUrl}/wp-json/wc/store/products?page=${wooPage}&per_page=100`;
        const response = await fetch(wooUrl, {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json'
          }
        });

        if (!response.ok) break;

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) break;

        const wData = await response.json();
        if (!Array.isArray(wData)) break;

        // Map WooCommerce structure to match expected Shopify-like structure for the rest of the function
        const mappedWooProducts = wData.map((wp: any) => {
          const priceVal = wp.prices?.price ? (parseInt(wp.prices.price, 10) / 100).toString() : "0";
          return {
            id: wp.id.toString(),
            title: wp.name,
            body_html: wp.short_description || wp.description || "",
            product_type: wp.categories && wp.categories.length > 0 ? wp.categories[0].name : "",
            images: wp.images ? wp.images.map((img: any) => ({ src: img.src })) : [],
            variants: [
              {
                id: wp.id.toString(),
                title: "Default",
                price: priceVal,
                sku: wp.sku || "",
                inventory_quantity: wp.is_in_stock ? 1 : 0
              }
            ]
          };
        });

        allProducts = allProducts.concat(mappedWooProducts);
        
        if (wData.length < 100) break;
        wooPage++;
      }
    } catch (e) {
      // WooCommerce failed
    }
  }

  if (allProducts.length === 0) {
    throw new Error("Could not find public products at this URL. If this is a new Shopify store, please ensure it is not password protected. Otherwise, make sure it is a valid store without strict API blocking.");
  }

  // Determine store name from URL hostname
  const urlObj = new URL(baseUrl);
  let storeName = urlObj.hostname.replace('www.', '').split('.')[0];
  // Capitalize
  storeName = storeName.charAt(0).toUpperCase() + storeName.slice(1);

  let logoUrl = null;
  try {
    const htmlResponse = await fetch(baseUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });
    const html = await htmlResponse.text();
    const match = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) || html.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/i);
    if (match && match[1]) {
      logoUrl = match[1].startsWith('//') ? 'https:' + match[1] : match[1];
    }
  } catch (e) {
    // ignore
  }

  if (!logoUrl && allProducts.length > 0) {
    const productWithImage = allProducts.find(p => p.images && p.images.length > 0);
    if (productWithImage) {
      logoUrl = productWithImage.images[0].src;
    }
  }

  return {
    allProducts,
    baseUrl,
    storeName,
    logoUrl
  };
}

export async function scrapeForMerchant(merchantId: number, storeUrl: string) {
  try {
    syncStatusMap.set(merchantId, { status: "syncing", count: 0 });

    const db = await getDb();
    if (!db) {
      syncStatusMap.set(merchantId, { status: "failed", count: 0, error: "DB connection failed" });
      return;
    }

    const { allProducts } = await runStoreScraper(storeUrl);
    
    syncStatusMap.set(merchantId, { status: "syncing", count: allProducts.length });

    // Save Products to live schema.products with isActive: 0
    const productsToInsert = allProducts.map((p: any) => {
      let imageUrl = p.images && p.images.length > 0 ? p.images[0].src : null;
      let description = p.body_html ? p.body_html.replace(/<[^>]*>?/gm, '') : null;
      
      return {
        merchantId,
        ownerType: "merchant" as const,
        title: p.title,
        description,
        imageUrl,
        category: p.product_type,
        isActive: 0, // Will toggle to 1 after Stripe verification
        inventoryCount: 0, // Master inventory count
      };
    });

    if (productsToInsert.length === 0) return;

    // We do this safely, iterating so we can capture insertIds and insert variants
    for (let i = 0; i < allProducts.length; i++) {
      const p = allProducts[i];
      const pData = productsToInsert[i];

      const [insertRes] = await db.insert(schema.products).values(pData);
      const productId = insertRes.insertId;

      if (p.variants && p.variants.length > 0) {
        const variantsToInsert = p.variants.map((v: any) => {
          const priceVal = parseFloat(v.price) || 0;
          return {
            productId,
            title: v.title || "Default",
            priceCents: Math.round(priceVal * 100),
            sku: v.sku || null,
            inventoryCount: v.inventory_quantity !== undefined ? v.inventory_quantity : (v.available ? 1 : 0),
          };
        });

        if (variantsToInsert.length > 0) {
          await db.insert(schema.productVariants).values(variantsToInsert);
        }
      }
    }
    
    syncStatusMap.set(merchantId, { status: "complete", count: allProducts.length });
  } catch (error: any) {
    console.error("Background Scrape for Merchant failed:", error);
    syncStatusMap.set(merchantId, { status: "failed", count: 0, error: error.message });
  }
}
