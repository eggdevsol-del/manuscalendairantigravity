import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, Loader2, PackageSearch, Search, RefreshCw, Minus, Plus, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { cn } from "@/lib/utils";
import { SupplierCheckoutSheet } from "./SupplierCheckoutSheet";

export function SupplierStorefront({ 
  supplierId, 
  onBack 
}: { 
  supplierId: number; 
  onBack: () => void; 
}) {
  const queryClient = useQueryClient();
  const { data: supplier } = trpc.suppliers.getSupplier.useQuery({ id: supplierId });
  const { data: products, isLoading: isProductsLoading } = trpc.suppliers.getSupplierProducts.useQuery({ supplierId });
  
  const [selectedVariants, setSelectedVariants] = useState<Record<number, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showInStockOnly, setShowInStockOnly] = useState(false);

  // Cart state: variantId → { quantity, priceCents, productTitle, variantTitle }
  const [cart, setCart] = useState<Record<number, { quantity: number; priceCents: number; productTitle: string; variantTitle: string }>>({}); 

  const addToCart = (variantId: number, priceCents: number, productTitle: string, variantTitle: string) => {
    setCart(prev => ({
      ...prev,
      [variantId]: {
        quantity: (prev[variantId]?.quantity || 0) + 1,
        priceCents,
        productTitle,
        variantTitle,
      },
    }));
  };

  const removeFromCart = (variantId: number) => {
    setCart(prev => {
      const next = { ...prev };
      if (next[variantId] && next[variantId].quantity > 1) {
        next[variantId] = { ...next[variantId], quantity: next[variantId].quantity - 1 };
      } else {
        delete next[variantId];
      }
      return next;
    });
  };

  const cartItemCount = useMemo(() =>
    Object.values(cart).reduce((sum, item) => sum + item.quantity, 0)
  , [cart]);

  const cartTotalCents = useMemo(() =>
    Object.values(cart).reduce((sum, item) => sum + item.priceCents * item.quantity, 0)
  , [cart]);

  const [showCheckout, setShowCheckout] = useState(false);

  // Transform internal cart state into array for SupplierCheckoutSheet
  const checkoutCartItems = useMemo(() => {
    if (!products) return [];
    return Object.entries(cart).map(([variantIdStr, entry]) => {
      const variantId = Number(variantIdStr);
      // Find the product that contains this variant
      let productId = 0;
      for (const p of products) {
        if (p.variants?.some((v: any) => v.id === variantId)) {
          productId = p.id;
          break;
        }
      }
      return {
        productId,
        variantId,
        quantity: entry.quantity,
        priceCents: entry.priceCents,
        productTitle: entry.productTitle,
        variantTitle: entry.variantTitle,
      };
    });
  }, [cart, products]);

  // Background Sync
  const scrapeMutation = trpc.suppliers.scrapeShopifyStore.useMutation({
    onSuccess: () => {
      // Scrape deletes+reinserts all products — old variant IDs are invalidated
      setCart({});
      // Invalidate to seamlessly swap in fresh data
      queryClient.invalidateQueries({ queryKey: getQueryKey(trpc.suppliers.getSupplierProducts, { supplierId }) });
    }
  });

  // Trigger sync once when supplier data is available
  useEffect(() => {
    if (supplier?.websiteUrl && !scrapeMutation.isPending && !scrapeMutation.isSuccess && !scrapeMutation.isError) {
      scrapeMutation.mutate({ storeUrl: supplier.websiteUrl });
    }
  }, [supplier?.websiteUrl]);

  const handleVariantChange = (productId: number, variantId: number) => {
    setSelectedVariants(prev => ({
      ...prev,
      [productId]: variantId
    }));
  };

  // Derive unique categories from products
  const categories = useMemo(() => {
    if (!products) return [];
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(cats).sort() as string[];
  }, [products]);

  // Filter products based on search and category
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    let filtered = products;
    
    if (selectedCategory) {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }
    
    if (showInStockOnly) {
      filtered = filtered.filter(p => {
        return p.variants && p.variants.some((v: any) => v.inventoryCount > 0);
      });
    }
    
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(q) || 
        (p.category && p.category.toLowerCase().includes(q))
      );
    }
    
    return filtered;
  }, [products, selectedCategory, searchQuery, showInStockOnly]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="w-full min-h-screen pb-32 flex flex-col"
    >
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border shadow-sm flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-secondary/50 hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          
          <div className="flex flex-col items-center flex-1 mx-4 overflow-hidden">
            <h2 className="font-bold text-lg leading-tight text-foreground truncate w-full text-center">
              {supplier?.name || "Loading..."}
            </h2>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              {scrapeMutation.isPending && (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Syncing Store...
                </>
              )}
              {scrapeMutation.isSuccess && "Live Data"}
            </div>
          </div>

          <a 
            href={supplier?.websiteUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-secondary/50 hover:bg-secondary transition-colors shrink-0"
          >
            <ExternalLink className="w-4 h-4 text-foreground" />
          </a>
        </div>

        {/* Search & Filters */}
        <div className="px-4 pb-4 space-y-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-muted-foreground" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full bg-secondary/50 border border-border rounded-xl py-2.5 pl-9 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/70"
            />
          </div>

          {categories.length > 0 && (
            <div className="flex overflow-x-auto snap-x hide-scrollbar gap-2 -mx-4 px-4 pb-1">
              <button
                onClick={() => setShowInStockOnly(!showInStockOnly)}
                className={cn(
                  "snap-start shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors border",
                  showInStockOnly 
                    ? "bg-[var(--color-success)] text-white border-emerald-500" 
                    : "bg-secondary/50 text-muted-foreground border-transparent hover:bg-secondary hover:text-foreground"
                )}
              >
                In-Stock
              </button>
              <div className="w-px h-6 bg-border mx-1 self-center shrink-0"></div>
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "snap-start shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors border",
                  selectedCategory === null 
                    ? "bg-foreground text-background border-foreground" 
                    : "bg-secondary/50 text-muted-foreground border-transparent hover:bg-secondary hover:text-foreground"
                )}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "snap-start shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors border",
                    selectedCategory === cat 
                      ? "bg-foreground text-background border-foreground" 
                      : "bg-secondary/50 text-muted-foreground border-transparent hover:bg-secondary hover:text-foreground"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="w-full p-4 mt-2">
        {isProductsLoading && !products ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-[var(--color-status-info-text)]" />
            <p>Loading catalog...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-center px-4">
            <PackageSearch className="w-12 h-12 mb-4 opacity-50" />
            <h3 className="text-xl font-bold mb-2 text-foreground">No Products Found</h3>
            <p className="max-w-xs text-sm">
              {searchQuery || selectedCategory || showInStockOnly
                ? "Try adjusting your search or category filters."
                : "We couldn't find any active products for this supplier. The catalog may be empty or failed to import."}
            </p>
            {(searchQuery || selectedCategory || showInStockOnly) && (
              <button 
                onClick={() => { setSearchQuery(""); setSelectedCategory(null); setShowInStockOnly(false); }}
                className="mt-6 px-6 py-2 bg-secondary rounded-full font-bold text-sm text-foreground hover:bg-secondary/80"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 pb-20">
            {filteredProducts.map((product: any) => {
              const hasVariants = product.variants && product.variants.length > 0;
              const selectedVarId = selectedVariants[product.id] || (hasVariants ? product.variants[0].id : null);
              const activeVariant = hasVariants ? product.variants.find((v: any) => v.id === selectedVarId) : null;
              
              const priceCents = activeVariant ? activeVariant.priceCents : 0;
              const inventoryCount = activeVariant ? activeVariant.inventoryCount : 0;
              const isAvailable = inventoryCount > 0;
              
              return (
                <div key={product.id} className="bg-card border border-border rounded-[20px] overflow-hidden flex flex-col group shadow-sm hover:shadow-md transition-shadow">
                  <div className="aspect-square w-full bg-secondary/20 relative">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-muted-foreground/50 font-medium text-xs">No Image</span>
                      </div>
                    )}
                    
                    {/* OUT OF STOCK overlay badge */}
                    {!isAvailable && (
                      <div className="absolute bottom-2 right-2">
                        <div className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-black/80 text-white border border-white/20 backdrop-blur-sm">
                          OUT OF STOCK
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-3 flex flex-col flex-1">
                    {product.category && (
                      <p className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full w-max mb-1.5 line-clamp-1">
                        {product.category}
                      </p>
                    )}
                    <h3 className="font-bold text-sm line-clamp-2 leading-tight mb-2 flex-1">{product.title}</h3>
                    
                    {hasVariants && (
                      <div className="mb-3 mt-auto">
                        <select
                          value={selectedVarId || ''}
                          onChange={(e) => handleVariantChange(product.id, Number(e.target.value))}
                          className="w-full bg-secondary/50 border border-border text-foreground text-xs rounded-lg px-2 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 truncate"
                        >
                          {product.variants.map((v: any) => (
                            <option key={v.id} value={v.id}>
                              {v.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="mt-auto pt-3 border-t border-border flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-foreground shrink-0">
                        {priceCents > 0 ? `$${(priceCents / 100).toFixed(2)}` : 'N/A'}
                      </span>
                      {isAvailable ? (
                        selectedVarId && cart[selectedVarId] ? (
                          // Quantity stepper
                          <div className="flex items-center gap-0 rounded-full overflow-hidden" style={{ background: '#f2ca5c' }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeFromCart(selectedVarId); }}
                              className="w-8 h-8 flex items-center justify-center hover:bg-black/10 transition-colors"
                              style={{ minHeight: 32 }}
                            >
                              <Minus className="w-3.5 h-3.5 text-black" />
                            </button>
                            <span className="text-xs font-bold text-black min-w-[20px] text-center">
                              {cart[selectedVarId].quantity}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (selectedVarId && activeVariant) {
                                  addToCart(selectedVarId, priceCents, product.title, activeVariant.title || '');
                                }
                              }}
                              className="w-8 h-8 flex items-center justify-center hover:bg-black/10 transition-colors"
                              style={{ minHeight: 32 }}
                            >
                              <Plus className="w-3.5 h-3.5 text-black" />
                            </button>
                          </div>
                        ) : (
                          // Add button
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (selectedVarId && activeVariant) {
                                addToCart(selectedVarId, priceCents, product.title, activeVariant.title || '');
                              }
                            }}
                            className="px-4 py-1.5 rounded-full text-xs font-bold transition-colors"
                            style={{ background: '#f2ca5c', color: '#1a1a19', minHeight: 32 }}
                          >
                            Add
                          </button>
                        )
                      ) : (
                        // Notify me button for out-of-stock
                        <button
                          onClick={(e) => { e.stopPropagation(); }}
                          className="px-3 py-1.5 rounded-full text-xs font-bold border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                          style={{ minHeight: 32 }}
                        >
                          Notify me
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky Cart Bar */}
      {cartItemCount > 0 && !showCheckout && (
        <div
          className="fixed bottom-20 left-0 right-0 z-50 px-4 pb-2"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}
        >
          <button
            onClick={() => setShowCheckout(true)}
            className="w-full flex items-center justify-between rounded-2xl px-5 py-3.5 shadow-lg transition-colors"
            style={{
              background: '#f2ca5c',
              color: '#1a1a19',
              minHeight: 52,
            }}
          >
            <span className="text-sm font-bold">
              {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'} · ${(cartTotalCents / 100).toFixed(2)}
            </span>
            <span className="text-sm font-bold flex items-center gap-1">
              Order <ChevronRight className="w-4 h-4" />
            </span>
          </button>
        </div>
      )}

      {/* Checkout Sheet */}
      {showCheckout && (
        <SupplierCheckoutSheet
          supplierId={supplierId}
          supplierName={supplier?.name || "Supplier"}
          cartItems={checkoutCartItems}
          onClose={() => setShowCheckout(false)}
          onSuccess={() => {
            setCart({});
            setShowCheckout(false);
          }}
        />
      )}
    </motion.div>
  );
}
