import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, Loader2, PackageSearch } from "lucide-react";
import { trpc } from "@/lib/trpc";

export function SupplierStorefront({ 
  supplierId, 
  onBack 
}: { 
  supplierId: number; 
  onBack: () => void; 
}) {
  const { data: supplier, isLoading: isSupplierLoading } = trpc.suppliers.getSupplier.useQuery({ id: supplierId });
  const { data: products, isLoading: isProductsLoading } = trpc.suppliers.getSupplierProducts.useQuery({ supplierId });
  
  const [selectedVariants, setSelectedVariants] = useState<Record<number, number>>({});

  const handleVariantChange = (productId: number, variantId: number) => {
    setSelectedVariants(prev => ({
      ...prev,
      [productId]: variantId
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="w-full min-h-screen pb-32"
    >
      <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/30 backdrop-blur-md">
        <button 
          onClick={onBack}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-secondary/50 hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex flex-col items-center flex-1 mx-4">
          <h2 className="font-bold text-lg leading-tight text-foreground truncate w-full text-center">
            {supplier?.name || "Loading..."}
          </h2>
        </div>
        <a 
          href={supplier?.websiteUrl || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="w-10 h-10 rounded-full flex items-center justify-center bg-secondary/50 hover:bg-secondary transition-colors"
        >
          <ExternalLink className="w-4 h-4 text-foreground" />
        </a>
      </div>

      <div className="w-full p-4 mt-2">
        {isProductsLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
            <p>Loading catalog...</p>
          </div>
        ) : products?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <PackageSearch className="w-12 h-12 mb-4 opacity-50" />
            <h3 className="text-xl font-bold mb-2 text-foreground">No Products Found</h3>
            <p className="text-center max-w-xs">We couldn't find any active products for this supplier. The catalog may be empty or failed to import.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 pb-20">
            {products?.map((product: any) => {
              const hasVariants = product.variants && product.variants.length > 0;
              const selectedVarId = selectedVariants[product.id] || (hasVariants ? product.variants[0].id : null);
              const activeVariant = hasVariants ? product.variants.find((v: any) => v.id === selectedVarId) : null;
              
              const priceCents = activeVariant ? activeVariant.priceCents : 0;
              
              return (
                <div key={product.id} className="bg-card border border-border rounded-[20px] overflow-hidden flex flex-col group">
                  <div className="aspect-square w-full bg-secondary/20 relative">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-muted-foreground/50 font-medium">No Image</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-3 flex flex-col flex-1">
                    {product.category && (
                      <p className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full w-max mb-1.5 line-clamp-1">{product.category}</p>
                    )}
                    <h3 className="font-bold text-sm line-clamp-2 leading-tight mb-2 flex-1">{product.title}</h3>
                    
                    {hasVariants && (
                      <div className="mb-3 mt-auto">
                        <select
                          value={selectedVarId || ''}
                          onChange={(e) => handleVariantChange(product.id, Number(e.target.value))}
                          className="w-full bg-background border border-border text-foreground text-xs rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          {product.variants.map((v: any) => (
                            <option key={v.id} value={v.id}>
                              {v.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="mt-auto pt-2 border-t border-border flex items-center justify-between">
                      <span className="font-bold text-sm">
                        {priceCents > 0 ? `$${(priceCents / 100).toFixed(2)}` : 'Pricing Unavailable'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
