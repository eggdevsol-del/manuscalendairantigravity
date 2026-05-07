import React, { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, ArrowLeft, Package, Truck, Store, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || "");

export default function PublicStorefront() {
  const [, params] = useRoute("/shop/:slug");
  const [, setLocation] = useLocation();
  const slug = params?.slug;

  const [checkingOutProductId, setCheckingOutProductId] = useState<number | null>(null);

  const { data: storefront, isLoading, error } = trpc.storefront.getArtistStorefront.useQuery(
    { slug: slug || "" },
    { enabled: !!slug, retry: false }
  );

  const checkoutMutation = trpc.storefront.createStorefrontCheckout.useMutation();

  const handleCheckout = async (productId: number, requiresShipping: boolean) => {
    try {
      setCheckingOutProductId(productId);
      
      // Determine fulfillment based on what the user selects or what the product requires.
      // For MVP, if it supports BOTH, we will default to "delivery" and let Stripe collect the address.
      const fulfillment = requiresShipping ? "delivery" : "pickup";

      const res = await checkoutMutation.mutateAsync({
        productId,
        quantity: 1, // Single-item checkout MVP
        fulfillmentMethod: fulfillment
      });

      if (!res.url) throw new Error("No checkout URL returned");
      window.location.href = res.url;

    } catch (error: any) {
      toast.error(error.message || "Failed to initiate checkout");
      setCheckingOutProductId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white/20 animate-spin" />
      </div>
    );
  }

  if (error || !storefront) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Store Not Found</h1>
        <p className="text-white/60 mb-6">This artist may not have their store set up.</p>
        <button 
          onClick={() => setLocation(`/${slug}`)}
          className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors font-medium text-sm"
        >
          Return to Hub
        </button>
      </div>
    );
  }

  const { products } = storefront;

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden font-sans pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 px-4 py-4 flex items-center justify-between">
        <button 
          onClick={() => setLocation(`/${slug}`)}
          className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white/70" />
        </button>
        <span className="font-bold tracking-wider uppercase text-sm">Storefront</span>
        <div className="w-9" /> {/* Spacer */}
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-8">
        <h1 className="text-3xl font-extrabold mb-8">Shop</h1>

        {products.length === 0 ? (
          <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/5">
            <Package className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">No Products</h2>
            <p className="text-white/50 text-sm">Check back later for merch and aftercare.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {products.map(product => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 rounded-[24px] border border-white/10 overflow-hidden flex flex-col hover:border-white/20 transition-colors"
              >
                {/* Product Image */}
                <div className="aspect-square bg-black/50 relative overflow-hidden group">
                  {product.imageUrl ? (
                    <img 
                      src={product.imageUrl} 
                      alt={product.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-12 h-12 text-white/10" />
                    </div>
                  )}
                  {/* Fulfillment Badge */}
                  <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-white/10">
                    {product.fulfillmentType === "pickup" && <Store className="w-3.5 h-3.5 text-white/70" />}
                    {product.fulfillmentType === "delivery" && <Truck className="w-3.5 h-3.5 text-white/70" />}
                    {product.fulfillmentType === "both" && <Globe className="w-3.5 h-3.5 text-white/70" />}
                    <span className="text-[10px] uppercase font-bold tracking-wider text-white/80">
                      {product.fulfillmentType === "both" ? "Delivery / Pickup" : product.fulfillmentType}
                    </span>
                  </div>
                </div>

                <div className="p-5 flex flex-col flex-1">
                  <h3 className="text-lg font-bold mb-1 leading-tight">{product.title}</h3>
                  <p className="text-white/50 text-sm line-clamp-2 mb-4 leading-relaxed flex-1">
                    {product.description}
                  </p>
                  
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                    <span className="text-xl font-bold tracking-tight">
                      ${(product.priceCents / 100).toFixed(2)}
                    </span>
                    
                    {product.inventoryCount <= 0 ? (
                      <span className="text-red-400 font-semibold text-sm bg-red-500/10 px-4 py-2 rounded-full">
                        Out of Stock
                      </span>
                    ) : (
                      <button
                        onClick={() => handleCheckout(product.id, ["delivery", "both"].includes(product.fulfillmentType))}
                        disabled={checkingOutProductId === product.id}
                        className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2.5 px-5 rounded-full transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                      >
                        {checkingOutProductId === product.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Buy Now"
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
