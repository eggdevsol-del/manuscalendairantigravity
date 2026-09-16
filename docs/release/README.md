# Release gates

These checks reduce recurrence; they do not promise a defect-free app.

1. `pnpm install --frozen-lockfile` and `pnpm exec playwright install chromium` prepare a clean runner.
2. `pnpm release:check` runs architecture, TypeScript, unit/contract tests, a production build, and browser regressions. CI runs the same command. Its browser API calls use synthetic fixtures and block external traffic. This is not Stripe or database sign-off.
3. `pnpm ios:prepare` builds and synchronizes native assets. `pnpm ios:build` refuses a stale native bundle. The Xcode target also runs a runtime-independent parity phase before copying resources. Run `pnpm check-native-assets` again before archiving through Xcode; the native verification script compares bytes, not just version labels.
4. Test the **resulting** artifact on physical devices and integrated staging services using `checklist.json`. Complete the missing real-payment/webhook, security, accessibility and operational checks. Link their evidence to the content-addressed `dist/public/build-info.json` identifier.
5. `pnpm release:signoff path/to/reviewed-run.json` rejects missing/stale results and unresolved P0/P1 checks. Browser/unit successes do not waive physical/service tests.

The acceptance JSON uses the checklist export structure. Set `meta.build` to the exact build identifier, add `matrixEvidence`, and add `approvals` entries for `qa`, `security`, `payments`, and `release`, each with `name` and `date`. Every check needs status, owner and evidence; N/A also needs explanatory notes. P2 exceptions require a `waivers[checkId]` record with owner, reason and date. The gate validates the record's completeness, not the authenticity or sufficiency of evidence: named reviewers remain accountable.

A new build invalidates old sign-off. Never edit results to make a gate green without performing the test. Native source/config/plugin changes require a new native acceptance run even if web assets are unchanged. Enable the **Release regressions / web-and-contracts** job as a required branch-protection check in the repository settings; repository policy enforcement itself is outside a local code change.

## Sitting data and disclosure safeguards

Confirmed and proposed sitting lists share `SittingCard`. Linked detail disclosures query the authorized `projects.summary` endpoint; proposal rows use server session-plan items. Financial presentation for project, client-booking and normalized calendar records uses `server/services/sittingFinancials.ts`. Canonical cents, including explicit zero, take precedence over legacy dollar fields.

The production-data guard rejects fixture/demo modules in the live import graph. It does not prove that every literal is a valid business default. Local disclosure state, copy, styling and formatting belong in the UI; live appointment values do not. Legacy demo code outside the live graph is not certified for release.

The sitting browser regressions verify project selection for both roles, client bookings/history, studio, calendar agenda and proposal/checkout disclosures. They use isolated synthetic backend responses and never send customer messages or payments.

## Permanent regressions

- Long threads at 320/390/440/820 widths: bounded message viewport and the newest bubble actually visible; a zero bottom gap alone is insufficient.
- Delayed photo loading: follow the bottom only when intended; preserve the history reader's anchor.
- Keyboard-sized viewport, long drafts and incoming polling updates.
- 205 messages across multiple cursor pages: no duplicates, stable order, visible-anchor preservation and exhaustion handling.
- Synthetic payment token/query/exception markers absent from telemetry; immutable build fingerprint present.
- Unauthorized history queries rejected; page size bounded; shared fee/payment contracts retained.
- Missing/stale native assets fail; invalid lazy feature overlay imports fail; incomplete acceptance records fail.

## Overrides for local investigation

`AUDIT_BROWSER` may point to a locally installed Chromium executable. `AUDIT_URL` skips starting a preview: use it only for a production preview of the exact candidate, never production user traffic. `AUDIT_OUTPUT` chooses the evidence directory. `PLAYWRIGHT_PATH` is an optional runner override; CI uses the pinned project dependency.

The overlay checker traverses current entrypoint imports, including app-v3, barrel exports and lazy routes. Low-level shared implementations and composition-context consumers are explicitly listed. Inactive legacy pages are not silently certified: importing one into the live graph makes it subject to the gate.
