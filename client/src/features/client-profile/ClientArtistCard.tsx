import React, { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, ShoppingBag, Loader2, Package } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { CartProvider, useCart } from "@/features/storefront/CartContext";
import { StorefrontProductCard } from "@/features/storefront/StorefrontProductCard";
import { StorefrontCheckoutFAB } from "@/features/storefront/StorefrontCheckoutFAB";

interface ClientArtistCardProps {
  conv: any;
  onShopToggle?: (expanded: boolean) => void;
}

// Inner component wrapped in CartProvider so it can access cart state
function ClientArtistCardExpanded({ artistId }: { artistId: string }) {
  const { data: storefront, isLoading } = trpc.storefront.getStorefrontByArtistId.useQuery({
    artistId,
  });

  const { setIsCartOpen, totalItems } = useCart();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-white/50" />
      </div>
    );
  }

  if (!storefront || storefront.products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-black/20 rounded-xl mx-4 mb-4 border border-white/5">
        <Package className="w-8 h-8 text-white/20 mb-2" />
        <p className="text-white/50 text-sm">No products available</p>
      </div>
    );
  }

  return (
    <>
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white uppercase tracking-wider text-xs">Storefront</h3>
          {totalItems > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsCartOpen(true);
              }}
              className="text-xs bg-indigo-500 hover:bg-indigo-400 text-white px-3 py-1.5 rounded-full font-bold transition-colors shadow-lg"
            >
              Checkout ({totalItems})
            </button>
          )}
        </div>
        
        {/* Scrollable area inside the card */}
        <div 
          className="flex overflow-x-auto gap-4 pb-4 -mx-4 px-4 mobile-scroll snap-x"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {storefront.products.map((product: any) => (
            <div key={product.id} className="min-w-[280px] max-w-[280px] snap-start shrink-0">
              <StorefrontProductCard product={product} />
            </div>
          ))}
        </div>
      </div>

      <StorefrontCheckoutFAB
        onClose={() => setIsCartOpen(false)}
        artistSlug={storefront.artistSlug}
        artistId={artistId}
      />
    </>
  );
}

export function ClientArtistCard({ conv, onShopToggle }: ClientArtistCardProps) {
  const [, setLocation] = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);

  const artist = conv.otherUser;
  if (!artist) return null;

  const bannerUrl = artist.funnelBannerUrl || null;
  const artistName = artist.name || artist.firstName || "Artist";
  const avatarUrl = artist.avatar || null;

  return (
    <div className="w-full relative rounded-2xl overflow-hidden group bg-[#111] transition-all duration-300 shadow-xl border border-white/5">
      {/* Banner Background */}
      {bannerUrl ? (
        <img
          src={bannerUrl}
          alt=""
          className="absolute top-0 left-0 w-full h-[140px] object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute top-0 left-0 w-full h-[140px] bg-gradient-to-br from-primary/30 via-accent/20 to-primary/10" />
      )}

      {/* Overlay gradient for text readability */}
      <div className="absolute top-0 left-0 w-full h-[140px] bg-gradient-to-t from-[#111] via-black/50 to-black/10" />

      {/* Main Header Area */}
      <div className="relative z-10 flex items-end p-4 h-[140px]">
        <div className="flex items-center gap-3 w-full">
          {/* Artist Avatar */}
          <div 
            onClick={() => setLocation(`/chat/${conv.id}`)}
            className="cursor-pointer w-12 h-12 rounded-full bg-white/10 border-2 border-white/20 overflow-hidden shrink-0 shadow-lg active:scale-95 transition-transform"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={artistName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary to-accent">
                <span className="text-white font-bold text-lg">
                  {artistName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Artist Info */}
          <div 
            onClick={() => setLocation(`/chat/${conv.id}`)}
            className="flex-1 min-w-0 text-left cursor-pointer active:opacity-70 transition-opacity"
          >
            <p className="text-white font-bold text-lg leading-tight truncate drop-shadow-md">
              {artistName}
            </p>
            {conv.unreadCount > 0 && (
              <p className="text-primary text-xs font-medium mt-0.5">
                {conv.unreadCount} unread message{conv.unreadCount > 1 ? "s" : ""}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const newState = !isExpanded;
                setIsExpanded(newState);
                if (onShopToggle) onShopToggle(newState);
              }}
              className={`shrink-0 w-10 h-10 rounded-full backdrop-blur-xl border flex items-center justify-center transition-all ${
                isExpanded 
                  ? "bg-white text-black border-white" 
                  : "bg-white/10 text-white border-white/20 hover:bg-white/20"
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => setLocation(`/chat/${conv.id}`)}
              className="relative shrink-0 w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-white" />
              {conv.unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold shadow-lg ring-2 ring-black">
                  {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Storefront Area */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative z-10 bg-[#111]"
          >
            <div className="pt-2 border-t border-white/5">
              <CartProvider>
                <ClientArtistCardExpanded artistId={artist.id} />
              </CartProvider>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
