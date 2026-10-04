import { usePractice } from "@/features/practice/PracticeContext";
import { getStripePromise } from "@/lib/stripe";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";

interface EmbeddedStripeCheckoutProps {
  clientSecret: string;
  onComplete?: () => void;
}

export function EmbeddedStripeCheckout({
  clientSecret,
  onComplete,
}: EmbeddedStripeCheckoutProps) {
  const practice = usePractice();
  if (practice)
    return (
      <button type="button" onClick={async () => { await practice.simulate("Complete practice payment"); onComplete?.(); }}>
        Simulate successful payment
      </button>
    );
  if (!clientSecret) return null;
  const stripePromise = getStripePromise();
  if (!stripePromise)
    return (
      <p role="alert">
        Card payments are temporarily unavailable. Please try again later.
      </p>
    );

  return (
    <div
      className="w-full rounded-[12px] border border-border overflow-hidden"
      style={{ minHeight: "500px" }}
    >
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
