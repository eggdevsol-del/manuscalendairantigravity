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
      let page = 1;
      const MAX_PAGES = 10;
      
      try {
        while (page <= MAX_PAGES) {
          const productsUrl = `${baseUrl}/products.json?limit=250&page=${page}`;
          const response = await fetch(productsUrl, {
            headers: {
              'User-Agent': 'Tattoi App Import',
            }
          });

          if (!response.ok) {
            if (page === 1) throw new Error("Could not fetch products. Make sure this is a valid Shopify store.");
            break;
          }

          const contentType = response.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            if (page === 1) throw new Error("The store URL did not return valid JSON data. Please ensure the URL points to a standard Shopify storefront.");
            break;
          }

          let data;
          try {
            data = await response.json();
          } catch (e) {
            if (page === 1) throw new Error("Failed to parse store data. The URL might not be a standard Shopify store.");
            break;
          }
          
          if (!data || !data.products || !Array.isArray(data.products)) {
            if (page === 1) throw new Error("Invalid response format. Not a recognized Shopify catalog.");
            break;
          }

          allProducts = allProducts.concat(data.products);
          
          if (data.products.length < 250) {
            break; // No more pages
          }
          
          page++;
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

        // Save Supplier
        const [supplierResult] = await db.insert(schema.suppliers).values({
          name: storeName,
          websiteUrl: baseUrl,
          logoUrl,
        });

        const supplierId = supplierResult.insertId;

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
                inventoryCount: v.inventory_quantity || 0,
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
