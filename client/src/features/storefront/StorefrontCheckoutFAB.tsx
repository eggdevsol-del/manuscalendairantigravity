import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingCart, Plus, Minus, ChevronRight, Loader2, Package, CheckCircle2 } from "lucide-react";
import { useCart } from "./CartContext";
import { trpc } from "@/lib/trpc";
import { EmbeddedStripeCheckout } from "@/features/stripe/EmbeddedStripeCheckout";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";

type CheckoutStep = "review" | "details" | "payment" | "success";

export function StorefrontCheckoutFAB({
  onClose,
  artistSlug,
  artistId,
}: {
  onClose: () => void;
  artistSlug: string;
  artistId: string;
}) {
  const { user } = useAuth();
  const { items, subtotalCents, totalItems, updateQuantity, removeItem, clearCart, isCartOpen, setIsCartOpen } = useCart();
  const [step, setStep] = useState<CheckoutStep>("review");
  const [isGenerating, setIsGenerating] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("status") === "success") {
      setStep("success");
      setIsCartOpen(true);
      clearCart();
      
      // Clean up the URL so it doesn't trigger again on refresh
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  const checkoutMutation = trpc.storefront.createStorefrontCheckout.useMutation();

  const fulfillmentMethod = items.some((i) => ["delivery", "both"].includes(i.fulfillmentType))
    ? "delivery"
    : "pickup";

  const totalShippingCents = fulfillmentMethod === "delivery"
    ? items.reduce((acc, i) => acc + (i.shippingCents || 0) * i.quantity, 0)
    : 0;

  const totalCents = subtotalCents + totalShippingCents;

  const handleContinueToPayment = async () => {
    try {
      setIsGenerating(true);
      const res = await checkoutMutation.mutateAsync({
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
        fulfillmentMethod,
      });

      if (res.clientSecret) {
        setClientSecret(res.clientSecret);
        setStep("payment");
      } else if (res.url) {
        // Fallback to hosted if embedded not available
        window.location.href = res.url;
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to initialize checkout");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    setIsCartOpen(false);
    if (step === "success") {
      clearCart();
    }
    setTimeout(onClose, 300);
  };

  if (!isCartOpen) return null;

  return (
    <AnimatePresence>
      {isCartOpen && (
        <motion.div
          initial={{ opacity: 0, y: "100%" }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed inset-0 z-[100] bg-[#050505] flex flex-col sm:p-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ShoppingCart className="w-6 h-6" />
              {step === "review" ? "Your Cart" : step === "payment" ? "Checkout" : "Order Confirmed"}
            </h2>
            <button
              onClick={handleClose}
              className="p-2 rounded-full bg-secondary/50 hover:bg-secondary/50 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {step === "review" && (
              <div className="p-4 max-w-2xl mx-auto space-y-6">
                {items.length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground">
                    <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p>Your cart is empty.</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {items.map((item) => (
                        <div key={item.productId} className="flex gap-4 p-4 rounded-[20px] bg-secondary/50 border border-border">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.title} className="w-20 h-20 rounded-[12px] object-cover bg-background/80" />
                          ) : (
                            <div className="w-20 h-20 rounded-[12px] bg-secondary/50 flex items-center justify-center">
                              <Package className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 flex flex-col justify-between">
                            <div className="flex justify-between items-start gap-4">
                              <h3 className="font-bold leading-tight">{item.title}</h3>
                              <button onClick={() => removeItem(item.cartItemId)} className="text-muted-foreground hover:text-white p-1">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="font-bold text-indigo-400">${(item.priceCents / 100).toFixed(2)}</span>
                              
                              <div className="flex items-center gap-3 bg-background/80 rounded-full px-2 py-1 border border-border">
                                <button
                                  onClick={() => updateQuantity(item.cartItemId, -1)}
                                  className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-secondary/50"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                                <button
                                  onClick={() => updateQuantity(item.cartItemId, 1)}
                                  disabled={item.quantity >= item.maxInventory}
                                  className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-secondary/50 disabled:opacity-30"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-5 rounded-[20px] bg-indigo-500/10 border border-indigo-500/20 space-y-3">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span>
                        <span>${(subtotalCents / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Shipping ({fulfillmentMethod === "pickup" ? "Pickup" : "Standard"})</span>
                        <span>{totalShippingCents > 0 ? `$${(totalShippingCents / 100).toFixed(2)}` : "Free"}</span>
                      </div>
                      <div className="border-t border-indigo-500/20 pt-3 flex justify-between font-bold text-lg">
                        <span>Total</span>
                        <span>${(totalCents / 100).toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {step === "payment" && clientSecret && (
              <div className="p-4 max-w-xl mx-auto h-full min-h-[500px]">
                <EmbeddedStripeCheckout
                  clientSecret={clientSecret}
                  onComplete={() => {
                    setStep("success");
                    clearCart();
                  }}
                />
              </div>
            )}

            {step === "success" && (
              <div className="p-4 max-w-xl mx-auto flex flex-col items-center justify-center min-h-[500px] text-center space-y-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", bounce: 0.5 }}
                >
                  <CheckCircle2 className="w-24 h-24 text-green-400" />
                </motion.div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-black">Order Confirmed!</h2>
                  <p className="text-muted-foreground">Your order has been placed. You will receive an email receipt shortly.</p>
                </div>
                <div className="p-6 bg-secondary/50 rounded-[24px] border border-border w-full max-w-sm mt-8 space-y-4">
                  <p className="text-sm text-muted-foreground">You will receive a receipt via email shortly. Your artist will contact you if they need any further details.</p>
                  
                  {!user && (
                    <div className="pt-4 border-t border-border space-y-4">
                      <p className="text-sm font-medium text-white">Want to track your order easily? Save your details by creating an account!</p>
                      <button 
                        onClick={() => {
                          window.location.href = `/signup?role=client&referralArtistId=${artistId}`;
                        }}
                        className="w-full py-3 bg-foreground text-background hover:bg-secondary/50 rounded-full font-bold transition-colors"
                      >
                        Create Account
                      </button>
                    </div>
                  )}

                  <button 
                    onClick={() => {
                      window.location.href = `/${artistSlug}`;
                    }}
                    className="w-full py-3 bg-secondary/50 hover:bg-secondary/50 rounded-full font-bold transition-colors"
                  >
                    Return to Artist Hub
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          {step === "review" && items.length > 0 && (
            <div className="p-4 border-t border-border bg-[#050505] shrink-0 pb-safe">
              <button
                onClick={handleContinueToPayment}
                disabled={isGenerating}
                className="w-full max-w-2xl mx-auto flex items-center justify-between p-4 bg-foreground text-background rounded-full font-bold hover:bg-secondary/50 transition-colors disabled:opacity-50"
              >
                <span>{isGenerating ? "Preparing Checkout..." : "Checkout"}</span>
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="flex items-center gap-2">${(totalCents / 100).toFixed(2)} <ChevronRight className="w-5 h-5" /></span>}
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
