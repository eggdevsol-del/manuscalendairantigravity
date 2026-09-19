import { useEffect, useRef, useState } from "react";
import { useCart } from "./CartContext";
import { trpc } from "@/lib/trpc";
import { DotsCheckout } from "@/components/ui/ssot/DotsCheckout";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { Action as Button } from "@/app-v3/design/primitives";
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
  const [confirmedQuote, setConfirmedQuote] = useState<{
    subtotal: number;
    shipping: number;
    fee: number;
    currency: string;
  } | null>(null);
  const preparing = useRef(false);
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
    if (!method || preparing.current || checkout.isPending || cancel.isPending)
      return;
    preparing.current = true;
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
      setConfirmedQuote({
        subtotal: result.subtotalCents,
        shipping: result.shippingCents,
        fee: result.platformFeeCents,
        currency: result.currency,
      });
      if (result.clientSecret) {
        setSecret(result.clientSecret);
        setStep("payment");
      } else if (result.url) window.location.assign(result.url);
    } catch {
      /* Mutation error is rendered below. */
    } finally {
      preparing.current = false;
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
        if (checkout.isPending || cancel.isPending) return;
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
        <div className="v3-stack">
          {!items.length ? (
            <p className="text-center py-8">Your cart is empty.</p>
          ) : (
            <>
              {items.map(item => (
                <article key={item.cartItemId} className="v3-panel v3-stack">
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
                      tone="secondary"
                      disabled={checkout.isPending}
                      aria-label={`Decrease ${item.title}`}
                      data-tour-description="Reduce this item’s quantity by one. Reducing it to zero removes it from the cart. Review the updated total before checkout."
                      onClick={() => updateQuantity(item.cartItemId, -1)}
                    >
                      −
                    </Button>
                    <span>{item.quantity}</span>
                    <Button
                      tone="secondary"
                      aria-label={`Increase ${item.title}`}
                      data-tour-description="Add one more of this item, up to the available stock limit. The cart total updates; this does not place an order."
                      disabled={
                        checkout.isPending ||
                        item.quantity >= Math.min(item.maxInventory, 100)
                      }
                      onClick={() => updateQuantity(item.cartItemId, 1)}
                    >
                      +
                    </Button>
                    <Button
                      tone="quiet"
                      disabled={checkout.isPending}
                      data-tour-description="Remove this item from your cart. This does not cancel an existing paid order."
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
                  disabled={checkout.isPending}
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
              <dl className="rounded-2xl bg-secondary p-5 space-y-2" data-tour-title="Order total and platform fee" data-tour-description="Review the item subtotal, shipping, platform fee and total in the displayed currency. Changing quantities or delivery can change these amounts; the store confirms final prices when checkout opens.">
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
          {confirmedQuote && (
            <dl className="v3-facts" aria-label="Confirmed checkout total">
              <div>
                <dt>Items</dt>
                <dd>
                  {new Intl.NumberFormat("en-AU", {
                    style: "currency",
                    currency: confirmedQuote.currency,
                  }).format(confirmedQuote.subtotal / 100)}
                </dd>
              </div>
              <div>
                <dt>Shipping</dt>
                <dd>
                  {new Intl.NumberFormat("en-AU", {
                    style: "currency",
                    currency: confirmedQuote.currency,
                  }).format(confirmedQuote.shipping / 100)}
                </dd>
              </div>
              <div>
                <dt>Platform fee</dt>
                <dd>
                  {new Intl.NumberFormat("en-AU", {
                    style: "currency",
                    currency: confirmedQuote.currency,
                  }).format(confirmedQuote.fee / 100)}
                </dd>
              </div>
            </dl>
          )}
          <DotsCheckout
            collectPhone
            clientSecret={secret}
            amountCents={chargedTotal}
            currency={confirmedQuote?.currency || currency}
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
