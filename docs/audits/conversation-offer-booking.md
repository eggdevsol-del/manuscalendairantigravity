# Conversation offers and booking

Implemented on codex/tattoi-ivory-design-system.

## Flow

1. Client requests a booking with an issued offer. This is interest, not payment or booking confirmation.
2. The offer appears above the conversation. When it scrolls beyond the header, a compact strip preserves its name, value, status and expiry. Only the most recent active request is pinned; other offer cards remain in history.
3. The artist can book directly from the offer or conversation tools. The client is preselected; date finding uses the issued offer's months/date restrictions. Manual dates are validated too.
4. Artist review shows original estimate, discount/credit, revised sitting prices and deposit. The server applies the same existing offer quote/reservation machinery atomically before publishing the proposal. The client sees the offer already selected at checkout and the existing platform fee review.
5. Paid/confirmed bookings remove the pin. Declining cancels an unpaid associated proposal, restores its reservation safely and records the outcome. Payment already processing cannot be cancelled through this action. Expired offers lose their pin and booking controls but remain visible in history.

No schema migration or production data edits are required. Existing payment settlement rules remain: expiry is validated when a new provider checkout starts; this change does not introduce a new timed Stripe-intent cancellation worker. The strip expiry does not assert that a previously started provider payment was cancelled.

## Checks

Regression tests cover access control, proposal offer attachment and revised metadata, deposit confirmation versus consultation, decline cancellation/processing refusal, historical terminal states, only-one-pin selection, eligible-month date finding and Brisbane/UTC month boundaries. Existing financial/offer lifecycle checks, TypeScript and the frontend production build also pass. No live charges, test SMS or push notifications were sent.

The exact commit snapshot passed TypeScript and the production frontend build. Its full suite has 518 passing tests and one pre-existing failure in `server/_core/publicOrigin.test.ts` (host-only cookie domain expectations); the starting commit reproduces that failure. The separate pending local cookie changes are not part of this offer-flow commit. The complete working directory passed 524 tests.
