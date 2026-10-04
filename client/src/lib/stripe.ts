import { loadStripe } from "@stripe/stripe-js/pure";
const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
let promise: ReturnType<typeof loadStripe> | null = null;
/** Initialise only when a real checkout renders, never while importing practice screens. */
export function getStripePromise() {
  if (!publishableKey) return null;
  return (promise ??= loadStripe(publishableKey));
}
