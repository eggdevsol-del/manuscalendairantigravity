import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import * as schema from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export const suppliersRouter = router({
  /**
   * Scrapes a Shopify store and adds its products to the suppliers directory.
   */
  scrapeShopifyStore: protectedProcedure
    .input(z.object({ storeUrl: z.string().min(1, "Store URL is required") }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      // Clean up the URL input robustly
      let baseUrl = input.storeUrl.trim();
      
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
      
      try {
        // ENGINE 1: Try Shopify
      try {
        let shopifyPage = 1;
        while (shopifyPage <= MAX_PAGES) {
          const productsUrl = `${baseUrl}/products.json?limit=250&page=${shopifyPage}`;
          const response = await fetch(productsUrl, {
            headers: { 'User-Agent': 'Tattoi App Import' }
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
              headers: { 'User-Agent': 'Tattoi App Import' }
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
                    available: wp.is_in_stock
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
        throw new Error("Could not find public products at this URL. Make sure it is a valid Shopify or modern WooCommerce store without strict API blocking.");
      }

        // Determine store name from URL hostname
        const urlObj = new URL(baseUrl);
        let storeName = urlObj.hostname.replace('www.', '').split('.')[0];
        // Capitalize
        storeName = storeName.charAt(0).toUpperCase() + storeName.slice(1);

        let logoUrl = null;
        try {
          const htmlResponse = await fetch(baseUrl, {
            headers: { 'User-Agent': 'Tattoi App Import' }
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

        // Save or Update Supplier
        const existingSupplier = await db.query.suppliers.findFirst({
          where: eq(schema.suppliers.websiteUrl, baseUrl)
        });

        let supplierId;

        if (existingSupplier) {
          supplierId = existingSupplier.id;
          await db.update(schema.suppliers).set({ name: storeName, logoUrl }).where(eq(schema.suppliers.id, supplierId));
          // Clear old products to insert fresh
          await db.delete(schema.supplierProducts).where(eq(schema.supplierProducts.supplierId, supplierId));
        } else {
          const [supplierResult] = await db.insert(schema.suppliers).values({
            name: storeName,
            websiteUrl: baseUrl,
            logoUrl,
          });
          supplierId = supplierResult.insertId;
        }

        // Save Products
        const productsToInsert = allProducts.map((p: any) => {
          let imageUrl = p.images && p.images.length > 0 ? p.images[0].src : null;
          let description = p.body_html ? p.body_html.replace(/<[^>]*>?/gm, '') : null;
          
          return {
            supplierId,
            title: p.title,
            description,
            imageUrl,
            shopifyProductId: p.id.toString(),
            category: p.product_type,
            // Shopify prices are usually in variants
          };
        });

        if (productsToInsert.length === 0) {
          return { success: true, supplierId, productCount: 0 };
        }

        const [productInsertResult] = await db.insert(schema.supplierProducts).values(productsToInsert);
        const firstProductId = productInsertResult.insertId;
        
        // We need to fetch the inserted products to get their IDs so we can map variants
        const insertedProducts = await db.query.supplierProducts.findMany({
          where: eq(schema.supplierProducts.supplierId, supplierId)
        });

        const variantsToInsert: any[] = [];
        
        for (const sp of allProducts) {
          const dbProduct = insertedProducts.find(p => p.shopifyProductId === sp.id.toString());
          if (dbProduct && sp.variants && sp.variants.length > 0) {
            for (const v of sp.variants) {
              const priceVal = parseFloat(v.price) || 0;
              variantsToInsert.push({
                supplierProductId: dbProduct.id,
                title: v.title || "Default",
                priceCents: Math.round(priceVal * 100),
                sku: v.sku || null,
                inventoryCount: v.inventory_quantity !== undefined ? v.inventory_quantity : (v.available ? 1 : 0),
                shopifyVariantId: v.id.toString(),
              });
            }
          }
        }

        if (variantsToInsert.length > 0) {
          await db.insert(schema.supplierProductVariants).values(variantsToInsert);
        }

        return { 
          success: true, 
          supplierId, 
          productCount: allProducts.length,
          name: storeName
        };
        
      } catch (error: any) {
        throw new Error(`Failed to scrape store: ${error.message}`);
      }
    }),
    
  getSuppliers: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    return db.query.suppliers.findMany({
      orderBy: (suppliers, { desc }) => [desc(suppliers.createdAt)]
    });
  }),

  deleteSupplier: protectedProcedure
    .input(z.object({ supplierId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      await db.delete(schema.suppliers).where(eq(schema.suppliers.id, input.supplierId));
      return { success: true };
    }),

  getSupplier: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      return db.query.suppliers.findFirst({
        where: eq(schema.suppliers.id, input.id)
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
          variants: true
        }
      });
    }),
});
