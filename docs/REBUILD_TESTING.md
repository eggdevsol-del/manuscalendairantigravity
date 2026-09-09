# Frictionless rebuild: implementation and testing

Branch: `codex/tattoi-frictionless-rebuild`. Original baseline: `aca9ee8df96102f5b05fa2f0bdfa520576a50919`.

This is a substantial test branch, not a certification that every production workflow is complete. The original audit corrections are in [AUDIT_REVALIDATION.md](AUDIT_REVALIDATION.md).

## Implemented

- Direct email/password sign-in and client/artist signup, optional Google sign-in, working password-recovery routes, real email delivery integration, and account-bound reset tokens. Supplier signup remains separate.
- Shared accessible checkout sheets, itemised fees and remaining balances, pending session plans in Bookings, server-confirmed payment states, and honest bank/cash verification states. Unsupported PayPal and simulated proof uploads were removed from these payment paths.
- Transactional session-plan fulfilment, required forms for every session, provider-ID matching, webhook receipts and replay protection. Appointment overlap checks and client/artist permissions were tightened. Paying a balance no longer completes the appointment prematurely.
- Medical answers, optional photo permission, immutable signing data, procedure-log retention independent of account deletion, and versioned aftercare templates.
- Real merchant inventory/order management, stable bounded discovery pagination, per-account conversation drafts, and an administrator Operations screen at `/admin/operations` (also linked from Settings).
- Production secret validation, narrower public user responses, conversation access checks for design briefs, admin-only supplier deletion, and disabling unverified merchant account claims.
- Database migrations removed from application startup/build. Native Capacitor identity aligned with the existing Xcode bundle, reproducible OneSignal SPM bridge, and a CI configuration template.

Inactive studio prototype screens that referenced nonexistent APIs/schema were removed; their source remains in the baseline Git commit. Existing studio membership APIs and settings remain. The test subscription bypass is restricted to the test environment. This does **not** complete studio billing or entitlement enforcement.

## Completion pass (version 2.11.0)

- Project details are reachable from chat and bookings, with session totals, required-form status, proposals and linked deposit/balance/refund history. Historical imports without ledger rows are explicitly identified as incomplete history.
- Cancellation waitlist opt-in, artist offers with a 1–72 hour response deadline, availability rechecks, and a pending proposal using the existing deposit checkout. Manual waitlist offers are included in all tiers. Accepting an offer does not move an existing appointment or hold a slot before payment; the UI states this.
- CSV column/service mapping, server preview, normalized contact matching, duplicate/overlap detection, per-row transactional imports, and selective retries retaining original CSV row numbers. Existing client profiles are preserved.
- Durable notification retries, provider failures visible in Operations, stable Resend retry identities, and queued Shopify draft handoffs from both Checkout and PaymentIntent paths. Shopify retries look up a stable order tag before creation; remote search indexing and provider/local commit boundaries still require staging fault tests.
- Cumulative refunds update the linked session balances and record incremental base/fee refunds, including later fee-only refunds. Multi-session deposit refunds allocate in session order. This does not retroactively reconstruct missing legacy ledger entries.
- Studio creation no longer grants a paid subscription; invitations check an active/trialing subscription and owner permissions. Public studio responses exclude private billing fields.
- Read-only `pnpm deploy:check` validates required configuration and compares declared columns with the actual database. `/api/health` checks critical rebuilt tables; Railway uses it before routing to the new deployment. `/api/version` reports version and Railway commit SHA.

## Verified locally

- 81 tests across 20 files pass, including token isolation, recovery replay, form persistence, session-plan rollback/retry, payment state, deposit confirmation and conversation drafts.
- Clean TypeScript check: `pnpm exec tsc --noEmit --incremental false`.
- Vite production bundle, server esbuild bundle and migration-file packaging succeed. Build performs no database migrations.
- Local browser inspection confirms the sign-in page exposes its labelled fields and links, and the recovery route shows its reset form.
- The app installs and launches successfully in the iPhone 17 Pro simulator; its native login screen was visually inspected.
- Xcode 26.6 unsigned iOS simulator build succeeds for arm64 and x86_64, including the OneSignal SPM bridge. The initial SwiftPM download stall was resolved by caching official framework archives after verifying every manifest SHA-256 checksum.

Transaction tests use controlled in-memory fixtures. They do not establish MySQL locking behaviour, Stripe delivery behaviour or successful real email delivery. Existing tests include a one-test harness smoke check.

## Test deployment

The user identified `https://www.tattoi.app` as the existing test target and confirmed Stripe test mode with no real user data. Its public version endpoint returned 2.10.0 before this completion pass. Database/service credentials were not available in the workspace. The correct Railway service is now identified and version 2.11.0 (`b9ad5dd`) deployed successfully. A targeted, explicit database reconciliation added the webhook/waitlist tables and three missing shipping columns, removed the three procedure-log cascade foreign keys, and established the migration adoption boundary at 0025. Backups of the affected existing tables and original DDL remain in `_tattoi_211_backup_*` and `_tattoi_rebuild_backup_manifest`. The health endpoint returned HTTP 200. `APP_URL` is set to the public HTTPS address. No real payments or customer messages were sent.

Use the existing hosting service's staging environment variables. Do not commit credentials. Configure `APP_URL`, `DATABASE_URL`, a strong random `JWT_SECRET`, `STRIPE_SECRET_KEY` (test mode), `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY` and a verified `EMAIL_FROM`. Configure the existing storage, Google sign-in and notification integrations separately where those paths are tested.

The branch adds migrations `0023_webhook_receipts.sql`, `0024_retain_procedure_snapshots.sql` and `0025_cancellation_waitlist.sql`. Before applying them, back up staging and compare its actual schema and migration journal. The baseline already contains schema/snapshot drift in appointments, session plans, aftercare, suppliers and other tables. The new snapshots preserve that baseline instead of silently incorporating unrun historical changes. Do not blindly generate or push the entire schema. Old balance-link tokens must be regenerated because they are now purpose-bound to the booking.

Staging acceptance must cover:

1. Client and artist signup, Google sign-in, emailed reset/magic links, logout and account switching.
2. Multi-session checkout, duplicate and out-of-order webhooks, failed fulfilment/retry, concurrent slot requests and cancellation while payment is processing.
3. Deposit/balance payment, manual claims and artist verification, partial/full refunds, rejected payment methods and abandoned/redirected checkout.
4. Form signing and required answers, procedure completion, aftercare assignment/history and rescheduling.
5. Merchant inventory, checkout, stock/fulfilment and existing Shopify synchronization.
6. Waitlist expiry, two clients competing for one time, withdrawn offers, retrying deposit checkout, CSV reimports and conflicting contacts/times.
7. Mobile/desktop layout, keyboard focus, screen reader flow, native navigation, push opt-in, permissions and reconnect behaviour.

## Native testing

Xcode is available on this Mac. Run `pnpm build`, then `CAPACITOR_SERVER_URL=https://YOUR-EXISTING-STAGING-HOST pnpm ios:sync`, and open `ios/App/App.xcodeproj` in Xcode. The URL must use HTTPS. For a bundled frontend with a remote backend, configure `VITE_API_BASE_URL` before the web build instead. Keep the existing bundle identifier `com.manus.calendair` unless intentionally migrating signing and push registrations.

`pnpm ios:build` requests an unsigned simulator build. A physical device/TestFlight build also needs the project's signing team and provisioning. A successful unsigned compile does not validate push delivery or backend flows.

## Still outstanding

- Remaining end-to-end acceptance, including email delivery, actual Stripe/Shopify provider behavior, and signed-in mobile flows. The targeted schema reconciliation is complete.
- Full studio product workflows, paid entitlement enforcement, settlement and verified merchant ownership transfer.
- Provider-wide historical duplicate/refund reconciliation, Shopify retry fault tests and real MySQL concurrency tests.
- Clinical/legal review of retention, consent wording, procedure logs and jurisdiction-specific requirements. No legal compliance certification is claimed.

These items remain explicit rather than being represented by simulated success states.

## GitHub CI credential limit

The saved GitHub credential cannot create Actions workflows (missing workflow scope). `.github/verify.example.yml` preserves the proposed checks without activating a workflow. An account with workflow permission can place it in `.github/workflows/verify.yml`. GitHub CI has not run; the checks above were executed locally.

## Deployment sequence

1. Select the correct existing Railway service for `www.tattoi.app`; confirm its database and Stripe test-mode configuration without copying secrets into Git or chat. Set `REQUIRE_STRIPE_TEST_MODE=true` for the deployment check.
2. Back up the test database and inspect the actual schema/migration journal. Run `pnpm deploy:check`; resolve baseline drift deliberately and apply the outstanding versioned migrations. Do not run schema push or initialization against the existing database.
3. Configure the service to build `codex/tattoi-frictionless-rebuild` at the latest verified GitHub commit. `railway.json` builds with `pnpm build`, starts with `pnpm start`, and checks `/api/health`.
4. Verify `/api/version` reports 2.11.1 and the deployed GitHub SHA, then run the acceptance scenarios above with test accounts. A failed health check must be investigated before accepting the rollout.
5. On iPhone, open `https://www.tattoi.app` in Safari and use Share → Add to Home Screen. An existing PWA uses the same deployed service; close/reopen and accept the app's update prompt if shown. A native device build still requires Apple signing/provisioning.

Shopify request fields follow the official [DraftOrderInput](https://shopify.dev/docs/api/admin-graphql/latest/input-objects/DraftOrderInput) and [MailingAddressInput](https://shopify.dev/docs/api/admin-graphql/latest/input-objects/MailingAddressInput) references (Admin GraphQL 2026-07). Actual merchant scopes and provider delivery have not been verified against a connected test shop.

## Final supplier checkout correction (2.11.1)

A final type check exposed an older supplier-confirmation caller. That path also allowed a supplied paid Checkout session to mark an order paid without binding the payment to that order. Confirmation now reads the ownership-scoped webhook state without performing payment or Shopify writes. The supplier sheet waits for that state and links to an actual Supply orders history page. Checkout session IDs are retained and the webhook reads Stripe's current collected shipping-address field. Regression tests verify that a supplied session ID cannot trigger a paid write.

At the 2.11.0 deployment check, Stripe test mode and the JWT secret length were verified without displaying credentials. `RESEND_API_KEY` and `EMAIL_FROM` were absent; the user has been asked to configure them in Railway. Email recovery/delivery cannot be accepted until those settings are supplied and tested. The previously missing `APP_URL` was configured and deployed.

`pnpm deploy:reconcile` defaults to preview; `--apply` is an explicit one-time reconciliation for this audited test database. It preserves backups and establishes an adoption boundary; it does not assert that historical migrations were executed. `pnpm deploy:test-flows` exercises real MySQL waitlist, project authorization and import paths in a transaction that intentionally rolls back all fixtures and queued notifications. It is restricted to Stripe test configuration.
