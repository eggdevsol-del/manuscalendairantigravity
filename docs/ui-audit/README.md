# UI consistency and safe-area audit — 2.13.0

Scope: navigable artist, client, supplier/merchant, studio, public booking and payment UI, including nested settings and overlays. The booking review and dashboard provide the shared visual vocabulary. See [the generated inventory](INVENTORY.md) for the App import closure; source coverage is not a claim that every possible account/data state was exercised interactively.

## Verified findings and changes

| Finding | Correction |
|---|---|
| Body padding did not protect fixed full-screen sheets; the checkout header could reach the status bar. | Full-screen roots own top/side insets, nested headers consume them once, and body padding is removed. Public document layouts have their own bounded scrolling viewport. |
| Several legacy management pages, including bank payouts, had bespoke headings, spacing and controls. | Shared PageHeader, wrapping business names, readable labels, semantic colors, consistent control/card rounding and bounded tablet content widths. |
| Subscriptions used a full-screen container, unlike the original deposit bottom sheet; the new checkout added an extra outer card. | Subscriptions now use the same SheetShell as deposits and balance payments. Removed the extra checkout card; retained the existing Payment Element layout, order total, security badge and completion behavior. |
| Supplier/payment screens duplicated dark-only palette objects. | Shared commerce tokens and theme-aware Stripe appearance use the same semantic palette as the dashboard. |
| Sheets/dialogs used fixed viewport-height limits or oversized tablet widths. | Dynamic viewport caps, safe close controls, scrollable content and centered 640px bottom sheets/dialogs. |
| Custom overlays could inherit a transformed scroll-container stacking context. | Booking edit, reference upload, supplier checkout and weekly snapshot overlays portal to the document body. |
| Popovers/dropdowns used a lower layer than dialogs. | Menu layer matches the existing select layer above sheets/dialogs. |
| Small input typography could trigger iOS focus zoom; some action labels were 8px. | Coarse-pointer form text is at least 16px, shared buttons/close targets at least 44px, former 8px labels 11px. |

## Existing implementations retained

- DotsCheckout already provided the custom deposit Payment Element, payment confirmation and security badge. Those were not missing features; the regression was the surrounding container and extra card.
- Merchant, studio, dashboard and most nested settings already use PageShell/PageHeader or shared modal/sheet primitives. They receive the shared corrections without redundant replacement.
- Client discovery and public artist profiles already provide top safe-area handling in their dedicated CSS. Added landscape side protection; their distinct image/feed layouts remain intentional.
- Authentication pages already use a safe-area-aware AuthLayout. Calendar content inherits its page shell. Splash has no interactive header. The install prompt and FAB menu already use bounded/portalled overlay behavior.
- Select menus already used the elevated select layer; the lower dropdown/popover layers were the inconsistent parts.

## Verification

The committed scripts inventory imported UI and exercise nine real shared layouts (page, document, full-screen, half-sheet, bottom sheet, side sheet, dialog, chat action sheet and chat full-screen sheet), in both themes at six viewport/inset configurations. They test header bounds, horizontal overflow, final-action scroll reachability and uncaught browser errors. Insets in this matrix are explicit geometry test inputs, not a claim to emulate Safari perfectly.

Native WKWebView inspection used actual iPhone 17 Pro Max and iPad Pro 13-inch (M5) simulator runtimes, with the same shared components served from the local development fixture. Both full-screen headers and deposit-style sheet headers clear the status bar/Dynamic Island, including with the keyboard visible. Screenshots are in [evidence](evidence). These are simulator checks, not physical-device acceptance tests.

The fixture is a development-only HTML entry; it is not imported by the production application or included in the production Vite output. Its API responses are synthetic. The native test app was an isolated copied simulator bundle; the repository's release configuration continues to point to https://www.tattoi.app.

Run `node scripts/ui-audit/inventory.mjs` to regenerate the source inventory. Run `node scripts/ui-audit/check-viewports.mjs` with Vite on port 5174 (or set AUDIT_URL), Playwright installed (or PLAYWRIGHT_PATH set), and optionally AUDIT_BROWSER pointing to Chromium. AUDIT_OUTPUT controls the evidence directory.

All 108 viewport/theme/layout cases passed after the corrections.

The source inventory covers 228 imported JSX modules and 95 page/layout/overlay records. TypeScript, all 103 automated tests, production web/server builds and the Xcode simulator build passed.

Payment submission and every external-provider/account/data state are outside this UI verification. No new financial charge is necessary for this audit.

## Deployed checkout inspection

The in-app Pro checkout renders the A$99 monthly total, card fields, subscription terms and app-owned header in the deposit-style SheetShell. No payment was submitted. Removed an unsupported `defaultCollapsed` option from the tabs layout after Stripe logged a warning. The initial inspection reported that Apple Pay was unavailable because the test domain had not been registered. This was subsequently resolved as recorded below.

## Sandbox payment-domain verification — 2026-09-10

Registered `www.tattoi.app` on the platform Stripe sandbox account after confirming it was absent. The API returned `enabled: true`, `livemode: false`, and `active` status for Apple Pay, Google Pay and Link. The existing hosted Stripe checkout registrations were retained. No live-mode configuration or payment was changed.

Reopened the app-owned Pro checkout: payment fields and the monthly subscription action rendered; the fresh browser log contained no Stripe warnings. This verifies domain configuration and checkout rendering, not an Apple Pay authorization on a physical device. An eligible device/wallet is still required to exercise the wallet button and authorization flow.

Stripe reference: [Register domains for payment methods](https://docs.stripe.com/payments/payment-methods/pmd-registration).
