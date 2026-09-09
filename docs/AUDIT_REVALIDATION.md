# Audit revalidation — 9 September 2026

Baseline: aca9ee8df96102f5b05fa2f0bdfa520576a50919. This document records the pre-change assessment; implementation progress is tracked separately.

## Corrections and features already implemented

- Artist setup checklist already exists in SetupChecklistWidget and is mounted by Dashboard. The original recommendation to add it was redundant. Improve its language, validity checks and preview link instead.
- Checkout already itemises deposit, platform fee and total, and displays a cancellation label. Improve consistency, remaining-balance visibility and server confirmation rather than claim itemisation is absent.
- SessionPlanCard already summarises project sessions in chat; Upcoming/Past bookings already exist. Extend the existing views rather than introduce a competing booking model.
- Shared SheetShell/ModalShell already provide accessible primitives. The defect is in custom checkout overlays bypassing these, not absence of shared primitives.
- Stripe signature verification, some duplicate guards and some transactional operations already exist. The confirmed defect is incomplete coverage and non-atomic session-plan fulfilment, not total absence of idempotency.
- Message reads/sends already check participation; some appointment/plan endpoints also do. The authorisation findings apply to the named exceptions, not every endpoint.
- Required-form generation already exists and is called on some booking paths. The session-plan webhook's direct inserts omit it.
- Manual bank/cash deposit claims are already pending artist verification. The audit did not establish that these claims automatically mark funds paid.
- Direct R2 delivery and a four-video pool already exist and should be retained.
- CSV import already previews parsed rows, valid/skipped counts and service mapping in DataImportSettings. Adding a basic preview was redundant; duplicate matching remains a separate gap.
- Artist-only import permission checks exist inside import handlers despite their generic protectedProcedure declaration. Middleware labels alone are not evidence of missing authorisation.
- The 8 baseline test failures are missing providers/mocks, not proof that those 8 behaviours fail live. The 146 TypeScript diagnostics also include inactive rollback remnants.
- Studio source files and APIs remain, but not all are mounted in a usable authenticated shell. Do not describe the intended studio feature set as fully operational.

## Rechecked findings at the original baseline

1. Public password-setup endpoint still overwrites existing passwords and issues a token without proof of account ownership.
2. getDb still calls ensureTables; ensureTables drops payment_requests. The entrypoint production migration skip does not prevent this.
3. Session-plan checkout still sends plan.id as leadId; webhook still looks for a lead first.
4. Session-plan fulfilment still marks accepted before all writes and skips accepted plans on retry.
5. Named appointment/plan mutations still lack role/ownership or field-specific authorisation.
6. Plan queries still return full related user rows, including sensitive schema fields.
7. Balance-token handlers validate signature but do not bind the token to bookingId.
8. Design-brief source-message reads still lack conversation ownership checks; the summary uses the oldest 100 messages.
9. Medical UI answers are not sent with the signature; signForm does not persist them or prevent replacement.
10. Procedure-log snapshots still use dummy/fixed values and cascade relationships.
11. Supplier deletion lacks owner/admin checks; public storefront claim lacks business ownership verification.
12. Password-reset email is only logged; /forgot-password was observed returning Artist Not Found. Generic email is a placeholder. Production secret configuration was not inspected.
13. Rescheduling still bypasses overlap checks and conflates initiator with notice policy.
14. Checkout success still relies on short timed refreshes rather than terminal server state.
15. Discovery reshuffles each request and slices offsets after loading the full feed.
16. Merchant Orders/Products remain static shells; PayPal and proof-upload placeholders remain in the named paths.

These are source findings except the explicitly observed public navigation. They are not claims of successful live exploitation. Legal/compliance assertions in local skills are design intentions and require independent jurisdiction-specific review; they are not legal authority.

Further review found a test-only studio subscription bypass exposed without an environment guard. The rebuild restricts it to NODE_ENV=test. Studio creation and subscription entitlement still need a complete staging review before enabling that unfinished product surface.
