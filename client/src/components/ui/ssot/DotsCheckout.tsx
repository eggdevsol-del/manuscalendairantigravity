/**
 * DotsCheckout — SSOT Custom Checkout Component
 *
 * Single source of truth for ALL payment checkout UI in d.o.t.s.
 * Replaces the Stripe Embedded Checkout iframe with a native d.o.t.s
 * design using Stripe Payment Element for PCI-compliant card collection.
 *
 * EVERY checkout in the app MUST use this component.
 *
 * Features:
 * - Apple Pay / Google Pay (via Payment Request Button)
 * - Card payment (via Payment Element)
 * - Stripe Link integration (auto-detected by Payment Element)
 * - Dark theme matching d.o.t.s design system
 * - 🔒 "Payments secured by Stripe" trust badge
 *
 * @version 1.0.0
 */

import React, { useState, useCallback } from "react";
import { loadStripe, type Appearance } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Loader2, Lock, ArrowLeft } from "lucide-react";

// Load Stripe outside render to avoid re-creating on every render
const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ""
);

// ── Stripe Elements Appearance (Dark Theme) ──────────────────────────────────
const appearance: Appearance = {
  theme: "night",
  variables: {
    colorPrimary: "#F8D057",
    colorBackground: "#232326",
    colorText: "#FFFFFF",
    colorTextSecondary: "#7A7A7A",
    colorDanger: "#ff4d4f",
    borderRadius: "12px",
    fontFamily: '"DM Sans", "Inter", system-ui, sans-serif',
    fontSizeBase: "15px",
    spacingGridRow: "16px",
    spacingGridColumn: "12px",
  },
  rules: {
    ".Input": {
      border: "1px solid rgba(255,255,255,0.12)",
      backgroundColor: "#1A1A1E",
      color: "#FFFFFF",
      padding: "14px 12px",
      fontSize: "15px",
      transition: "border-color 200ms ease, box-shadow 200ms ease",
    },
    ".Input:focus": {
      border: "1px solid #F8D057",
      boxShadow: "0 0 0 2px rgba(248,208,87,0.15)",
    },
    ".Input::placeholder": {
      color: "#555",
    },
    ".Label": {
      color: "#999",
      fontSize: "12px",
      fontWeight: "500",
      textTransform: "uppercase" as any,
      letterSpacing: "0.5px",
      marginBottom: "6px",
    },
    ".Tab": {
      border: "1px solid rgba(255,255,255,0.12)",
      backgroundColor: "#1A1A1E",
      color: "#FFFFFF",
      borderRadius: "12px",
    },
    ".Tab--selected": {
      border: "1px solid #F8D057",
      backgroundColor: "#1A1A1E",
      color: "#FFFFFF",
      boxShadow: "0 0 0 2px rgba(248,208,87,0.15)",
    },
    ".Tab:hover": {
      border: "1px solid rgba(255,255,255,0.25)",
    },
    ".Error": {
      color: "#ff4d4f",
      fontSize: "13px",
    },
  },
};

// ── Props ────────────────────────────────────────────────────────────────────
export interface DotsCheckoutProps {
  /** PaymentIntent client_secret from the server */
  clientSecret: string;
  /** Total amount in cents (for display) */
  amountCents: number;
  /** Currency code (default: "aud") */
  currency?: string;
  /** Artist name — used in UI context */
  artistName?: string;
  /** Called after successful payment confirmation */
  onComplete: () => void;
  /** Called on payment error */
  onError?: (error: string) => void;
  /** Back button handler */
  onBack?: () => void;
}

// ── Main Component (wraps Elements provider) ─────────────────────────────────
export function DotsCheckout({
  clientSecret,
  amountCents,
  currency = "aud",
  artistName,
  onComplete,
  onError,
  onBack,
}: DotsCheckoutProps) {
  if (!clientSecret) return null;

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance,
        loader: "auto",
      }}
    >
      <CheckoutForm
        amountCents={amountCents}
        currency={currency}
        artistName={artistName}
        onComplete={onComplete}
        onError={onError}
        onBack={onBack}
      />
    </Elements>
  );
}

// ── Inner Checkout Form ──────────────────────────────────────────────────────
function CheckoutForm({
  amountCents,
  currency,
  artistName,
  onComplete,
  onError,
  onBack,
}: Omit<DotsCheckoutProps, "clientSecret">) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const formattedAmount = formatCurrency(amountCents, currency);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!stripe || !elements) return;

      setIsProcessing(true);
      setErrorMessage(null);

      try {
        const { error } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            // No return_url needed — we handle completion inline
            return_url: window.location.href,
          },
          redirect: "if_required",
        });

        if (error) {
          const msg =
            error.type === "card_error" || error.type === "validation_error"
              ? error.message || "Payment failed"
              : "An unexpected error occurred. Please try again.";
          setErrorMessage(msg);
          onError?.(msg);
        } else {
          // Payment succeeded without redirect
          onComplete();
        }
      } catch (err: any) {
        const msg = err.message || "Payment failed";
        setErrorMessage(msg);
        onError?.(msg);
      } finally {
        setIsProcessing(false);
      }
    },
    [stripe, elements, onComplete, onError]
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Amount display */}
      <div className="flex items-center justify-between px-1 pt-1 pb-2">
        <span
          style={{ color: "#7A7A7A", fontSize: 13, fontWeight: 500 }}
        >
          Paying
        </span>
        <span
          style={{
            color: "#FFFFFF",
            fontSize: 22,
            fontWeight: 700,
            fontFamily: '"DM Sans", sans-serif',
          }}
        >
          {formattedAmount}
        </span>
      </div>

      {/* Stripe Payment Element — renders card, Apple Pay, Google Pay, Link */}
      <div
        style={{
          background: "#1A1A1E",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: 16,
          minHeight: isReady ? undefined : 200,
          position: "relative",
        }}
      >
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2
              className="w-6 h-6 animate-spin"
              style={{ color: "#F8D057" }}
            />
          </div>
        )}
        <PaymentElement
          onReady={() => setIsReady(true)}
          options={{
            layout: {
              type: "tabs",
              defaultCollapsed: false,
            },
            wallets: {
              applePay: "auto",
              googlePay: "auto",
            },
          }}
        />
      </div>

      {/* Error message */}
      {errorMessage && (
        <div
          style={{
            background: "rgba(255,77,79,0.1)",
            border: "1px solid rgba(255,77,79,0.3)",
            borderRadius: 12,
            padding: "10px 14px",
            color: "#ff4d4f",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Trust badge */}
      <div
        className="flex items-center justify-center gap-1.5"
        style={{ color: "#555", fontSize: 12, padding: "4px 0" }}
      >
        <Lock className="w-3 h-3" />
        <span>Payments secured by Stripe</span>
      </div>

      {/* Pay button */}
      <button
        type="submit"
        disabled={!stripe || !elements || isProcessing || !isReady}
        className="w-full flex items-center justify-center gap-2 font-bold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          height: 52,
          borderRadius: 14,
          fontSize: 16,
          fontFamily: '"DM Sans", sans-serif',
          background: isProcessing
            ? "rgba(248,208,87,0.7)"
            : "linear-gradient(135deg, #F8D057 0%, #F0C040 100%)",
          color: "#1B1B1B",
          border: "none",
          cursor: isProcessing ? "wait" : "pointer",
          boxShadow: "0 2px 12px rgba(248,208,87,0.25)",
        }}
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Processing…</span>
          </>
        ) : (
          <span>Pay {formattedAmount}</span>
        )}
      </button>

      {/* Back link */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center gap-1 transition-colors"
          style={{
            color: "#7A7A7A",
            fontSize: 14,
            fontWeight: 500,
            padding: "8px 0",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          Back
        </button>
      )}
    </form>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatCurrency(cents: number, currency = "aud"): string {
  const amount = cents / 100;
  const prefix = currency.toUpperCase() === "AUD" ? "A$" : "$";
  return `${prefix}${amount.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
