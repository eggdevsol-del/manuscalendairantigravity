import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout
} from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";

// Make sure to call `loadStripe` outside of a component’s render to avoid
// recreating the `Stripe` object on every render.
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

interface EmbeddedStripeCheckoutProps {
  clientSecret: string;
  onComplete?: () => void;
}

export function EmbeddedStripeCheckout({ clientSecret, onComplete }: EmbeddedStripeCheckoutProps) {
  if (!clientSecret) return null;

  return (
    <div className="w-full rounded-[12px] border border-border overflow-hidden" style={{ minHeight: "500px" }}>
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{ clientSecret, onComplete }}
      >
        {/* EmbeddedCheckout renders a self-sizing iframe — do not constrain with h-full */}
        <EmbeddedCheckout className="w-full" />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
