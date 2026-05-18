export interface ScrapedProduct {
  title?: string;
  body_html?: string;
  images?: { src: string }[];
  variants?: { title: string; price: string; sku: string; inventory_quantity?: number; available?: boolean }[];
  product_type?: string;
}

export function translateShopifyToTattoi(product: ScrapedProduct, userId: string) {
  const title = product.title || "Untitled Product";
  
  // 1. Resolve missing description
  let description = product.body_html ? product.body_html.replace(/<[^>]*>?/gm, "").trim() : "";
  
  if (!description) {
    const variantNames = product.variants ? product.variants.map((v) => v.title).filter(v => v !== "Default Title").join(", ") : "";
    description = `${title} - Premium supply for professional artists.`;
    if (variantNames) {
      description += ` Available options: ${variantNames}.`;
    }
  }

  // 2. Resolve Base Price
  let basePriceCents = 0;
  if (product.variants && product.variants.length > 0) {
    const prices = product.variants.map((v) => parseFloat(v.price) || 0);
    basePriceCents = Math.round(Math.min(...prices) * 100);
  }

  // 3. Construct Normalized Master Product
  const masterProduct = {
    artistId: userId,
    ownerType: "merchant" as const,
    title,
    description,
    imageUrl: product.images && product.images.length > 0 ? product.images[0].src : null,
    priceCents: basePriceCents,
    hasVariants: product.variants && product.variants.length > 0 ? 1 : 0,
    isActive: 0,
    inventoryCount: 0,
  };

  // 4. Construct Normalized Variants
  const variantsToInsert = (product.variants || []).map((v) => ({
    name: v.title || "Default",
    priceCents: Math.round((parseFloat(v.price) || 0) * 100),
    sku: v.sku || null,
    inventoryCount: v.inventory_quantity !== undefined ? v.inventory_quantity : v.available ? 1 : 0,
  }));

  return { masterProduct, variantsToInsert };
}