# Client corrections — 3.2.1

- Restores the original portrait discovery feed, artist focus and discovery/home controls. Retains Tattoi branding and safe-area bottom spacing.
- Workspace header and project selector use `projectName`; session selector uses sitting numbers/dates. Existing names are respected. The previously unused LLM naming function now runs when proposals are created; the result is persisted in the proposal message and copied to each fulfilled appointment. Older plan-backed appointments recover missing names using conversation messages no later than the plan's creation date. Unlinked imported sessions still need an artist-provided name; no historical relationships are invented.
- Deposit prompts share one server presentation rule across Bookings, workspace and thread checkout. It checks linked paid appointments, accepted matching plans, shared payment IDs and identical schedules. Distinct tattoos/dates remain separate. Pending stored PaymentIntents are checked against Stripe with a bounded 15-second cache; successful, processing or unverified intents show confirmation rather than a new payment action.
- Identical proposal retries are serialized under a conversation row lock and reuse the existing pending/accepted proposal. Checkout also rejects duplicate/settled proposals server-side.

These changes do not refund or delete records, change fees, or claim that a paid but unfulfilled plan has been reconciled. Live account-specific duplicate records were not inspected. Existing cases requiring fulfillment/reconciliation remain visible through payment confirmation and the operational tools.

Validation: TypeScript, production frontend/PWA and server builds; unit/regression suite; mocked browser checks at 440, 820 and 1180 pixels for original discovery rendering, project/session labels, paid-card suppression and overflow. LLM/provider tests use mocks; no real charge was submitted.
