import React, { createContext, useContext, useState, useEffect } from "react";

export interface CartItem {
  productId: number;
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
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, delta: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotalCents: number;
  artistId: string | null;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem("tattoi_cart");
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("tattoi_cart", JSON.stringify(items));
  }, [items]);

  const addItem = (newItem: Omit<CartItem, "quantity">) => {
    setItems((prev) => {
      // If adding from a different artist, we must clear the cart first
      // because our checkout flow assumes single-artist orders
      let currentCart = prev;
      if (currentCart.length > 0 && currentCart[0].artistId !== newItem.artistId) {
        currentCart = [];
      }

      const existing = currentCart.find((i) => i.productId === newItem.productId);
      if (existing) {
        return currentCart.map((i) =>
          i.productId === newItem.productId
            ? { ...i, quantity: Math.min(i.quantity + 1, i.maxInventory) }
            : i
        );
      }
      return [...currentCart, { ...newItem, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const removeItem = (productId: number) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const updateQuantity = (productId: number, delta: number) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.productId === productId) {
          const newQ = Math.max(0, Math.min(i.quantity + delta, i.maxInventory));
          return { ...i, quantity: newQ };
        }
        return i;
      }).filter((i) => i.quantity > 0)
    );
  };

  const clearCart = () => setItems([]);

  const totalItems = items.reduce((acc, i) => acc + i.quantity, 0);
  const subtotalCents = items.reduce((acc, i) => acc + i.priceCents * i.quantity, 0);
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
