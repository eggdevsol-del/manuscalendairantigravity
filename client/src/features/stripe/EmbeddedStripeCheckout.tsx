import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

// Make sure to call `loadStripe` outside of a component’s render to avoid
// recreating the `Stripe` object on every render.
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

function CustomCheckoutForm({ onComplete }: { onComplete?: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href, // This handles the redirect flow if authentication is needed
      }
    });

    if (error) {
      toast.error(error.message || "Payment failed");
      setIsProcessing(false);
    } else {
      onComplete?.();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full">
      <PaymentElement />
      <button
        disabled={!stripe || isProcessing}
        type="submit"
        className="w-full h-14 rounded-xl font-bold text-base shadow-[0_8px_30px_rgb(224,159,62,0.3)] bg-[#E09F3E] hover:bg-[#E09F3E]/90 text-white flex items-center justify-center transition-all active:scale-[0.98] mt-4"
      >
        {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : "Pay Deposit"}
      </button>
    </form>
  );
}

interface EmbeddedStripeCheckoutProps {
  clientSecret: string;
  onComplete?: () => void;
}

export function EmbeddedStripeCheckout({ clientSecret, onComplete }: EmbeddedStripeCheckoutProps) {
  if (!clientSecret) return null;

  return (
    <div className="w-full p-6 bg-[#0b1120] rounded-[2rem] border border-white/10 shadow-2xl relative">
      <Elements
        stripe={stripePromise}
        options={{ 
          clientSecret,
          appearance: {
            theme: 'night',
            variables: {
              colorPrimary: '#E09F3E',
              colorBackground: '#0b1120',
              colorText: '#ffffff',
              colorDanger: '#ef4444',
              fontFamily: 'Outfit, system-ui, sans-serif',
              spacingUnit: '4px',
              borderRadius: '12px',
              colorTextSecondary: '#94a3b8',
              colorTextPlaceholder: '#475569',
            },
            rules: {
              '.Input': {
                backgroundColor: '#020617', // Even darker for the input fields
                border: '1px solid #1e293b',
                boxShadow: 'none',
              },
              '.Input:hover': {
                border: '1px solid #334155',
              },
              '.Input:focus': {
                border: '1px solid #E09F3E',
                boxShadow: '0 0 0 1px #E09F3E',
              },
              '.Tab': {
                backgroundColor: '#020617',
                border: '1px solid #1e293b',
              },
              '.Tab:hover': {
                backgroundColor: '#1e293b',
              },
              '.Tab--selected': {
                backgroundColor: '#020617',
                border: '1px solid #E09F3E',
              },
            }
          }
        }}
      >
        <CustomCheckoutForm onComplete={onComplete} />
      </Elements>
    </div>
  );
}
