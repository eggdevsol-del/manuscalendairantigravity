import { useEffect, useState } from "react";
import { useCart } from "./CartContext";
import { trpc } from "@/lib/trpc";
import { DotsCheckout } from "@/components/ui/ssot/DotsCheckout";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { Button } from "@/components/ui";
import { calculateTransactionFees } from "@shared/fees";
import {
  OrderConfirmation,
  returnedOrder,
  type OrderIdentity,
} from "./OrderConfirmation";

export function StorefrontCheckoutFAB({
  onClose,
  artistSlug,
  artistId,
  currency = "AUD",
}: {
  onClose: () => void;
  artistSlug: string;
  artistId: string;
  currency?: string;
}) {
  const {
    items,
    subtotalCents,
    updateQuantity,
    removeItem,
    clearCart,
    isCartOpen,
    setIsCartOpen,
  } = useCart();
  const [step, setStep] = useState<"review" | "payment" | "confirming">(() =>
    returnedOrder() ? "confirming" : "review"
  );
  const [identity, setIdentity] = useState<OrderIdentity | null>(returnedOrder);
  const [secret, setSecret] = useState<string | null>(null);
  const [chargedTotal, setChargedTotal] = useState(0);
  const available = (["pickup", "delivery", "digital"] as const).filter(
    method =>
      items.every(
        item =>
          item.fulfillmentType === method ||
          (item.fulfillmentType === "both" && method !== "digital")
      )
  );
  const [choice, setChoice] = useState<"pickup" | "delivery" | "digital">(
    "delivery"
  );
  const method = available.includes(choice) ? choice : available[0];
  const shipping =
    method === "delivery"
      ? items.reduce((sum, item) => sum + item.shippingCents * item.quantity, 0)
      : 0;
  const fee = items.length
    ? calculateTransactionFees(subtotalCents + shipping, "free")
        .platformFeeCents
    : 0;
  const total = subtotalCents + shipping + fee;
  const checkout = trpc.storefront.createStorefrontCheckout.useMutation();
  const cancel = trpc.storefront.cancelStoreCheckout.useMutation();
  useEffect(() => {
    if (identity) setIsCartOpen(true);
  }, []);
  const pay = async () => {
    if (!method) return;
    try {
      const result = await checkout.mutateAsync({
        items: items.map(item => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        fulfillmentMethod: method,
      });
      setIdentity({ orderId: result.orderId, sessionId: result.sessionId });
      setChargedTotal(result.totalCents);
      if (result.clientSecret) {
        setSecret(result.clientSecret);
        setStep("payment");
      } else if (result.url) window.location.assign(result.url);
    } catch {
      /* Mutation error is rendered below. */
    }
  };
  const edit = async () => {
    if (identity) {
      try {
        const result = await cancel.mutateAsync(identity);
        if (!result.cancelled) {
          setStep("confirming");
          return;
        }
      } catch {
        return;
      }
    }
    setSecret(null);
    setIdentity(null);
    setStep("review");
  };
  return (
    <SheetShell
      isOpen={isCartOpen}
      onClose={() => {
        setIsCartOpen(false);
        onClose();
      }}
      title={
        step === "review"
          ? "Your cart"
          : step === "payment"
            ? "Checkout"
            : "Order status"
      }
      description="Review your items and payment securely."
      className="h-[90dvh] max-h-[90dvh]"
    >
      {step === "review" && (
        <div className="max-w-xl mx-auto space-y-5 pb-6">
          {!items.length ? (
            <p className="text-center py-8">Your cart is empty.</p>
          ) : (
            <>
              {items.map(item => (
                <article
                  key={item.cartItemId}
                  className="rounded-2xl border p-4 space-y-3"
                >
                  <div className="flex justify-between gap-3">
                    <h3 className="font-semibold">
                      {item.title}
                      {item.variantName && (
                        <span className="block text-sm text-muted-foreground">
                          {item.variantName}
                        </span>
                      )}
                    </h3>
                    <strong>
                      ${((item.priceCents * item.quantity) / 100).toFixed(2)}
                    </strong>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      aria-label={`Decrease ${item.title}`}
                      onClick={() => updateQuantity(item.cartItemId, -1)}
                    >
                      −
                    </Button>
                    <span>{item.quantity}</span>
                    <Button
                      variant="outline"
                      aria-label={`Increase ${item.title}`}
                      disabled={item.quantity >= item.maxInventory}
                      onClick={() => updateQuantity(item.cartItemId, 1)}
                    >
                      +
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => removeItem(item.cartItemId)}
                    >
                      Remove
                    </Button>
                  </div>
                </article>
              ))}
              <label className="block space-y-2">
                <span className="font-medium">Delivery method</span>
                <select
                  className="w-full rounded-xl border bg-background p-3"
                  value={method || ""}
                  onChange={e => setChoice(e.target.value as typeof choice)}
                >
                  {available.map(option => (
                    <option key={option} value={option}>
                      {option === "digital"
                        ? "Digital delivery"
                        : option === "pickup"
                          ? "Pick up"
                          : "Ship to me"}
                    </option>
                  ))}
                </select>
              </label>
              {!method && (
                <p role="alert">
                  These items need different delivery methods. Check them out
                  separately.
                </p>
              )}
              <dl className="rounded-2xl bg-secondary p-5 space-y-2">
                <div className="flex justify-between">
                  <dt>Subtotal</dt>
                  <dd>${(subtotalCents / 100).toFixed(2)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Shipping</dt>
                  <dd>${(shipping / 100).toFixed(2)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Platform fee</dt>
                  <dd>${(fee / 100).toFixed(2)}</dd>
                </div>
                <div className="flex justify-between font-bold border-t pt-3">
                  <dt>Total ({currency.toUpperCase()})</dt>
                  <dd>${(total / 100).toFixed(2)}</dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">
                Stock is held for 30 minutes after checkout opens. Final prices
                are confirmed by the store.
              </p>
              <Button
                className="w-full min-h-12"
                disabled={checkout.isPending || !method}
                onClick={() => void pay()}
              >
                {checkout.isPending
                  ? "Preparing checkout…"
                  : "Continue to payment"}
              </Button>
            </>
          )}
        </div>
      )}
      {(checkout.error || cancel.error) && (
        <p role="alert" className="text-destructive">
          {(checkout.error || cancel.error)?.message}
        </p>
      )}
      {step === "payment" && secret && (
        <div className="min-h-[500px]">
          <DotsCheckout
            clientSecret={secret}
            amountCents={chargedTotal}
            onComplete={() => setStep("confirming")}
            onBack={() => void edit()}
          />
          {cancel.isPending && <p role="status">Releasing this checkout…</p>}
        </div>
      )}
      {step === "confirming" && identity && (
        <OrderConfirmation identity={identity} onConfirmed={clearCart} />
      )}
    </SheetShell>
  );
}
