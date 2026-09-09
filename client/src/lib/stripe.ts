import {loadStripe} from '@stripe/stripe-js';
const publishableKey=import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
// Missing deployment configuration must not create a rejected global SDK promise.
export const stripePromise=publishableKey?loadStripe(publishableKey):null;
