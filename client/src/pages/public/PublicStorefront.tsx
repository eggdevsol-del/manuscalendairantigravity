import React, { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, ArrowLeft, Package, Truck, Store, Globe, ShoppingCart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { loadStripe } from "@stripe/stripe-js";
import { CartProvider, useCart } from "@/features/storefront/CartContext";
import { StorefrontCheckoutFAB } from "@/features/storefront/StorefrontCheckoutFAB";
import { StorefrontProductCard } from "@/features/storefront/StorefrontProductCard";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || "");

function StorefrontContent({ slug, storefront }: { slug: string; storefront: any }) {
  const [, setLocation] = useLocation();
  const { products } = storefront;
  const { items, addItem, totalItems, setIsCartOpen } = useCart();

  return (
    <div className="h-[100dvh] overflow-y-auto overflow-x-hidden bg-background text-white font-sans pb-32">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4 flex items-center justify-between">
        <button 
          onClick={() => setLocation(`/${slug}`)}
          className="p-2 -ml-2 rounded-full hover:bg-secondary/50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <span className="font-bold tracking-wider uppercase text-sm truncate max-w-[200px]">{storefront.artistName}</span>
        <button 
          onClick={() => setIsCartOpen(true)}
          className="relative p-2 rounded-full hover:bg-secondary/50 transition-colors"
        >
          <ShoppingCart className="w-5 h-5 text-muted-foreground" />
          {totalItems > 0 && (
            <span className="absolute top-0 right-0 w-4 h-4 bg-primary text-white text-[10px] font-bold flex items-center justify-center rounded-full">
              {totalItems}
            </span>
          )}
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-8">
        <h1 className="text-3xl font-extrabold mb-8">Shop</h1>

        {products.length === 0 ? (
          <div className="text-center py-20 bg-secondary/50 rounded-3xl border border-border">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">No Products</h2>
            <p className="text-muted-foreground text-sm">Check back later for merch and aftercare.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {products.map((product: any) => (
              <StorefrontProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>

      {/* Floating View Cart Button */}
      <AnimatePresence>
        {totalItems > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-0 right-0 px-4 z-40 flex justify-center"
          >
            <button
              onClick={() => setIsCartOpen(true)}
              className="bg-foreground text-background px-6 py-4 rounded-full font-bold shadow-2xl flex items-center gap-3 w-full max-w-sm hover:scale-[1.02] active:scale-95 transition-all"
            >
              <div className="bg-black text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">
                {totalItems}
              </div>
              <span className="flex-1 text-center">View Cart</span>
              <ShoppingCart className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <StorefrontCheckoutFAB artistSlug={slug} artistId={storefront.artistId} onClose={() => {}} />
    </div>
  );
}

export default function PublicStorefront() {
  const [, params] = useRoute("/shop/:slug");
  const [, setLocation] = useLocation();
  const slug = params?.slug;

  const { data: storefront, isLoading, error } = trpc.storefront.getArtistStorefront.useQuery(
    { slug: slug || "" },
    { enabled: !!slug, retry: false }
  );

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (error || !storefront) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Store Not Found</h1>
        <p className="text-muted-foreground mb-6">This artist may not have their store set up.</p>
        <button 
          onClick={() => setLocation(`/${slug}`)}
          className="px-6 py-3 bg-secondary/50 hover:bg-secondary/50 text-white rounded-full transition-colors font-medium text-sm"
        >
          Return to Hub
        </button>
      </div>
    );
  }

  return (
    <CartProvider>
      <StorefrontContent slug={slug || ""} storefront={storefront} />
    </CartProvider>
  );
}
