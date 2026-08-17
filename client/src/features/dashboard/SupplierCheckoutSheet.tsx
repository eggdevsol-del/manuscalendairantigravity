/**
 * SupplierCheckoutSheet — Multi-step checkout for supplier orders.
 *
 * Steps:
 *   1. Review   — Cart summary with line items, fees, shipping, total
 *   2. Payment  — Embedded Stripe Checkout
 *   3. Success  — Confirmation with auto-close
 *
 * Matches the existing deposit/payment-request flow pattern.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Check,
  Loader2,
  ShoppingCart,
  ChevronRight,
  ArrowLeft,
  Truck,
  Shield,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { EmbeddedStripeCheckout } from "@/features/stripe/EmbeddedStripeCheckout";
import { toast } from "sonner";

// ── Design Tokens ────────────────────────────────────────────

const DT = {
  bg: "#0d0d0e",
  card: "#131314",
  cardBorder: "rgba(255,255,255,.08)",
  textPrimary: "rgba(255,255,255,.95)",
  textSecondary: "rgba(255,255,255,.55)",
  textTertiary: "rgba(255,255,255,.36)",
  green: "#34c759",
  amber: "#f2ca5c",
  amberOnColor: "#1a1a00",
  track: "rgba(255,255,255,.08)",
};

function formatCents(cents: number, currency: string = "AUD"): string {
  const abs = Math.abs(cents);
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()] || "$";
  return `${symbol}${(abs / 100).toFixed(2)}`;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  AUD: "A$",
  NZD: "NZ$",
  USD: "$",
  GBP: "£",
  CAD: "C$",
  EUR: "€",
  JPY: "¥",
  SGD: "S$",
};

// ── Types ────────────────────────────────────────────────────

interface CartItem {
  productId: number;
  variantId: number;
  quantity: number;
  priceCents: number;
  productTitle: string;
  variantTitle: string;
}

type CheckoutStep = "review" | "payment" | "success";

interface SupplierCheckoutSheetProps {
  supplierId: number;
  supplierName: string;
  cartItems: CartItem[];
  onClose: () => void;
  onSuccess: () => void;
}

// ── Success Screen ───────────────────────────────────────────

function SuccessScreen({
  supplierName,
  orderId,
  onClose,
}: {
  supplierName: string;
  orderId: number;
  onClose: () => void;
}) {
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onClose]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 24px",
        textAlign: "center",
      }}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          background: DT.green,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <Check size={32} color="#fff" />
      </motion.div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: DT.textPrimary,
          marginBottom: 8,
        }}
      >
        Order Placed
      </div>
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.5,
          color: DT.textSecondary,
          marginBottom: 4,
        }}
      >
        Your order with <strong>{supplierName}</strong> has been placed
        successfully.
      </div>
      <div
        style={{
          fontSize: 12,
          color: DT.textTertiary,
          marginBottom: 24,
        }}
      >
        Order #{orderId}
      </div>
      <button
        onClick={onClose}
        style={{
          padding: "10px 24px",
          borderRadius: 12,
          background: DT.track,
          color: DT.textSecondary,
          fontSize: 13,
          fontWeight: 600,
          border: "none",
          cursor: "pointer",
        }}
      >
        Close ({countdown})
      </button>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

export function SupplierCheckoutSheet({
  supplierId,
  supplierName,
  cartItems,
  onClose,
  onSuccess,
}: SupplierCheckoutSheetProps) {
  const [step, setStep] = useState<CheckoutStep>("review");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [checkoutData, setCheckoutData] = useState<{
    subtotalCents: number;
    platformFeeCents: number;
    shippingCents: number;
    totalCents: number;
    currency: string;
    exchangeRate: number;
    supplierCurrency: string;
  } | null>(null);

  // Fetch shipping rates
  const { data: shippingData } = trpc.supplierOrders.getShippingRates.useQuery({
    supplierId,
  });

  const [selectedShippingRate, setSelectedShippingRate] = useState<string | undefined>();

  // Auto-select first shipping rate
  useEffect(() => {
    if (shippingData?.rates?.length && !selectedShippingRate) {
      setSelectedShippingRate(shippingData.rates[0].name);
    }
  }, [shippingData]);

  const checkoutMutation = trpc.supplierOrders.createSupplierCheckout.useMutation();
  const confirmMutation = trpc.supplierOrders.confirmSupplierOrder.useMutation();

  // Local subtotal (from cart items — before server calculation)
  const localSubtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.priceCents * item.quantity, 0),
    [cartItems]
  );

  const handleContinueToPayment = async () => {
    try {
      setIsSubmitting(true);

      const res = await checkoutMutation.mutateAsync({
        supplierId,
        items: cartItems.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        shippingRateName: selectedShippingRate,
      });

      if (res.clientSecret) {
        setClientSecret(res.clientSecret);
        setOrderId(res.orderId);
        setCheckoutData({
          subtotalCents: res.subtotalCents,
          platformFeeCents: res.platformFeeCents,
          shippingCents: res.shippingCents,
          totalCents: res.totalCents,
          currency: res.currency,
          exchangeRate: res.exchangeRate,
          supplierCurrency: res.supplierCurrency,
        });
        setStep("payment");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create checkout");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentComplete = useCallback(async () => {
    if (!orderId) return;

    // Get the session ID from the URL params (Stripe redirect)
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    if (sessionId) {
      try {
        await confirmMutation.mutateAsync({
          orderId,
          stripeSessionId: sessionId,
        });
      } catch (error: any) {
        console.error("Order confirmation failed:", error);
        // Payment succeeded but confirmation failed — still show success
      }
    }

    setStep("success");
  }, [orderId]);

  const handleClose = () => {
    if (step === "success") {
      onSuccess();
    }
    onClose();
  };

  const currency = checkoutData?.currency || "AUD";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          background: "rgba(0,0,0,.6)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && step !== "payment") handleClose();
        }}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          style={{
            width: "100%",
            maxWidth: 480,
            maxHeight: "90vh",
            background: DT.bg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              borderBottom: `1px solid ${DT.cardBorder}`,
              background: DT.bg,
              zIndex: 10,
              flexShrink: 0,
            }}
          >
            {step === "payment" ? (
              <button
                onClick={() => setStep("review")}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                <ArrowLeft size={20} color={DT.textSecondary} />
              </button>
            ) : (
              <div style={{ width: 28 }} />
            )}
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: DT.textPrimary,
              }}
            >
              {step === "review"
                ? "Review Order"
                : step === "payment"
                ? "Payment"
                : "Complete"}
            </span>
            <button
              onClick={handleClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
              }}
            >
              <X size={20} color={DT.textSecondary} />
            </button>
          </div>

          {/* Content */}
          {step === "review" && (
            <div style={{ padding: "20px", paddingBottom: 0, flex: 1, overflowY: "auto", minHeight: 0 }}>
              {/* Supplier name */}
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: DT.textTertiary,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 12,
                }}
              >
                <ShoppingCart
                  size={12}
                  style={{ marginRight: 6, verticalAlign: "middle" }}
                />
                {supplierName}
              </div>

              {/* Line items */}
              <div
                style={{
                  background: DT.card,
                  border: `1px solid ${DT.cardBorder}`,
                  borderRadius: 16,
                  overflow: "hidden",
                  marginBottom: 16,
                }}
              >
                {cartItems.map((item, i) => (
                  <div
                    key={item.variantId}
                    style={{
                      padding: "14px 16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      borderBottom:
                        i < cartItems.length - 1
                          ? `1px solid ${DT.cardBorder}`
                          : "none",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: DT.textPrimary,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.productTitle}
                      </div>
                      {item.variantTitle && (
                        <div
                          style={{
                            fontSize: 12,
                            color: DT.textTertiary,
                            marginTop: 2,
                          }}
                        >
                          {item.variantTitle}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: 12,
                          color: DT.textSecondary,
                          marginTop: 4,
                        }}
                      >
                        Qty: {item.quantity}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: DT.textPrimary,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatCents(item.priceCents * item.quantity, currency)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Shipping rates selector */}
              {shippingData?.rates && shippingData.rates.length > 0 && (
                <div
                  style={{
                    background: DT.card,
                    border: `1px solid ${DT.cardBorder}`,
                    borderRadius: 16,
                    padding: "14px 16px",
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: DT.textTertiary,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: 10,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Truck size={12} /> Shipping
                  </div>
                  {shippingData.rates.map((rate) => (
                    <label
                      key={rate.name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <input
                          type="radio"
                          name="shipping"
                          checked={selectedShippingRate === rate.name}
                          onChange={() => setSelectedShippingRate(rate.name)}
                          style={{ accentColor: DT.amber }}
                        />
                        <span
                          style={{
                            fontSize: 14,
                            color: DT.textPrimary,
                            fontWeight: 500,
                          }}
                        >
                          {rate.name}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color:
                            rate.priceCents === 0 ? DT.green : DT.textPrimary,
                        }}
                      >
                        {rate.priceCents === 0
                          ? "Free"
                          : formatCents(rate.priceCents, rate.currency)}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {/* Totals summary */}
              <div
                style={{
                  background: DT.card,
                  border: `1px solid ${DT.cardBorder}`,
                  borderRadius: 16,
                  padding: "14px 16px",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <span style={{ fontSize: 14, color: DT.textSecondary }}>
                    Subtotal
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      color: DT.textPrimary,
                      fontWeight: 600,
                    }}
                  >
                    {formatCents(localSubtotal, currency)}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      color: DT.textSecondary,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Shield size={12} /> d.o.t.s service fee
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      color: DT.textTertiary,
                      fontWeight: 500,
                    }}
                  >
                    Calculated at checkout
                  </span>
                </div>
                <div
                  style={{
                    borderTop: `1px solid ${DT.cardBorder}`,
                    marginTop: 8,
                    paddingTop: 8,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: DT.textPrimary,
                    }}
                  >
                    Estimated Total
                  </span>
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: DT.amber,
                    }}
                  >
                    {formatCents(localSubtotal, currency)}+
                  </span>
                </div>
              </div>
              {/* Checkout button — directly in content flow */}
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={handleContinueToPayment}
                  disabled={isSubmitting || cartItems.length === 0}
                  style={{
                    width: "100%",
                    padding: "16px 20px",
                    borderRadius: 16,
                    background: isSubmitting ? DT.track : DT.amber,
                    color: isSubmitting ? DT.textTertiary : DT.amberOnColor,
                    fontSize: 16,
                    fontWeight: 700,
                    border: "none",
                    cursor: isSubmitting ? "default" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    minHeight: 56,
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Preparing checkout...
                    </>
                  ) : (
                    <>
                      Continue to Payment
                      <ChevronRight size={18} />
                    </>
                  )}
                </button>
              </div>
              {/* Bottom spacer for nav bar */}
              <div style={{ height: 100 }} />
            </div>
          )}

          {step === "payment" && clientSecret && (
            <div style={{ padding: "20px", flex: 1 }}>
              {/* Show final totals from server */}
              {checkoutData && (
                <div
                  style={{
                    background: DT.card,
                    border: `1px solid ${DT.cardBorder}`,
                    borderRadius: 16,
                    padding: "14px 16px",
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 13, color: DT.textSecondary }}>
                      Subtotal
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: DT.textPrimary,
                        fontWeight: 600,
                      }}
                    >
                      {formatCents(checkoutData.subtotalCents, checkoutData.currency)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 13, color: DT.textSecondary }}>
                      d.o.t.s fee
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: DT.textPrimary,
                        fontWeight: 600,
                      }}
                    >
                      {formatCents(checkoutData.platformFeeCents, checkoutData.currency)}
                    </span>
                  </div>
                  {checkoutData.shippingCents > 0 && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ fontSize: 13, color: DT.textSecondary }}>
                        Shipping
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          color: DT.textPrimary,
                          fontWeight: 600,
                        }}
                      >
                        {formatCents(checkoutData.shippingCents, checkoutData.currency)}
                      </span>
                    </div>
                  )}
                  {checkoutData.exchangeRate !== 1 && (
                    <div
                      style={{
                        fontSize: 11,
                        color: DT.textTertiary,
                        marginTop: 4,
                        textAlign: "right",
                      }}
                    >
                      Converted from {checkoutData.supplierCurrency} at{" "}
                      {checkoutData.exchangeRate.toFixed(4)}
                    </div>
                  )}
                  <div
                    style={{
                      borderTop: `1px solid ${DT.cardBorder}`,
                      marginTop: 8,
                      paddingTop: 8,
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: DT.textPrimary,
                      }}
                    >
                      Total
                    </span>
                    <span
                      style={{ fontSize: 15, fontWeight: 700, color: DT.amber }}
                    >
                      {formatCents(checkoutData.totalCents, checkoutData.currency)}
                    </span>
                  </div>
                </div>
              )}

              <EmbeddedStripeCheckout
                clientSecret={clientSecret}
                onComplete={handlePaymentComplete}
              />
            </div>
          )}

          {step === "success" && orderId && (
            <SuccessScreen
              supplierName={supplierName}
              orderId={orderId}
              onClose={handleClose}
            />
          )}
        </motion.div>

      </motion.div>
    </AnimatePresence>
  );
}
