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
    <div className="w-full bg-white/5 rounded-xl border border-white/10 overflow-hidden relative" style={{ minHeight: "500px" }}>
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{ clientSecret }}
      >
        <EmbeddedCheckout className="w-full h-full" />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
