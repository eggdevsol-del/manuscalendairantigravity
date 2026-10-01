# Account and payment state audit — 1 October 2026

Branch: codex/tattoi-ivory-design-system. These changes are local; production has not been deployed in this pass.

## Confirmed issues and fixes

- Landing/login rendered the form without checking an existing authenticated session. It now waits for session verification and redirects an authenticated user to their role's home.
- Existing PWA push endpoints were not rebound automatically when the account changed. The shared workspace component now rebinds existing subscriptions. Custom push payloads carry a server-assigned recipient, and the service worker checks the active account before displaying or opening them.
- Logout invalidated auth before clearing saved bearer tokens. It now clears both token stores and cancels in-flight auth reads first, then refreshes auth and clears notification ownership.
- Finish on an unpaid sitting only requested money. The artist can now complete the sitting and request its persisted remaining balance in one transaction, including default aftercare and the existing idempotent procedure-log service. Existing pending requests are reused. A concurrent payment that reduces the balance to zero produces no new request.
- Mutation refresh paths varied between screens. A central React Query mutation-success listener invalidates workspace views. A protected, account-scoped revision query detects changes to appointments, session plans, payment requests, conversations and the payment ledger from another device.
- A dashboard balance presentation used truthiness for amounts, losing meaningful zeros. It now uses the existing sittingFinancials helper shared by other sitting presentations.

## Practical boundaries

The database is authoritative; React Query holds cached views, not an independent financial ledger. Local successful mutations invalidate views immediately. Remote booking/payment changes are checked every three seconds while foregrounded, plus on focus/reconnection. Network delay and webhook settlement still apply. This is polling, not instantaneous server event delivery.

The remote revision covers booking/payment/conversation records. It is not a full-platform real-time event bus: supplies, campaigns, portfolios and all other remote edits are not included in its snapshot. Local mutations still invalidate their cached views.

Notification ownership applies within a browser/PWA origin. Separately installed artist/client apps or different origins can legitimately remain subscribed to different accounts. OneSignal notifications use its own identity mechanism; the recipient guard here applies to Tattoi's custom web-push delivery. No live iPhone notification or real-money payment was performed during validation.

No migration is needed. No charges or outgoing test notifications were made.

## Regression coverage

Tests cover started/future/other-artist sitting access, canonical balance requests, pending-request reuse, concurrent payment settlement, account-bound push suppression, cache invalidation and logout credential ordering. Existing offer/payment lifecycle tests were also run. Production frontend build and TypeScript checks pass. Existing build chunk-size and dialog-description warnings remain.
