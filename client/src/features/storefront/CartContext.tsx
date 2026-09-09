import React, { createContext, useContext, useState, useEffect } from "react";

export interface CartItem {
  cartItemId: string; // usually `${productId}-${variantId || 'base'}`
  productId: number;
  variantId?: number;
  variantName?: string;
  title: string;
  priceCents: number;
  shippingCents: number;
  imageUrl: string | null;
  fulfillmentType: "pickup" | "delivery" | "both" | "digital";
  quantity: number;
  maxInventory: number;
  artistId: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity" | "cartItemId">) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, delta: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotalCents: number;
  artistId: string | null;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({
  children,
  storeId,
}: {
  children: React.ReactNode;
  storeId?: string;
}) {
  const storageKey = storeId ? `tattoi_cart_${storeId}` : "tattoi_cart";
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(parsed)) return [];
      const valid = parsed.filter(
        (item): item is CartItem =>
          item &&
          typeof item === "object" &&
          typeof item.cartItemId === "string" &&
          typeof item.artistId === "string" &&
          typeof item.title === "string" &&
          Number.isSafeInteger(item.productId) &&
          item.productId > 0 &&
          (item.variantId === undefined ||
            (Number.isSafeInteger(item.variantId) && item.variantId > 0)) &&
          Number.isSafeInteger(item.priceCents) &&
          item.priceCents >= 0 &&
          Number.isSafeInteger(item.shippingCents) &&
          item.shippingCents >= 0 &&
          Number.isSafeInteger(item.quantity) &&
          item.quantity > 0 &&
          item.quantity <= 100 &&
          Number.isSafeInteger(item.maxInventory) &&
          item.maxInventory >= item.quantity &&
          ["pickup", "delivery", "both", "digital"].includes(
            item.fulfillmentType
          )
      );
      return valid
        .filter(
          (item, index) =>
            item.artistId === valid[0]?.artistId &&
            valid.findIndex(other => other.cartItemId === item.cartItemId) ===
              index
        )
        .slice(0, 100);
    } catch (e) {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      /* Cart remains usable when browser storage is unavailable. */
    }
  }, [items]);

  const addItem = (newItem: Omit<CartItem, "quantity" | "cartItemId">) => {
    const cartItemId = `${newItem.productId}-${newItem.variantId || "base"}`;
    setItems(prev => {
      // If adding from a different artist, we must clear the cart first
      // because our checkout flow assumes single-artist orders
      let currentCart = prev;
      if (
        currentCart.length > 0 &&
        currentCart[0].artistId !== newItem.artistId
      ) {
        currentCart = [];
      }

      const existing = currentCart.find(i => i.cartItemId === cartItemId);
      if (existing) {
        return currentCart.map(i =>
          i.cartItemId === cartItemId
            ? { ...i, quantity: Math.min(i.quantity + 1, i.maxInventory) }
            : i
        );
      }
      return [...currentCart, { ...newItem, quantity: 1, cartItemId }];
    });
    setIsCartOpen(true);
  };

  const removeItem = (cartItemId: string) => {
    setItems(prev => prev.filter(i => i.cartItemId !== cartItemId));
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setItems(prev =>
      prev
        .map(i => {
          if (i.cartItemId === cartItemId) {
            const newQ = Math.max(
              0,
              Math.min(i.quantity + delta, i.maxInventory)
            );
            return { ...i, quantity: newQ };
          }
          return i;
        })
        .filter(i => i.quantity > 0)
    );
  };

  const clearCart = () => setItems([]);

  const totalItems = items.reduce((acc, i) => acc + i.quantity, 0);
  const subtotalCents = items.reduce(
    (acc, i) => acc + i.priceCents * i.quantity,
    0
  );
  const artistId = items.length > 0 ? items[0].artistId : null;

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        subtotalCents,
        artistId,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
