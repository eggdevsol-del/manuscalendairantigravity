# Shopfront, payments and controls — implementation verification

16 September 2026. Changes based on `b3762663f0402558b94fa1e7557a475725b20587`, branch `codex/tattoi-ivory-design-system`.

The app now has a dedicated shopfront experience at `/shop/:slug`, correct shop navigation, product detail sheets, stock-aware variants, full-width product filters, search and cart controls. Its Ivory headers, sheet and segmented-control dimensions use the shared components.

## Implemented fixes

| Finding | Result |
|---|---|
| Shopfront opened an artist profile | Map Shopfront links now open `/shop/:slug`; the public artist page also links to the shop. |
| Shop needed its own UI | Dedicated product grid, All products / In stock tabs, product detail sheet, option selection, price and cart. |
| Legacy proposal Decline was inactive | New client-authorized transaction records the decline and cancels unpaid pending dates. Already-paid/progressed sessions and unrelated users are rejected. |
| Legacy Edit Booking was inactive | Loads the associated session and opens the shared editor. Contact, service/cost and reschedule controls are functional. Missing session data produces a clear error. |
| Duplicate/custom editor overlay | Parent proposal closes before the editor opens. Shared SheetShell supplies one Close button and the shared Tabs component. |
| Booking-page service visibility was ignored | Public endpoint supplies visible service names/descriptions; intake allows choosing a service and includes it in the submitted request. Hidden services are excluded. |
| Waitlist “Review” silently accepted | Label now explicitly says “Accept offer & review deposit.” The acceptance behavior is unchanged; this action does not charge a payment. |
| Arrival Later did not remind | A real ten-minute in-app snooze returns the prompt; timer cleanup and appointment matching prevent cross-appointment dismissal. This is an in-app timer, not a background push notification. |
| Check for updates actually reset/reloaded | Renamed “Reload latest version” to describe the actual action. |
| Book Consult overpromised a reservation | Renamed “Request consultation” on the profile; feed profile-navigation CTA says “View artist.” |
| Supply order copy promised missing tools | Now says “Review orders and payment status.” |
| Contact visibility scope unclear | Public-profile editor explicitly states these contact settings apply to signed-in clients. Public contact data remains private. |
| Near Me ignored coordinates equal to zero | Uses null checks rather than truthiness. |
| “Artists near Brisbane” counted all locations | Copy now says “artists on the map.” |
| Cart could exceed the server's 100-item quantity limit | Add/increase controls now respect both stock and the per-item limit. Persisted carts are scoped to their seller. |

## Additional payment defects corrected

1. **Legacy deposit/balance checkout displayed a zero payment amount.** It now uses the server-returned fee calculation, displays the platform fee and total, and sends the actual total to the payment component.
2. **Legacy checkout announced success before verified settlement.** It now says payment was submitted, refreshes booking data and opens the payments workspace. It does not claim the sessions are confirmed immediately.
3. **Price editing left the old balance payable.** Individual edits now update expected/remaining cents while preserving paid amounts. The batch path validates all affected active sessions before changing them, performs the change in one transaction, and rejects reductions below money already received.
4. **Direct storefront PaymentIntent helper omitted the seller fee from the Connect split.** The helper now routes platform plus seller fees consistently. This helper is currently unused by active routes; the live storefront route uses Checkout Sessions.
5. **Rapid repeated submission could reach the PaymentIntent confirmation handler twice.** Both checkout variants now have a synchronous submission guard; cart checkout preparation is guarded too.
6. **Final storefront quote needed explicit server-derived disclosure.** Checkout receives authoritative item, shipping, platform-fee and currency fields. The server rejects inconsistent totals before creating the Stripe Session.

The configured platform fee remains **3.4%, minimum 500 currency cents per transaction**. It has not been changed. The shared fee engine also retains the configured 2% seller fee on the free tier, and 0% on Pro/Studio. The seller fee is deducted from their proceeds; it is not added again to the buyer's total. Store checkout tests verify products plus delivery plus one platform-fee line and the Connect destination/application-fee split, consistent with [Stripe's destination-charge contract](https://docs.stripe.com/connect/destination-charges).

Example asserted in tests: 20,000 cents of products + 1,000 cents shipping + 714 cents platform fee = **21,714 cents charged**. Free-tier seller fee is 420 cents; the application fee is 1,134 cents; the destination amount is 20,580 cents before any separate processing-cost treatment.

## Verification

- **259 tests passed in 63 test files**, including new fee, payment submission, decline authorization and price-edit tests.
- **TypeScript check passed.** Client/PWA build, server bundle and migration-file packaging completed. `git diff --check` passed.
- **135 isolated browser scenarios**, **1357 rendered control instances**, no captured scenario/JavaScript errors.
- **104 input-state checks passed**, covering checkboxes, switches, selectors and disclosures. Inputs hidden behind modal overlays are intentionally excluded from interaction until their modal closes.
- **89 tab selections passed.**
- **6 focused browser flows passed**: shop/cart/fees, proposal decline, booking editor and batch-price controls, service request payload, arrival snooze, and legacy deposit fee disclosure.
- Scanned 455 client modules, 219 import-reachable modules and 630 reachable control candidates. Candidates include primitives and router Switch components, so this is not a unique-button count.
- All eight Slider usages found in source are in inactive legacy promotion files or ComponentShowcase. **No sliders are rendered by the current routed application.** They were identified rather than falsely counted as live interaction passes.

The catalog is exhaustive for controls extracted from those scenarios and for the scanned source candidates. Rendering a control is not an individual end-to-end pass. It would be inaccurate to claim every conditional state and every external operation is certified by these fixture checks.

## Payment environment blocker

This workspace's `.env` does not configure `STRIPE_SECRET_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` or `DATABASE_URL`. No secret values were copied into artifacts. Consequently, **no real Stripe test charge, webhook settlement, Connect payout or production persistence was verified here**. Existing webhook/inventory tests and the added contract tests use isolated data. Deployed environments may have their own configuration; this audit does not establish their state.

Before a live-payment sign-off, run an authorized Stripe test-mode checkout against a configured database, verify webhook arrival, order/booking settlement, exactly one ledger entry and the destination/application-fee amounts. Physical iPhone Apple Pay, 3DS redirects, background behavior and real notification/integration delivery also remain device/service-backed acceptance checks. There were no real charges or external messages during this pass.

## Files and previews

- [PublicCommerce.tsx](</Users/pip/Documents/GitHub/DOTS CODEX TEST/client/src/app-v3/pages/PublicCommerce.tsx>) — dedicated storefront and product UI.
- [StorefrontCheckoutFAB.tsx](</Users/pip/Documents/GitHub/DOTS CODEX TEST/client/src/features/storefront/StorefrontCheckoutFAB.tsx>) — cart, fulfillment choice and confirmed fee breakdown.
- [EditBookingModal.tsx](</Users/pip/Documents/GitHub/DOTS CODEX TEST/client/src/components/modals/EditBookingModal.tsx>) — shared booking editor.
- [paymentState.ts](</Users/pip/Documents/GitHub/DOTS CODEX TEST/server/domain/paymentState.ts>) — consistent price edits and payable balance.
- [Shopfront screenshot](./screens/shopfront.png), [product detail](./screens/product-details.png), [cart with platform fee](./screens/cart-platform-fee.png), [booking editor](./screens/edit-booking.png).
- [Rendered control catalog](./controls.csv), [input checks](./input-checks.csv), [browser evidence](./browser-inventory.json), [focused evidence](./targeted-results.json), [source inventory](./source-inventory.json).
- Reproducible scripts are in `scripts/ui-audit/control-verification.mjs`, `control-inventory.mjs` and `control-source-inventory.cjs`. Browser scripts require the local preview at port 5196 and use intercepted fixtures, not live services.
