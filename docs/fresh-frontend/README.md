# Tattoi fresh frontend — 3.0.0

Branch: `codex/tattoi-fresh-frontend`. This branch contains a new presentation layer in `client/src/app-v3`, built around the approved paper, ink and gold concepts. It retains the existing database, authenticated domain services and custom Stripe Elements checkout. It is not a new backend or a native SwiftUI rewrite.

## Implemented experience

- Artist: Today, Inbox, Calendar and Clients; Business in the tablet rail and profile menu. Booking proposals, session workspaces, notes, forms, files, rescheduling and payment reviews remain connected to the domain APIs.
- Client: artist profile → booking request → optional password creation. Bookings are the primary destination. Public booking, studio, payment, shop and event links work without navigating discovery.
- Supplier: dashboard, products and variants, orders and fulfilment, business settings, Stripe setup and Shopify catalogue connection.
- Specialist pages: working hours and breaks, services, travel, CSV import, consent templates, consultation requests, artist profile and portfolio, booking links, supplies, purchases, waitlist, bank payouts, refund history, Free/Pro/Studio plans, studio invitations and shared calendar.
- Identity: login, role-specific signup, recovery, magic link, profile completion and account deletion. Deletion checks outstanding artist/studio subscriptions against Stripe before removing access.
- Guides: contextual, non-modal walkthroughs for 18 artist, 6 supplier and 3 client workflows. Closing a guide does not mark it viewed. Guides explain actions; they do not perform them for the user.
- Operations: payment reconciliation, failed notification retries, error reports, not-found and recovery screens.

## Design contract

`client/src/app-v3/design/system.css` is the token source. `Screen`, `Panel`, `Action`, `Row` and the shared portal-based `SheetShell` own the page and overlay layouts. Phone screens use one column; larger screens retain lists and context beside details. Safe areas are applied once, including payment sheets and guidance. Route changes mount one destination, and reduced-motion preferences are respected. Pinch zoom is enabled.

The shared `DotsCheckout` remains the custom payment UI for deposits, balances, payment requests, subscriptions, stores, supplies and events. Payment return URLs and client callbacks do not establish that a payment succeeded; the page waits for server confirmation.

## Correctness changes

- Public and consultation queries return only the necessary participant fields; lead access is artist-scoped. Public studio links use published artist slugs.
- Schedule suggestions subtract breaks and skip non-bookable days while preserving unknown existing schedule fields.
- Supplier checkout validates stock, product/variant ownership, currency and delivery eligibility on the server.
- Payment request retries reuse an open checkout; event registration resumes its current checkout or expires it before switching events.
- Refund review uses the original Stripe charge and refuses ambiguous historical allocations. Webhooks alone update the ledger. Cumulative refunds and confirmed application-fee reversals are idempotent, including fee notifications that arrive later.
- Event admission links are returned only after recorded payment. Public virtual event listings do not expose admission URLs.
- Signature strokes survive device resizing; medical answers and photo consent are explicit. Signing a form does not implicitly replace the account's saved signature.
- Authentication refresh runs once per signed-in user per app load, rather than on every hook mount. Delayed token responses cannot overwrite a changed or logged-out session.
- Production HTML excludes the development inspection runtime (approximately 348 kB removed). Build version comes from `package.json`.

## Test scope and verification

The automated suite includes ownership/privacy, booking availability, payment state, custom checkout contracts, inventory, imports, refunds, fee reversals, account billing and form signing. Browser fixtures block external requests and cover realistic read/write responses, error retention, single route mounts, safe-area geometry and overflow. They are not live payment or delivery tests.

Run:

```sh
pnpm check
pnpm test
pnpm build
AUDIT_URL=http://127.0.0.1:5176 node scripts/ui-audit/fresh-interactions.mjs
pnpm ios:sync
pnpm ios:build
```

The browser script requires Playwright/Chromium; `PLAYWRIGHT_PATH` and `AUDIT_BROWSER` can point to installed copies. Serve the production build with Vite preview on port 5176 before running it. It saves screenshots and `results.json` to `AUDIT_OUTPUT` (defaults to a temporary folder).

In the authorized Railway test environment, run `pnpm deploy:check`, `pnpm deploy:test-flows` and `pnpm deploy:test-all-roles`. The latter two require Stripe test mode and roll back their database fixtures. Verify a real Stripe test-mode payment and webhook confirmation separately.

## Boundaries for testing

- Instagram import still copies media to the existing R2 setup. This release does not claim API-free native Instagram streaming or automatic access to expired Instagram media URLs.
- Saved notification templates are reusable wording, not a new campaign scheduler. Legacy automatic/quiet-hours settings without a delivery consumer are not presented as working controls.
- Studio supports the existing membership, billing and shared-calendar contracts. Chair rental, commission payroll and a new compliance vault are not invented features in this branch.
- Xcode simulator compilation is separate from physical iPhone/iPad validation, signing, TestFlight and App Store submission.
- Do not infer successful deployment, payment delivery or physical-device testing from a successful local build. Record actual release evidence below.

## Release evidence

Local checks and deployment evidence are updated as each gate completes. The previous deployed release was 2.15.0 (`a7a422e`); the new release must be verified by `/api/version` and Railway's active deployment commit before testing in the installed PWA.

### Local verification — 10 September 2026

- TypeScript: passed.
- Automated suite: 166 tests passed in 42 files.
- Production build: client, service worker, bundled server and migration assets passed. A large main JavaScript chunk warning remains; the build succeeds.
- Production browser fixtures: 56 checks passed at 440×956, 820×1180 and 1180×820, with injected top/bottom safe areas. Loaded-page screenshots were inspected. These are browser dimensions, not a claim of physical-device testing.
- Xcode 26.6: unsigned iOS simulator build passed. No device provisioning or App Store submission was performed.
- Railway baseline database checks passed on the previous release; its configuration check reported missing `RESEND_API_KEY` and `EMAIL_FROM`. New-deployment verification is recorded separately.

See `browser-results.json` for the fixture results. The screenshots in `screenshots/` contain synthetic data only.
