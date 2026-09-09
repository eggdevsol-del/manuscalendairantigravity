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

## Verified locally

- 46 tests across 10 files pass, including token isolation, recovery replay, form persistence, session-plan rollback/retry, payment state, deposit confirmation and conversation drafts.
- Clean TypeScript check: `pnpm exec tsc --noEmit --incremental false`.
- Vite production bundle, server esbuild bundle and migration-file packaging succeed. Build performs no database migrations.
- Local browser inspection confirms the sign-in page exposes its labelled fields and links, and the recovery route shows its reset form.
- The app installs and launches successfully in the iPhone 17 Pro simulator; its native login screen was visually inspected.
- Xcode 26.6 unsigned iOS simulator build succeeds for arm64 and x86_64, including the OneSignal SPM bridge. The initial SwiftPM download stall was resolved by caching official framework archives after verifying every manifest SHA-256 checksum.

Transaction tests use controlled in-memory fixtures. They do not establish MySQL locking behaviour, Stripe delivery behaviour or successful real email delivery. Existing tests include a one-test harness smoke check.

## Existing staging environment required

No staging URL, database connection or Stripe test-mode configuration was available in the workspace. No production database was migrated, and no real payments or customer messages were sent.

Use the existing hosting service's staging environment variables. Do not commit credentials. Configure `APP_URL`, `DATABASE_URL`, a strong random `JWT_SECRET`, `STRIPE_SECRET_KEY` (test mode), `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY` and a verified `EMAIL_FROM`. Configure the existing storage, Google sign-in and notification integrations separately where those paths are tested.

The branch adds migrations `0023_webhook_receipts.sql` and `0024_retain_procedure_snapshots.sql`. Before applying them, back up staging and compare its actual schema and migration journal. The baseline already contains schema/snapshot drift in appointments, session plans, aftercare, suppliers and other tables. The new snapshots preserve that baseline instead of silently incorporating unrun historical changes. Do not blindly generate or push the entire schema. Old balance-link tokens must be regenerated because they are now purpose-bound to the booking.

Staging acceptance must cover:

1. Client and artist signup, Google sign-in, emailed reset/magic links, logout and account switching.
2. Multi-session checkout, duplicate and out-of-order webhooks, failed fulfilment/retry, concurrent slot requests and cancellation while payment is processing.
3. Deposit/balance payment, manual claims and artist verification, partial/full refunds, rejected payment methods and abandoned/redirected checkout.
4. Form signing and required answers, procedure completion, aftercare assignment/history and rescheduling.
5. Merchant inventory, checkout, stock/fulfilment and existing Shopify synchronization.
6. Mobile/desktop layout, keyboard focus, screen reader flow, native navigation, push opt-in, permissions and reconnect behaviour.

## Native testing

Xcode is available on this Mac. Run `pnpm build`, then `CAPACITOR_SERVER_URL=https://YOUR-EXISTING-STAGING-HOST pnpm ios:sync`, and open `ios/App/App.xcodeproj` in Xcode. The URL must use HTTPS. For a bundled frontend with a remote backend, configure `VITE_API_BASE_URL` before the web build instead. Keep the existing bundle identifier `com.manus.calendair` unless intentionally migrating signing and push registrations.

`pnpm ios:build` requests an unsigned simulator build. A physical device/TestFlight build also needs the project's signing team and provisioning. A successful unsigned compile does not validate push delivery or backend flows.

## Still outstanding

- Live staging acceptance and database migration/schema reconciliation.
- Expiring waitlist offers, import duplicate matching, and a complete project financial history.
- Full studio product workflows, paid entitlement enforcement, settlement and verified merchant ownership transfer.
- Durable outbox coverage for external side effects in older payment handlers; provider-wide duplicate/refund reconciliation and real MySQL concurrency tests.
- Clinical/legal review of retention, consent wording, procedure logs and jurisdiction-specific requirements. No legal compliance certification is claimed.

These items remain explicit rather than being represented by simulated success states.

## GitHub CI credential limit

The saved GitHub credential cannot create Actions workflows (missing workflow scope). `.github/verify.example.yml` preserves the proposed checks without activating a workflow. An account with workflow permission can place it in `.github/workflows/verify.yml`. GitHub CI has not run; the checks above were executed locally.
