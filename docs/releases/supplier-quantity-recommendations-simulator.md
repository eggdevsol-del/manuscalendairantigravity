# Supplier purchasing and import testing

## Changes
- Product sheets expose a quantity selector before adding to cart. Existing cart controls remain; quantities are bounded by available stock.
- Today and Supplies share backend reorder recommendations. At least two paid purchase dates from a supplier are required. The median interval between up to seven recent purchase dates determines the suggested reorder date; the latest paid basket supplies the proposed quantities. Current catalogue prices and stock are checked when reviewing the order. Nothing is purchased automatically.
- Supplier home and settings offer a clearly labelled Shopify sign-in simulation when enabled. Dummy credentials are discarded locally. Only the storefront URL reaches the authenticated import endpoint, which queues the existing public catalogue scraper. Imported products require review. This does not authenticate with Shopify.

## Test activation
Local development enables the simulation automatically. For a deployed test environment set `ENABLE_SHOPIFY_IMPORT_SIMULATOR=true` and restart the server. This change does not enable that flag on Railway or deploy the app. The existing outbox worker must be running for queued imports to complete.

## Manual checks
1. Artist: open a supplier product, select multiple units, add to cart, change quantity again and review checkout.
2. Artist with at least two paid purchases from a supplier: inspect the recommendation and its interval, then review the proposed basket. A single purchase intentionally does not invent a cadence.
3. Supplier: select Shopify sign-in (test), enter dummy values, continue, enter a public storefront URL and import. Review the resulting products after the worker completes. Do not enter real Shopify credentials.

## Validation
- 87 unit test files, 369 tests passed.
- TypeScript, frontend production build, server bundle and overlay architecture checks passed.
- Production-preview browser checks passed at 320px and 390px for quantities and simulation. Today/supplies checks also passed at 820px.
- Basket reload, current-price revalidation, stock removal and empty checkout passed.
- Browser import tests use isolated fixtures; backend tests verify authorization, test-mode gating, strict URL-only input and duplicate queue prevention. A real external storefront import was not performed.
