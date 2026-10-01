# Promotional sitting reschedule approval

Branch: codex/tattoi-ivory-design-system.

Outside an issued offer's sitting dates, an artist can either explicitly retain the confirmed promotion or preview revised terms and request client approval. The existing appointment stays confirmed while the proposed slot has a temporary hold (shared 24-hour maximum, capped at the new sitting start). The card offers client agreement/decline and artist withdrawal. Expired holds stop blocking slots without requiring a scheduler.

The server derives the removed discount from the original per-item allocation. Other sittings retain their discount; paid voucher credit is never revoked. Paid/credited amounts remain applied. Acceptance updates the same appointment, plan item/date, project total and offer allocation transactionally. Confirmation is idempotent. Changed dates/payments, disabled work hours, overlap, or outstanding payment requests prevent acceptance. An active provider checkout for another proposal prevents a hold being created. Availability searches, appointment writers, plan checkout and fulfillment respect active holds.

Message sends and their durable push jobs share a transaction. Text, individual photos and reference/placement groups notify the other participant, for both artist and client. The receiver must have a valid push subscription and device permission; provider delivery has not been live-tested.

## Release order

Apply versioned migration `drizzle/0031_reschedule_approval.sql` through the existing migration runner **before deploying this code**. The canonical overlap checks depend on the new table. Do not deploy the code alone. No migration has been applied and no production deployment has been performed in this task.

## Validation

Full working-directory suite: 554 tests passed. Latest targeted approval, notification, financial, card and fulfillment checks: 32 passed. TypeScript and production frontend build checked. No outgoing messages, real payments or production booking changes were made. Existing unrelated local changes were preserved.
