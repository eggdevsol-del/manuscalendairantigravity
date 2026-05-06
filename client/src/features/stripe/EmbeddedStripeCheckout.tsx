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
        options={{ 
          clientSecret,
          appearance: {
            theme: 'night',
            variables: {
              colorPrimary: '#f59e0b', // Tattoi Amber 500
              colorBackground: '#020617', // Slate 950
              colorText: '#f1f5f9', // Slate 100
              colorDanger: '#ef4444', // Red 500
              fontFamily: 'Outfit, system-ui, sans-serif',
              spacingUnit: '4px',
              borderRadius: '12px',
              colorTextSecondary: '#94a3b8', // Slate 400
              colorTextPlaceholder: '#475569', // Slate 600
              colorIconTab: '#94a3b8',
              colorLogo: 'dark'
            },
            rules: {
              '.Input': {
                backgroundColor: '#0f172a', // Slate 900
                border: '1px solid #1e293b', // Slate 800
                boxShadow: 'none',
              },
              '.Input:hover': {
                border: '1px solid #334155', // Slate 700
              },
              '.Input:focus': {
                border: '1px solid #f59e0b', // Amber 500
                boxShadow: '0 0 0 1px #f59e0b',
              },
              '.Tab': {
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
              },
              '.Tab:hover': {
                backgroundColor: '#1e293b',
              },
              '.Tab--selected': {
                backgroundColor: '#0f172a',
                border: '1px solid #f59e0b',
              },
              '.Block': {
                backgroundColor: '#020617',
                borderColor: '#1e293b'
              }
            }
          }
        }}
      >
        <EmbeddedCheckout className="w-full h-full" />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
