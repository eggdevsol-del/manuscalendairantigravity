# Fresh frontend implementation

Branch: `codex/tattoi-fresh-frontend`. Base: 2.15.0.

The approved scope is a fresh presentation layer based on the two concept images, using existing authenticated domain services where correct. This is not a backend rewrite. The branch must not be described as complete while old presentation modules remain on primary or nested user paths.

## Acceptance contract

- Paper/ink/gold design defined by `client/src/app-v3/design`.
- Four artist destinations: Today, Inbox, Calendar, Clients. Business via profile and tablet sidebar.
- Booking is a workspace: Overview, Messages, Files, clear session readiness, payment details and management.
- Client entry prioritises their artist and next action, preserving request submission before password creation.
- Tablet selection keeps context beside details; mobile uses one clear full-width flow.
- Every mutation retains pending/error/success behaviour. No decorative buttons, fabricated customer data or invented payment status.
- Headers and overlays handle safe areas once. No duplicated mobile and desktop component mounts.
- Existing checkout, compliance and access contracts must be verified before replacing their presentation.

## Route inventory and migration status

The current app exposes public identity/intake/payment pages, three authenticated role shells, and local-state subpages. Migration is incomplete until every item below has a verified new presentation and relevant interaction coverage.

| Area | Routes / nested flows | Status |
|---|---|---|
| Artist day | /dashboard, setup checklist, attention tasks, arrival | New page implemented; setup/task interactions need broader coverage |
| Inbox | /conversations, /chat/:id, leads, proposals, attachments, booking wizard | New list/thread implemented; legacy proposal editor and attachments need final parity audit |
| Calendar | /calendar, phone day, tablet week, inspector, create/reschedule/cancel | New day/week/inspector implemented; proposal and reschedule fixtures pass |
| Clients | /clients, add, detail, history, forms, notes | New master/detail and notes implemented; fixture interactions pass |
| Booking | /projects/:id, overview/messages/files, forms, deposit, balance | New workspace and checkout review implemented; custom Stripe form retained; signing and webhook tests remain |
| Client home | /bookings, upcoming/past, pending plans, waitlist | New page implemented; deposit review fixture passes |
| Business | /business, /money, /supplies, /supply-orders, /payout-history | New hub and Money implemented; supplies and payout history remain |
| Profile | /artist-profile, gallery, services, storefront, events, link sharing | Pending |
| Schedule | /work-hours, availability, breaks, design days, travel | New hours/services implemented; services fixture passes; breaks/travel remain |
| Settings | profile, business, services, travel, import, forms, consultation, studio, notification, Instagram, guides, account deletion | New root/account/business/notifications implemented; specialist editors remain |
| Billing | /bank-payouts, /subscriptions, custom checkout | Pending |
| Studio | /studio, roster, invitations, shared schedule, compliance | Pending |
| Supplier | /dashboard, /merchant/products, /merchant/orders, /settings | New dashboard/orders/products/business/payments implemented; Shopify specialist remains |
| Client account | /profile, /settings, /purchases, /discover | Pending |
| Public | /book/:slug, /start/:slug, /studio/:slug, /shop/:slug, /events/:slug, /:slug | Pending |
| Public payments | /deposit/:token, /balance/:id, /pay/:token | Pending |
| Identity | login, signup, magic link, password setup/recovery, complete profile | Pending |
| Operations | /admin/operations, /admin/errors, not found, error recovery | Pending |

## Release rule

Keep the currently deployed 2.15.0 unchanged while this branch is being built. Test fixture screenshots prove layout only. Report real deployment/device/payment checks separately.

## Verified development checkpoint — 10 September 2026

- TypeScript passes; production client and service-worker build passes.
- 130 tests pass across 35 test files.
- Nine isolated browser interaction checks pass: proposal review/send, client notes, reschedule, single message composer/send, business settings, services, supplier product creation, notification template creation and client deposit review.
- The interaction checks inject safe-area values and check headers/overflow. They use synthetic responses and do not prove live payments, delivery or physical-device behaviour.
- Production build still reports existing analytics placeholders, missing noise asset and large-bundle warnings. These remain release work.
- Design tokens now have one source in app-v3/design/system.css; legacy semantic names alias these tokens.
- Security fixes cover notification-template ownership, client profile credential/signature disclosure and artist-scoped client records.

## Findings requiring completion

- Existing notificationMode and quiet-hours preferences have no discovered delivery consumer. The new template page accurately describes templates as saved wording, not scheduled sends. A complete automation workflow still needs implementation and delivery tests.
- New booking composer needs multi-session service defaults and availability suggestions before parity can be claimed.
- Public booking/password creation, specialist settings, studio, profile/storefront, supplies/purchases, identity and operations remain release blockers.
- New checkout preserves DotsCheckout (custom Stripe Elements), verifies server confirmation and refreshes dependent reads at 0/600/1500 ms. Live test-mode payment verification is still outstanding.
