import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Package, Store, Truck, Globe, Plus, Minus, ShoppingCart, X, ChevronUp } from "lucide-react";
import { useCart } from "./CartContext";

interface StorefrontProductCardProps {
  product: any;
}

export function StorefrontProductCard({ product }: StorefrontProductCardProps) {
  const { items, addItem, removeItem } = useCart();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const inCart = items.find(i => i.productId === product.id)?.quantity || 0;
  const isMaxed = inCart >= product.inventoryCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 rounded-[24px] border border-white/10 overflow-hidden flex flex-col hover:border-white/20 transition-colors relative"
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
        <h3 className="text-lg font-bold mb-1 truncate h-[28px]">{product.title}</h3>
        
        <div className="relative h-[64px] mb-4 flex flex-col justify-start">
          <p className="text-white/50 text-sm line-clamp-2 leading-relaxed">
            {product.description}
          </p>
          {product.description && product.description.length > 60 && (
            <button 
              onClick={() => setIsExpanded(true)}
              className="text-xs text-indigo-400 font-bold mt-auto self-start hover:text-indigo-300 transition-colors flex items-center gap-1"
            >
              Read more <ChevronUp className="w-3 h-3" />
            </button>
          )}
        </div>
        
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
          <span className="text-xl font-bold tracking-tight">
            ${(product.priceCents / 100).toFixed(2)}
          </span>
          
          {product.inventoryCount <= 0 ? (
            <span className="text-red-400 font-semibold text-sm bg-red-500/10 px-4 py-2 rounded-full">
              Sold Out
            </span>
          ) : inCart > 0 ? (
            <div className="flex items-center gap-3 bg-white/10 rounded-full p-1 border border-white/10">
              <button
                onClick={() => removeItem(product.id)}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <Minus className="w-4 h-4 text-white" />
              </button>
              <span className="font-bold w-4 text-center">{inCart}</span>
              <button
                onClick={() => {
                  if (!isMaxed) {
                    addItem({
                      productId: product.id,
                      title: product.title,
                      priceCents: product.priceCents,
                      shippingCents: product.shippingCents || 0,
                      imageUrl: product.imageUrl,
                      fulfillmentType: product.fulfillmentType,
                      maxInventory: product.inventoryCount,
                      artistId: product.artistId
                    });
                  }
                }}
                disabled={isMaxed}
                className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center hover:bg-indigo-400 transition-colors disabled:opacity-50 disabled:hover:bg-indigo-500"
              >
                <Plus className="w-4 h-4 text-white" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                addItem({
                  productId: product.id,
                  title: product.title,
                  priceCents: product.priceCents,
                  shippingCents: product.shippingCents || 0,
                  imageUrl: product.imageUrl,
                  fulfillmentType: product.fulfillmentType,
                  maxInventory: product.inventoryCount,
                  artistId: product.artistId
                });
              }}
              className="flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-full font-bold hover:bg-white/90 active:scale-95 transition-all shadow-[0_0_15px_rgba(255,255,255,0.3)] hover:shadow-[0_0_25px_rgba(255,255,255,0.5)]"
            >
              <ShoppingCart className="w-4 h-4" />
              Add
            </button>
          )}
        </div>
      </div>

      {/* Expanded Description Overlay */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute inset-0 z-30 bg-[#111]/95 backdrop-blur-xl flex flex-col"
          >
            <div className="p-5 flex items-center justify-between border-b border-white/10 bg-black/20 shrink-0">
              <h3 className="font-bold text-lg text-white">Description</h3>
              <button 
                onClick={() => setIsExpanded(false)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 text-white shrink-0 transition-colors shadow-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto mobile-scroll flex-1">
              <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">
                {product.description}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
